import React, { useEffect, useState } from "react";
import {
  Users,
  ShieldCheck,
  Plus,
  KeyRound,
  Pause,
  Play,
  Search,
  FileText,
  Check,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Link } from "@tanstack/react-router";
import { api, decoded, date } from "./api";
import { SkillIconView } from "./skill-icon";
import { PageHeader, Panel, EmptyState, Segmented, UserAvatar } from "./page-kit";
import type { Permissions, SkillSummary, SkillFile } from "../shared";
type Profile = {
  id: string;
  name: string;
  allSkills: boolean;
  skillIds: string[];
  permissions: Permissions;
  version: string;
};
type Client = {
  id: string;
  name: string;
  profileId: string;
  active: boolean;
  lastSeen: string | null;
  ownerEmail?: string | null;
};
const blank = () => ({
  name: "",
  allSkills: false,
  skillIds: [] as string[],
  permissions: { create: false, update: false, delete: false, propose: true },
});
const labels: Record<keyof Permissions, string> = {
  create: "Create skills",
  update: "Update skills",
  delete: "Delete skills",
  propose: "Propose updates",
};
function ErrorNote({ error }: { error: string }) {
  return error ? (
    <div className="error-note" role="alert">
      {error}
    </div>
  ) : null;
}
function useDialog(active: boolean, close: () => void) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = document.querySelector<HTMLElement>(".access-dialog");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ) ?? [],
      );
    if (!dialog?.contains(document.activeElement)) focusable()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key !== "Tab") return;
      const targets = focusable(),
        first = targets[0],
        last = targets.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [active]);
}
export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [catalog, setCatalog] = useState<SkillSummary[]>([]),
    [draft, setDraft] = useState<
      (ReturnType<typeof blank> & { id?: string; version?: string }) | null
    >(null),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useDialog(Boolean(draft), () => setDraft(null));
  const refresh = async () => {
    const [p, c, s] = await Promise.all([
      api("/profiles"),
      api("/clients"),
      api("/skills?limit=500&includeDisabled=true"),
    ]);
    setProfiles(p);
    setClients(c);
    setCatalog(s.items);
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  return (
    <main className="page">
      <PageHeader
        title="Profiles"
        description="A profile decides which skills a client key can see and what it is allowed to change."
        actions={
          <Button
            onClick={() => {
              setDraft(blank());
              setQuery("");
            }}
          >
            <Plus size={16} />
            New profile
          </Button>
        }
      />
      <ErrorNote error={error} />
      <div className="profile-grid">
        {profiles
          .filter(
            (p) =>
              clients.some((c) => c.profileId === p.id && c.active) ||
              !clients.some((c) => c.profileId === p.id),
          )
          .map((p) => (
            <section className="profile-card" key={p.id}>
              <header>
                <ShieldCheck size={20} />
                <h2>{p.name}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${p.name}`}
                  onClick={() => {
                    setDraft({
                      ...p,
                      skillIds: [...p.skillIds],
                      permissions: { ...p.permissions },
                    });
                    setQuery("");
                  }}
                >
                  <Pencil size={16} />
                </Button>
              </header>
              <p className="muted">
                {clients.filter((c) => c.profileId === p.id && c.active).length}{" "}
                {clients.filter((c) => c.profileId === p.id && c.active)
                  .length === 1
                  ? "client"
                  : "clients"}{" "}
                ·{" "}
                {p.allSkills
                  ? "All skills"
                  : `${p.skillIds.length} ${p.skillIds.length === 1 ? "grant" : "grants"}`}
              </p>
              <div className="bundle-members">
                {p.allSkills ? (
                  <span className="soft-tag">All skills</span>
                ) : (
                  p.skillIds.map((id) => (
                    <span className="soft-tag" key={id}>
                      {catalog.find((s) => s.id === id)?.title ?? id}
                    </span>
                  ))
                )}
              </div>
              <div className="permission-summary">
                {Object.entries(p.permissions)
                  .filter(([, v]) => v)
                  .map(([key]) => (
                    <span key={key}>
                      <Check size={12} />
                      {labels[key as keyof Permissions]}
                    </span>
                  ))}
                {!Object.values(p.permissions).some(Boolean) && (
                  <span>Read only</span>
                )}
              </div>
            </section>
          ))}
      </div>
      {!profiles.length && (
        <Panel flush>
          <EmptyState
            icon={<ShieldCheck size={18} />}
            title="No profiles yet"
            description="Create a profile, grant it skills or bundles, then attach client keys to it."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(blank());
                  setQuery("");
                }}
              >
                <Plus size={16} />
                New profile
              </Button>
            }
          />
        </Panel>
      )}
      <details className="inactive-profiles">
        <summary>Profiles with only paused clients</summary>
        {profiles
          .filter(
            (p) =>
              clients.some((c) => c.profileId === p.id) &&
              !clients.some((c) => c.profileId === p.id && c.active),
          )
          .map((p) => (
            <Button
              key={p.id}
              variant="ghost"
              onClick={() => setDraft({ ...p })}
            >
              {p.name}
            </Button>
          ))}
      </details>
      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={draft.id ? "Edit profile" : "New profile"}
            className="access-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api(draft.id ? `/profiles/${draft.id}` : "/profiles", {
                    method: draft.id ? "PUT" : "POST",
                    body: JSON.stringify(draft),
                  });
                  setDraft(null);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <header>
                <h2>{draft.id ? "Edit profile" : "New profile"}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close profile"
                  onClick={() => setDraft(null)}
                >
                  <X size={18} />
                </Button>
              </header>
              <ErrorNote error={error} />
              <label>
                Name
                <Input
                  autoFocus
                  required
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <fieldset className="permission-fields">
                <legend>Permissions</legend>
                {(Object.keys(labels) as (keyof Permissions)[]).map((key) => (
                  <label
                    key={key}
                    title={
                      key === "delete"
                        ? "Archives skills; revision history is preserved"
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={draft.permissions[key]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          permissions: {
                            ...draft.permissions,
                            [key]: e.target.checked,
                          },
                        })
                      }
                    />
                    {labels[key]}
                  </label>
                ))}
              </fieldset>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={draft.allSkills}
                  onChange={(e) =>
                    setDraft({ ...draft, allSkills: e.target.checked })
                  }
                />
                All skills
              </label>
              {!draft.allSkills && (
                <>
                  <div className="bundle-members">
                    {draft.skillIds.map((id) => (
                      <button
                        type="button"
                        className="soft-tag selected-grant"
                        key={id}
                        aria-label={`Remove ${catalog.find((s) => s.id === id)?.title ?? id}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            skillIds: draft.skillIds.filter(
                              (item) => item !== id,
                            ),
                          })
                        }
                      >
                        {catalog.find((s) => s.id === id)?.title ?? id}
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                  <Input
                    aria-label="Find skills and bundles"
                    placeholder="Find skills and bundles…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <div className="profile-grants">
                    {catalog
                      .filter((s) =>
                        `${s.title} ${s.id}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((s) => (
                        <label key={s.id}>
                          <input
                            type="checkbox"
                            checked={draft.skillIds.includes(s.id)}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                skillIds: e.target.checked
                                  ? [...draft.skillIds, s.id]
                                  : draft.skillIds.filter((id) => id !== s.id),
                              })
                            }
                          />
                          <SkillIconView icon={s.icon} />
                          <span>
                            {s.title}
                            <small>
                              {s.kind === "bundle"
                                ? `${s.members.length} members`
                                : "Skill"}
                              {s.disabled ? " · Paused" : ""}
                            </small>
                          </span>
                        </label>
                      ))}
                  </div>
                </>
              )}
              <footer>
                {draft.id && !clients.some((c) => c.profileId === draft.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api(`/profiles/${draft.id}`, {
                          method: "DELETE",
                        });
                        setDraft(null);
                        await refresh();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button disabled={busy || !draft.name.trim()}>
                  Save profile
                </Button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [name, setName] = useState(""),
    [profileId, setProfileId] = useState(""),
    [key, setKey] = useState(""),
    [query, setQuery] = useState(""),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Client | null>(null);
  useDialog(Boolean(editing), () => setEditing(null));
  const refresh = async () => {
    const [c, p] = await Promise.all([api("/clients"), api("/profiles")]);
    setClients(c);
    setProfiles(p);
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  const update = async (c: Client, body: Partial<Client>) => {
    setBusy(true);
    setError("");
    try {
      await api(`/clients/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await refresh();
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const visible = clients.filter(
    (c) =>
      (paused ? !c.active : c.active) &&
      `${c.name} ${profiles.find((p) => p.id === c.profileId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <main className="page">
      <PageHeader
        title="Clients"
        description="Each agent gets its own key, tied to a profile. Pause or revoke one without touching the rest."
      />
      <ErrorNote error={error} />
      {key && (
        <Panel
          className="secret-panel"
          icon={<KeyRound size={18} />}
          title="Client key created"
          description="Copy it now. This key is shown only once."
          footer={
            <>
              <Button variant="outline" onClick={() => setKey("")}>
                Dismiss
              </Button>
              <Button onClick={() => navigator.clipboard.writeText(key)}>
                Copy key
              </Button>
            </>
          }
        >
          <code className="secret-value">{key}</code>
        </Panel>
      )}
      <div className="clients-layout">
        <Panel
          flush
          toolbar={
            <>
            <Input
              aria-label="Find clients"
              placeholder="Find clients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Segmented
              label="Client status"
              value={paused ? "paused" : "active"}
              onChange={(v) => setPaused(v === "paused")}
              options={[
                {
                  value: "active",
                  label: "Active",
                  count: clients.filter((c) => c.active).length,
                },
                {
                  value: "paused",
                  label: "Paused",
                  count: clients.filter((c) => !c.active).length,
                },
              ]}
            />
            </>
          }
        >
          {visible.map((c) => (
            <div
              className={`client-row ${c.active ? "" : "is-paused"}`}
              key={c.id}
            >
              {c.ownerEmail ? (
                <UserAvatar name={c.ownerEmail} size={36} />
              ) : (
                <div className="client-avatar">
                  <KeyRound size={18} />
                </div>
              )}
              <div className="client-identity">
                <strong>{c.ownerEmail ? c.name.split(" · ")[0] : c.name}</strong>
                {c.ownerEmail && <p>{c.ownerEmail}</p>}
                <p>
                  {profiles.find((p) => p.id === c.profileId)?.name ??
                    "Unknown profile"}
                </p>
                <small
                  title={
                    c.lastSeen
                      ? new Date(c.lastSeen).toLocaleString()
                      : undefined
                  }
                >
                  {c.lastSeen
                    ? `Last request ${date(c.lastSeen)}`
                    : "No requests recorded"}
                </small>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${c.name}`}
                onClick={() => setEditing({ ...c })}
              >
                <Pencil size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="round-control"
                disabled={busy}
                aria-label={`${c.active ? "Pause" : "Resume"} ${c.name}`}
                onClick={() => update(c, { active: !c.active })}
              >
                {c.active ? <Pause size={16} /> : <Play size={16} />}
              </Button>
            </div>
          ))}
          {!visible.length && (
            <EmptyState
              icon={<Users size={18} />}
              title={clients.length ? "No matching clients" : "No clients yet"}
              description={
                clients.length
                  ? "Try another name or switch between Active and Paused."
                  : "Create a key for each agent that should read this library."
              }
            />
          )}
        </Panel>
        <form
          className="client-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const c = await api("/clients", {
                method: "POST",
                body: JSON.stringify({ name, profileId }),
              });
              setKey(c.token);
              setName("");
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Panel
            icon={<Plus size={18} />}
            title="Add client"
            description="The key is shown once, right after you create it."
            footer={
              <Button disabled={busy || !profileId || !name.trim()}>
                <KeyRound size={15} />
                Create key
              </Button>
            }
          >
          <label>
            Name
            <Input
              required
              placeholder="Desktop assistant"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Profile
            <select
              required
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              <option value="">Choose profile</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          </Panel>
        </form>
      </div>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form
            className="access-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Edit client"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              update(editing, {
                name: editing.name,
                profileId: editing.profileId,
              });
            }}
          >
            <header>
              <h2>Edit client</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close client"
                onClick={() => setEditing(null)}
              >
                <X size={18} />
              </Button>
            </header>
            <ErrorNote error={error} />
            <label>
              Name
              <Input
                required
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label>
              Profile
              <select
                value={editing.profileId}
                onChange={(e) =>
                  setEditing({ ...editing, profileId: e.target.value })
                }
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <footer>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button disabled={busy}>Save client</Button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
type DiffLine = { type: "same" | "add" | "del"; text: string; a?: number; b?: number };
function lineDiff(before: string, after: string): DiffLine[] | null {
  const a = before.split("\n"),
    b = after.split("\n");
  if ((a.length + 1) * (b.length + 1) > 2_000_000) return null;
  const w = b.length + 1;
  const lcs = new Int32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i * w + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
  const out: DiffLine[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ type: "same", text: a[i], a: ++i, b: ++j });
    } else if (j < b.length && (i >= a.length || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) {
      out.push({ type: "add", text: b[j], b: ++j });
    } else {
      out.push({ type: "del", text: a[i], a: ++i });
    }
  }
  return out;
}
function hunks(lines: DiffLine[], context = 3) {
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (l.type !== "same")
      for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++)
        keep.add(k);
  });
  const out: (DiffLine | "gap")[] = [];
  lines.forEach((l, i) => {
    if (!keep.has(i)) {
      if (out.length && out[out.length - 1] !== "gap") out.push("gap");
      return;
    }
    out.push(l);
  });
  if (out[out.length - 1] === "gap") out.pop();
  return out;
}
const TEXT_FILE = /\.(md|txt|json|ya?ml|toml|ts|tsx|js|mjs|py|sh|css|html|sql)$/;
function FileChange({ path, before, after }: { path: string; before?: SkillFile; after?: SkillFile }) {
  const status = !after ? "Removed" : !before ? "Added" : "Changed";
  const diff =
    TEXT_FILE.test(path) &&
    lineDiff(before ? decoded(before.content) : "", after ? decoded(after.content) : "");
  const added = diff ? diff.filter((l) => l.type === "add").length : 0,
    removed = diff ? diff.filter((l) => l.type === "del").length : 0;
  return (
    <section className="file-change">
      <header>
        <FileText size={15} />
        <strong>{path}</strong>
        <span className={`change-badge ${status.toLowerCase()}`}>{status}</span>
        {diff && (
          <span className="change-count">
            <b className="add">+{added}</b> <b className="del">−{removed}</b>
          </span>
        )}
      </header>
      {diff ? (
        <div className="diff-view">
          {hunks(diff).map((l, i) =>
            l === "gap" ? (
              <div className="diff-gap" key={i}>
                ⋯
              </div>
            ) : (
              <div className={`diff-line ${l.type}`} key={i}>
                <span className="diff-num">{l.a ?? ""}</span>
                <span className="diff-num">{l.b ?? ""}</span>
                <span className="diff-mark">{l.type === "add" ? "+" : l.type === "del" ? "−" : ""}</span>
                <code>{l.text || " "}</code>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="field-help file-change-binary">
          {after ? `${after.size.toLocaleString()} bytes` : "File removed"}
          {before && after ? ` (was ${before.size.toLocaleString()} bytes)` : ""}
        </p>
      )}
    </section>
  );
}
function proposalAuthor(clientName: string) {
  const [device, owner] = clientName.split(" · ");
  return owner?.includes("@")
    ? { name: owner, device }
    : { name: clientName, device: "" };
}
export function ProposalsPage() {
  const [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState<"pending" | "reviewed">("pending"),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api("/proposals").then((all) => {
      setItems(all);
      return all;
    });
  useEffect(() => {
    refresh()
      .then((all: any[]) => {
        const first = all.find((p) => p.status === "pending");
        if (first) open(first.id);
      })
      .catch((e) => setError(e.message));
  }, []);
  const open = async (id: string) => {
    try {
      setSelected(await api(`/proposals/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const review = async (decision: string) => {
    setBusy(true);
    setError("");
    try {
      await api(`/proposals/${selected.id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      await refresh();
      await open(selected.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pending = items.filter((p) => p.status === "pending");
  const visible = tab === "pending" ? pending : items.filter((p) => p.status !== "pending");
  const base: SkillFile[] = selected?.baseFiles ?? [],
    next: SkillFile[] = selected?.files ?? [];
  const paths = [...new Set([...base, ...next].map((f) => f.path))].filter((path) => {
    const a = base.find((f) => f.path === path),
      b = next.find((f) => f.path === path);
    return a?.sha256 !== b?.sha256 || a?.executable !== b?.executable;
  });
  const author = selected && proposalAuthor(selected.clientName);
  return (
    <main className="page">
      <PageHeader
        title="Proposals"
        description="Changes suggested by authors' agents. Nothing reaches the library until you approve it."
        actions={
          <Segmented
            label="Proposal status"
            value={tab}
            onChange={setTab}
            options={[
              { value: "pending", label: "Pending", count: pending.length },
              { value: "reviewed", label: "Reviewed", count: items.length - pending.length },
            ]}
          />
        }
      />
      <ErrorNote error={error} />
      {!visible.length ? (
        <Panel>
          <EmptyState
            icon={<FileText size={18} />}
            title={tab === "pending" ? "Nothing to review" : "No reviewed proposals yet"}
            description={
              tab === "pending"
                ? "When an author's agent proposes a change to a skill, it shows up here with the exact lines that change."
                : "Approved and rejected proposals are kept here."
            }
          />
        </Panel>
      ) : (
      <div className="proposal-layout">
        <Panel flush className="proposal-list">
          {visible.map((p) => {
            const who = proposalAuthor(p.clientName);
            return (
              <button
                className={`proposal-item ${selected?.id === p.id ? "selected" : ""}`}
                key={p.id}
                onClick={() => open(p.id)}
              >
                <UserAvatar name={who.name} size={36} />
                <span className="proposal-item-text">
                  <strong>{p.message}</strong>
                  <small>
                    {who.name} · {p.skillId} · {date(p.createdAt)}
                  </small>
                </span>
                {p.status !== "pending" && (
                  <span className={`change-badge ${p.status === "approved" ? "added" : "removed"}`}>
                    {p.status === "approved" ? "Approved" : "Rejected"}
                  </span>
                )}
              </button>
            );
          })}
        </Panel>
        {selected ? (
          <Panel flush className="proposal-detail">
            <header className="proposal-detail-head">
              <UserAvatar name={author.name} size={40} />
              <div>
                <strong>
                  {author.name} proposed a change to{" "}
                  <Link to="/skills/$id" params={{ id: selected.skillId }}>
                    {selected.skillId}
                  </Link>
                </strong>
                <small>
                  {author.device && `From ${author.device} · `}
                  {date(selected.createdAt)} · {paths.length}{" "}
                  {paths.length === 1 ? "file" : "files"}
                </small>
              </div>
              {selected.status === "pending" ? (
                <div className="proposal-actions">
                  <Button disabled={busy} variant="outline" onClick={() => review("reject")}>
                    <X size={15} /> Reject
                  </Button>
                  <Button disabled={busy} onClick={() => review("approve")}>
                    <Check size={15} /> Approve
                  </Button>
                </div>
              ) : (
                <span className={`change-badge ${selected.status === "approved" ? "added" : "removed"}`}>
                  {selected.status === "approved" ? "Approved" : "Rejected"}
                  {selected.reviewer ? ` by ${selected.reviewer}` : ""}
                </span>
              )}
            </header>
            <blockquote className="proposal-message">{selected.message}</blockquote>
            <div className="proposal-files">
              {paths.map((path) => (
                <FileChange
                  key={path}
                  path={path}
                  before={base.find((f) => f.path === path)}
                  after={next.find((f) => f.path === path)}
                />
              ))}
            </div>
          </Panel>
        ) : (
          <Panel className="proposal-detail">
            <EmptyState
              icon={<FileText size={18} />}
              title="Select a proposal"
              description="See who proposed it, why, and exactly which lines change."
            />
          </Panel>
        )}
      </div>
      )}
    </main>
  );
}
type User = {
  email: string;
  name: string;
  role: "admin" | "author" | "member";
  lastLoginAt: string | null;
};
const roleLabels: Record<User["role"], string> = {
  admin: "Admin",
  author: "Author",
  member: "Member",
};
export function PeoplePage() {
  const [users, setUsers] = useState<User[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const refresh = () => api("/users").then(setUsers);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  const visible = users.filter((u) =>
    (u.name + " " + u.email).toLowerCase().includes(query.toLowerCase()),
  );
  const setRole = async (u: User, role: User["role"]) => {
    setBusy(u.email);
    setError("");
    try {
      await api(`/users/${encodeURIComponent(u.email)}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <main className="page">
      <PageHeader
        title="People"
        description="Everyone who has signed in with Google. Members read the library; authors can also propose changes. Admins are set with SKILLBOX_ADMIN_EMAILS."
      />
      <ErrorNote error={error} />
      <Panel
        flush
        toolbar={
          <Input
            aria-label="Find people"
            placeholder="Find people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      >
        {visible.map((u) => (
          <div className="client-row" key={u.email}>
            <UserAvatar name={u.name} seed={u.email} size={36} />
            <div className="client-identity">
              <strong>{u.name}</strong>
              <p>{u.email}</p>
              <small>
                {u.lastLoginAt
                  ? `Last sign-in ${date(u.lastLoginAt)}`
                  : "Never signed in"}
              </small>
            </div>
            {u.role === "admin" ? (
              <span className="status-badge">{roleLabels.admin}</span>
            ) : (
              <select
                aria-label={`Role for ${u.name}`}
                value={u.role}
                disabled={busy === u.email}
                onChange={(e) => setRole(u, e.target.value as User["role"])}
              >
                <option value="member">{roleLabels.member}</option>
                <option value="author">{roleLabels.author}</option>
              </select>
            )}
          </div>
        ))}
        {!visible.length && (
          <EmptyState
            icon={<Users size={18} />}
            title={
              users.length ? "No matching people" : "No one has signed in yet"
            }
            description={
              users.length
                ? "Try another name or email."
                : "People appear here after their first Google sign-in."
            }
          />
        )}
      </Panel>
    </main>
  );
}
