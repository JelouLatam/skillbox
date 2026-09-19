import {
  readFile,
  writeFile,
  mkdir,
  rename,
  rm,
  symlink,
  lstat,
  readlink,
  copyFile,
  chmod,
} from "node:fs/promises";
import { existsSync as exists } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname, relative } from "node:path";

const home = homedir();
const installDir = join(home, ".local/share/skillbox");
const configPath = join(home, ".config/skillbox/config.json");
const wrapperPath = join(home, ".local/bin/skillbox");
const sharedSkill = join(home, ".agents/skills/skills-library");
const stateDir = join(home, ".local/state/skillbox");
const CLI_FILES = ["skillbox.mjs", "package.mjs", "setup.mjs"];

const clients = {
  claude: {
    label: "Claude Code",
    detect: () => exists(join(home, ".claude.json")) || exists(join(home, ".claude")),
    config: join(home, ".claude.json"),
    skills: join(home, ".claude/skills"),
  },
  codex: {
    label: "Codex",
    detect: () => exists(join(home, ".codex")),
    config: join(home, ".codex/config.toml"),
  },
  cursor: {
    label: "Cursor",
    detect: () => exists(join(home, ".cursor")),
    config: join(home, ".cursor/mcp.json"),
    skills: join(home, ".cursor/skills"),
  },
};

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

let backupDir;
async function backup(path) {
  const current = await readText(path);
  if (current === null) return;
  backupDir ??= join(
    stateDir,
    "backup-" + new Date().toISOString().replace(/[:.]/g, "-"),
  );
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const target = join(backupDir, relative(home, path).replaceAll("/", "__"));
  await copyFile(path, target);
  await chmod(target, 0o600);
}
async function write(path, content, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await backup(path);
  const temporary = path + ".skillbox-new";
  await writeFile(temporary, content, { mode });
  await chmod(temporary, mode);
  await rename(temporary, path);
}

async function download(origin, path) {
  const r = await fetch(origin + path, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Download failed: ${path} (HTTP ${r.status})`);
  return r.text();
}

function bridge(runtime) {
  return {
    command: runtime,
    args: [join(installDir, "skillbox.mjs"), "mcp"],
    env: { SKILLBOX_CONFIG: configPath },
  };
}

async function registerJson(path, server) {
  const raw = await readText(path);
  const data = raw ? JSON.parse(raw) : {};
  data.mcpServers ??= {};
  data.mcpServers.skillbox = server;
  await write(path, JSON.stringify(data, null, 2) + "\n");
}
async function unregisterJson(path) {
  const raw = await readText(path);
  if (!raw) return false;
  const data = JSON.parse(raw);
  if (!data.mcpServers?.skillbox) return false;
  delete data.mcpServers.skillbox;
  await write(path, JSON.stringify(data, null, 2) + "\n");
  return true;
}

// Codex config is TOML; only the [mcp_servers.skillbox] tables are touched, as text,
// so comments and formatting elsewhere in the file survive.
function withoutCodexBlock(content) {
  const out = [];
  let skipping = false;
  for (const line of content.split("\n")) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(#.*)?$/);
    if (header)
      skipping = /^mcp_servers\.("skillbox"|skillbox)(\.|$)/.test(
        header[1].trim(),
      );
    if (!skipping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}$/, "\n\n");
}
async function registerCodex(path, server) {
  const content = withoutCodexBlock((await readText(path)) ?? "");
  const block = [
    "[mcp_servers.skillbox]",
    `command = ${JSON.stringify(server.command)}`,
    `args = ${JSON.stringify(server.args)}`,
    "",
    "[mcp_servers.skillbox.env]",
    `SKILLBOX_CONFIG = ${JSON.stringify(server.env.SKILLBOX_CONFIG)}`,
    "",
  ].join("\n");
  const prefix = content.trimEnd();
  await write(path, (prefix ? prefix + "\n\n" : "") + block);
}
async function unregisterCodex(path) {
  const content = await readText(path);
  if (!content || !/\[mcp_servers\.("skillbox"|skillbox)\]/.test(content))
    return false;
  await write(path, withoutCodexBlock(content).trimEnd() + "\n");
  return true;
}

async function linkSkill(skillsDir) {
  const link = join(skillsDir, "skills-library");
  let stat;
  try {
    stat = await lstat(link);
  } catch {}
  if (stat?.isSymbolicLink()) {
    if ((await readlink(link)) === relative(skillsDir, sharedSkill)) return;
    await rm(link);
  } else if (stat) {
    backupDir ??= join(
      stateDir,
      "backup-" + new Date().toISOString().replace(/[:.]/g, "-"),
    );
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    await rename(
      link,
      join(backupDir, relative(home, link).replaceAll("/", "__")),
    );
  }
  await mkdir(skillsDir, { recursive: true });
  await symlink(relative(skillsDir, sharedSkill), link, "dir");
}

async function installFiles(origin) {
  for (const name of CLI_FILES)
    await write(
      join(installDir, name),
      await download(origin, "/cli/" + name),
      0o644,
    );
  await write(
    join(sharedSkill, "SKILL.md"),
    await download(origin, "/bootstrap/SKILL.md"),
    0o644,
  );
}

function checkBridge(runtime) {
  const requests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "skillbox-setup", version: "1" },
      },
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ];
  const result = spawnSync(runtime, [join(installDir, "skillbox.mjs"), "mcp"], {
    input: requests.map((r) => JSON.stringify(r)).join("\n") + "\n",
    env: { ...process.env, SKILLBOX_CONFIG: configPath },
    encoding: "utf8",
    timeout: 60000,
  });
  const replies = Object.fromEntries(
    (result.stdout ?? "")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map((m) => [m.id, m]),
  );
  const tools = replies[2]?.result?.tools;
  if (!tools)
    throw new Error(
      "The MCP bridge could not reach the library: " +
        (replies[2]?.error?.message ?? result.stderr?.trim() ?? "no reply"),
    );
  return tools.length;
}

async function setup(args) {
  const code = args[0];
  const originIndex = args.indexOf("--origin");
  const origin = (originIndex >= 0 ? args[originIndex + 1] : "")?.replace(
    /\/$/,
    "",
  );
  if (!code || !origin)
    throw new Error("Usage: skillbox setup <install-code> --origin <url>");
  const r = await fetch(origin + "/install/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      (body.error ?? `HTTP ${r.status}`) +
        ". Create a new key on the Connect page to get a fresh code.",
    );
  const runtime = process.execPath;
  await installFiles(origin);
  await write(
    configPath,
    JSON.stringify({ url: body.origin ?? origin, token: body.key }, null, 2) +
      "\n",
  );
  const tools = checkBridge(runtime);
  const server = bridge(runtime);
  const configured = [];
  for (const [id, client] of Object.entries(clients)) {
    if (!client.detect()) continue;
    if (id === "codex") await registerCodex(client.config, server);
    else await registerJson(client.config, server);
    if (client.skills) await linkSkill(client.skills);
    configured.push(client.label);
  }
  await write(
    wrapperPath,
    `#!/bin/sh\nexec "${runtime}" "${join(installDir, "skillbox.mjs")}" "$@"\n`,
    0o755,
  );
  console.log(`\n✓ Connected "${body.name}" to ${origin} (${tools} tools)`);
  console.log(
    configured.length
      ? `✓ Configured: ${configured.join(", ")}. Restart them to load the library.`
      : "! No Claude Code, Codex or Cursor installation found. Install one and run `skillbox setup` again with a new code.",
  );
  console.log("✓ Library skill: ~/.agents/skills/skills-library");
  if (!(process.env.PATH ?? "").split(":").includes(dirname(wrapperPath)))
    console.log(
      `! Add ${dirname(wrapperPath)} to your PATH to use the \`skillbox\` command.`,
    );
  if (backupDir) console.log(`  Backups of changed files: ${backupDir}`);
}

