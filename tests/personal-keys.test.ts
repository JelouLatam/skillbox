import { beforeAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, migrate } from "../src/server/db";
import { users } from "../src/server/schema";
import { app } from "../src/server/app";
import { saveProfile } from "../src/server/access";
import { upsertUser } from "../src/server/google-auth";
import { ADMIN } from "../src/server/library";
import { userPrincipal } from "../src/server/auth";
import {
  createMyKey,
  listMyKeys,
  revokeMyKey,
  MAX_ACTIVE_KEYS,
} from "../src/server/personal-keys";

const suffix = randomUUID().slice(0, 8);
const memberProfile = "member-" + suffix;
const authorProfile = "author-" + suffix;
const readOnly = { create: false, update: false, delete: false };

const person = async (local: string, role: "author" | "member" = "member") => {
  const user = await upsertUser({
    email: `${local}-${suffix}@example.com`,
    name: local,
    emailVerified: true,
    hostedDomain: "example.com",
    audience: "",
    issuer: "",
  });
  await db.update(users).set({ role }).where(eq(users.email, user.email));
  return userPrincipal({ ...user, role });
};
const redeem = (code: string) =>
  app.request("/install/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

beforeAll(async () => {
  await migrate();
  await saveProfile(ADMIN, {
    name: memberProfile,
    allSkills: true,
    skillIds: [],
    permissions: { ...readOnly, propose: false },
  });
  await saveProfile(ADMIN, {
    name: authorProfile,
    allSkills: true,
    skillIds: [],
    permissions: { ...readOnly, propose: true },
  });
  process.env.SKILLBOX_MEMBER_PROFILE = memberProfile;
  process.env.SKILLBOX_AUTHOR_PROFILE = authorProfile;
});

test("an install code returns the key once, and the key reaches MCP", async () => {
  const p = await person("reader");
  const created = await createMyKey(p, "MacBook");
  const first = await redeem(created.code);
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.key).toBe(created.key);
  expect(body.name).toBe(`MacBook · reader-${suffix}@example.com`);
  expect((await redeem(created.code)).status).toBe(404);
  const mcp = await app.request("/mcp", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + body.key,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  expect(mcp.status).toBe(200);
  expect((await listMyKeys(p)).map((k) => k.id)).toEqual([created.id]);
});

test("members get the member profile and authors the author profile", async () => {
  const me = async (key: string) =>
    (
      await app.request("/api/me", {
        headers: { Authorization: "Bearer " + key },
      })
    ).json();
  const member = await createMyKey(await person("m"), "Laptop");
  const author = await createMyKey(await person("a", "author"), "Laptop");
  expect(await me(member.key)).toMatchObject({ role: "reader" });
  const profiles = await (
    await app.request("/api/clients", {
      headers: { Authorization: "Bearer " + process.env.SKILLBOX_ADMIN_TOKEN },
    })
  ).json();
  const profileOf = (id: string) =>
    profiles.find((c: { id: string }) => c.id === id);
  expect(profileOf(author.id).ownerEmail).toBe(`a-${suffix}@example.com`);
  expect(profileOf(member.id).profileId).not.toBe(
    profileOf(author.id).profileId,
  );
});

test("keys are limited per person and only the owner can revoke them", async () => {
  const owner = await person("owner"),
    other = await person("other");
  const keys = [];
  for (let i = 0; i < MAX_ACTIVE_KEYS; i++)
    keys.push(await createMyKey(owner, "Device " + i));
  await expect(createMyKey(owner, "One too many")).rejects.toThrow(
    "active keys",
  );
  await expect(revokeMyKey(other, keys[0].id)).rejects.toThrow("not found");
  await revokeMyKey(owner, keys[0].id);
  expect((await redeem(keys[0].code)).status).toBe(404);
  expect(
    (
      await app.request("/api/me", {
        headers: { Authorization: "Bearer " + keys[0].key },
      })
    ).status,
  ).toBe(401);
  await expect(createMyKey(owner, "device 1")).rejects.toThrow(
    'already have a key for "device 1"',
  );
  await createMyKey(owner, "Replacement");
});

test("admin-token sessions have no personal keys", async () => {
  await expect(createMyKey(ADMIN, "Nope")).rejects.toThrow("Google sign-in");
});