async function loadConfig() {
  const raw = await readText(configPath);
  if (!raw) throw new Error("Not set up yet. Run the install command from the Connect page.");
  return JSON.parse(raw);
}

async function update() {
  const config = await loadConfig();
  await installFiles(config.url);
  console.log(`✓ Updated the CLI and the library skill from ${config.url}`);
}

async function doctor() {
  const config = await loadConfig();
  let ok = true;
  const line = (good, text) => {
    ok &&= good;
    console.log(`${good ? "✓" : "✗"} ${text}`);
  };
  line(true, `Library: ${config.url}`);
  try {
    const r = await fetch(config.url + "/api/me", {
      headers: { Authorization: "Bearer " + config.token },
      signal: AbortSignal.timeout(30000),
    });
    const me = await r.json().catch(() => ({}));
    line(
      r.ok,
      r.ok ? `Key works (${me.name})` : `Key rejected (HTTP ${r.status}). Create a new one on the Connect page.`,
    );
  } catch (e) {
    line(false, `Cannot reach the library: ${e.message}`);
  }
  for (const client of Object.values(clients)) {
    if (!client.detect()) continue;
    const content = (await readText(client.config)) ?? "";
    line(
      content.includes(join(installDir, "skillbox.mjs")),
      `${client.label}: ${content.includes("skillbox") ? "connected" : "not connected"} (${client.config})`,
    );
  }
  line(
    exists(join(sharedSkill, "SKILL.md")),
    "Library skill installed",
  );
  if (!ok) process.exitCode = 1;
}

async function uninstall() {
  for (const [id, client] of Object.entries(clients)) {
    const removed =
      id === "codex"
        ? await unregisterCodex(client.config)
        : await unregisterJson(client.config);
    if (removed) console.log(`✓ Removed from ${client.label}`);
    if (client.skills) {
      const link = join(client.skills, "skills-library");
      try {
        if ((await lstat(link)).isSymbolicLink()) await rm(link);
      } catch {}
    }
  }
  for (const path of [sharedSkill, configPath, wrapperPath, installDir])
    await rm(path, { recursive: true, force: true });
  console.log("✓ Removed the library skill, key, CLI and `skillbox` command");
  if (backupDir) console.log(`  Backups of changed files: ${backupDir}`);
  console.log(
    "  The key still exists on the server; revoke it on the Connect page.",
  );
}

export async function run(command, args) {
  if (command === "setup") return setup(args);
  if (command === "update") return update();
  if (command === "doctor") return doctor();
  if (command === "uninstall") return uninstall();
}
