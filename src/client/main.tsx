import {
  ClientsPage,
  PeoplePage,
  ProfilesPage,
  ProposalsPage,
} from "./access-pages";
import { referenceId, skillReferenceMarkdown } from "../skill-references";
import { SkillReference } from "./skill-reference";
import { ExecutorSettings, SkillIntegrations } from "./executor-settings";
import { isIconAsset } from "../package-metrics";
import { SkillIconView } from "./skill-icon";
import React, {
  type ReactNode,
  useEffect,
  useState,
  createContext,
  useContext,
  useRef,
} from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import {
  Library,
  Search,
  ArrowUpRight,
  ArrowLeft,
  FileText,
  Code2,
  Folder,
  Users,
  Activity,
  Plug,
  ChevronRight,
  Check,
  Copy,
  KeyRound,
  LogOut,
  Clock,
  Save,
  Terminal,
  BookOpen,
  PanelLeftClose,
  LoaderCircle,
  X,
  ShieldCheck,
  RefreshCw,
  MoreHorizontal,
  EyeOff,
  Eye,
  Laptop,
  ChevronsUpDown,
  UserRound,
  Download,
  Trash2,
  Layers,
  PauseCircle,
  PlayCircle,
  Settings2,
} from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { api, date, decoded } from "./api";
import type { SkillSummary, SkillFile } from "../shared";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import jelouSkillsLogo from "./jelou-skills-logo.svg?raw";
import jelouSkillsMark from "./jelou-skills-mark.svg?raw";
import { PageHeader, Panel, EmptyState, UserAvatar } from "./page-kit";
import "./cortex-tokens.css";
import "./styles.css";
type Me = { name: string; role: string; email: string | null };
const Auth = createContext<Me>({
  name: "",
  role: "reader",
  email: null,
});
function BrandLogo() {
  return (
    <span className="brand-lockup" role="img" aria-label="Jelou Skills">
      <span
        className="brand-logo"
        dangerouslySetInnerHTML={{ __html: jelouSkillsLogo }}
      />
      <span
        className="brand-mark"
        dangerouslySetInnerHTML={{ __html: jelouSkillsMark }}
      />
    </span>
  );
}
function ErrorNote({ error }: { error: string }) {
  return error ? (
    <div className="error-note" role="alert">
      {error}
    </div>
  ) : null;
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <Library size={26} />
      <p>{children}</p>
    </div>
  );
}
function CopyButton({
  text,
  label = "Copy",
  primary = false,
}: {
  text: string;
  label?: string;
  primary?: boolean;
}) {
  const [copied, set] = useState(false);
  return (
    <Button
      variant={primary ? "default" : "outline"}
      size={primary ? "default" : "sm"}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        set(true);
        setTimeout(() => set(false), 1800);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
      {copied ? "Copied" : label}
    </Button>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState(""),
    [error, setError] = useState(
      () => new URLSearchParams(location.search).get("auth_error") ?? "",
    ),
    [busy, setBusy] = useState(false),
    [google, setGoogle] = useState<boolean | null>(null),
    [useKey, setUseKey] = useState(false);
  useEffect(() => {
    if (location.search.includes("auth_error"))
      history.replaceState(null, "", location.pathname);
    api("/auth/config")
      .then((c) => setGoogle(c.google))
      .catch(() => setGoogle(false));
  }, []);
  if (google === null)
    return (
      <div className="boot">
        <LoaderCircle className="spin" />
      </div>
    );
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="brand login-brand">
          <BrandLogo />
        </div>
        <h1>Sign in to Jelou Skills</h1>
        {google && !useKey ? (
          <>
            <ErrorNote error={error} />
            <Button asChild variant="outline" className="login-google w-full">
              <a href="/api/auth/google">
                <GoogleMark /> Sign in with Google
              </a>
            </Button>
            <button
              type="button"
              className="login-alt"
              onClick={() => {
                setError("");
                setUseKey(true);
              }}
            >
              Use an access key
            </button>
          </>
        ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/login", {
                method: "POST",
                body: JSON.stringify({ key }),
              });
              setKey("");
              onLogin();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="access-key">Workspace access key</label>
          <Input
            id="access-key"
            type="password"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
          />
          <ErrorNote error={error} />
          <Button className="w-full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <KeyRound size={16} />
            )}{" "}
            Open workspace
          </Button>
          {google && (
            <button
              type="button"
              className="login-alt"
              onClick={() => {
                setError("");
                setUseKey(false);
              }}
            >
              Sign in with Google instead
            </button>
          )}
        </form>
        )}
      </div>
    </main>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
      />
    </svg>
  );
}
function Shell() {
  const [user, setUser] = useState<Me | null>(null),
    [loading, setLoading] = useState(true);
  const refresh = () =>
    api("/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  if (loading)
    return (
      <div className="boot">
        <LoaderCircle className="spin" />
      </div>
    );
  if (!user) return <Login onLogin={refresh} />;
  return (
    <Auth.Provider value={user}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <BrandLogo />
          </Link>
          <nav>
            <Link to="/" activeOptions={{ exact: true }}>
              <Library size={17} />
              Library
            </Link>
            <Link to="/bundles">
              <Layers size={17} />
              Bundles
            </Link>
            <SidebarBundles />
            {user.role === "admin" && (
              <>
                <Link to="/profiles">
                  <ShieldCheck size={17} />
                  Profiles
                </Link>
                <Link to="/proposals">
                  <FileText size={17} />
                  Proposals
                </Link>
                <Link to="/clients">
                  <Users size={17} />
                  Clients
                </Link>
                <Link to="/people">
                  <UserRound size={17} />
                  People
                </Link>
                <Link to="/activity">
                  <Activity size={17} />
                  Activity
                </Link>
                <Link to="/settings">
                  <Settings2 size={17} /> Settings
                </Link>
              </>
            )}
          </nav>
          <ProfileMenu
            user={user}
            onSignOut={async () => {
              await api("/logout", { method: "POST" });
              setUser(null);
            }}
          />
        </aside>
        <div className="workspace">
          <Outlet />
        </div>
      </div>
    </Auth.Provider>
  );
}
function ProfileMenu({
  user,
  onSignOut,
}: {
  user: Me;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="sidebar-bottom" ref={ref}>
      {open && (
        <div className="profile-menu" role="menu">
          <Link to="/devices" role="menuitem">
            <Laptop size={16} /> My devices
          </Link>
          <button type="button" role="menuitem" onClick={onSignOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        className="profile-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <UserAvatar name={user.email ?? user.name} size={34} />
        <span className="profile-text">
          <strong>{user.name}</strong>
          <small title={user.email ?? undefined}>
            {user.email ?? "Signed in with the admin key"}
          </small>
        </span>
        <ChevronsUpDown size={15} />
      </button>
    </div>
  );
}
function SidebarBundles() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [bundles, setBundles] = useState<SkillSummary[]>([]);
  useEffect(() => {
    let cancelled = false;
    api("/skills?limit=500")
      .then((r) => {
        if (!cancelled)
          setBundles(r.items.filter((s: SkillSummary) => s.kind === "bundle"));
      })
      .catch(() => {
        if (!cancelled) setBundles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  const nested = new Set(bundles.flatMap((b) => b.members));
  return (
    <div className="sidebar-bundles">
      {bundles
        .filter((b) => !nested.has(b.id))
        .map((b) => (
          <Link key={b.id} to="/skills/$id" params={{ id: b.id }}>
            {b.title}
          </Link>
        ))}
    </div>
  );
}
function BundlesPage() {
  const [catalog, setCatalog] = useState<SkillSummary[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/skills?limit=500")
      .then((r) => setCatalog(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const bundles = catalog.filter((s) => s.kind === "bundle");
  const nested = new Set(bundles.flatMap((b) => b.members));
  const matches = bundles
    .filter((b) =>
      [b.title, b.description, ...b.members]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(nested.has(a.id)) - Number(nested.has(b.id)) ||
        a.title.localeCompare(b.title),
    );
  return (
    <main className="page library-page">
      <PageHeader
        title="Bundles"
        description="Sets of skills that work together. An agent that loads a bundle gets every skill in it."
      />
      <div className="library-search">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Search bundles"
            placeholder="Search bundles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <ErrorNote error={error} />
      {loading ? (
        <Empty>Loading bundles…</Empty>
      ) : !matches.length ? (
        <EmptyState
          icon={<Layers size={18} />}
          title={bundles.length ? "No bundles match" : "No bundles yet"}
          description={
            bundles.length
              ? "Try another word."
              : "Bundles group related skills so an agent can load them together."
          }
        />
      ) : (
        <div className="bundle-grid">
          {matches.map((b) => {
            const members = b.members
              .map((id) => catalog.find((s) => s.id === id))
              .filter((s): s is SkillSummary => !!s);
            return (
              <Link
                to="/skills/$id"
                params={{ id: b.id }}
                className="bundle-card"
                key={b.id}
              >
                <div className="bundle-icons">
                  {members.slice(0, 4).map((m) => (
                    <SkillIconView icon={m.icon} key={m.id} />
                  ))}
                  {members.length > 4 && (
                    <span className="bundle-more">+{members.length - 4}</span>
                  )}
                </div>
                <div className="bundle-card-text">
                  <h2>{b.title}</h2>
                  <p>{b.description}</p>
                </div>
                <div className="bundle-card-foot">
                  <span>
                    <Layers size={14} /> {members.length}{" "}
                    {members.length === 1 ? "skill" : "skills"}
                  </span>
                  <span className="bundle-card-names">
                    {members.map((m) => m.title).join(" · ")}
                  </span>
                  <ChevronRight size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
function LibraryPage() {
  const auth = useContext(Auth);
  const [skills, setSkills] = useState<SkillSummary[]>([]),
    [matches, setMatches] = useState<SkillSummary[] | null>(null),
    [query, setQuery] = useState(""),
    [tag, setTag] = useState(""),
    [view, setView] = useState("available"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const params = "metrics=true&includeArchived=true&includeDisabled=true";
  useEffect(() => {
    api("/skills?limit=500&" + params)
      .then((r) => setSkills(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!query.trim()) {
      setMatches(null);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      api(`/skills?limit=500&${params}&query=` + encodeURIComponent(query))
        .then((r) => {
          if (!cancelled) setMatches(r.items);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);
  const available = skills.filter((s) => !s.archived && !s.disabled);
  const tags = [...new Set(available.flatMap((s) => s.tags))].sort();
  const results = (matches ?? skills).filter(
    (s) =>
      (view === "archived"
        ? s.archived
        : view === "paused"
          ? s.disabled && !s.archived
          : !s.archived && !s.disabled) &&
      (!tag || s.tags.includes(tag)),
  );
  return (
    <main className="page library-page">
      <PageHeader
        title="Library"
        description={`${available.length} ${available.length === 1 ? "skill" : "skills"} your agent can use. Connect once and they load when a task needs them.`}
      />
      <div className="library-search">
        <div className="search-field">
          <Search size={19} />
          <input
            ref={input}
            aria-label="Search library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills…"
          />
          <kbd>
            <span>⌘</span>K
          </kbd>
        </div>
        {auth.role === "admin" && (
          <select
            aria-label="Show"
            value={view}
            onChange={(e) => setView(e.target.value)}
          >
            <option value="available">Available</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>
        )}
      </div>
      {tags.length > 0 && (
        <div className="library-tags">
          <button
            className={!tag ? "selected" : ""}
            onClick={() => setTag("")}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              className={tag === t ? "selected" : ""}
              onClick={() => setTag(tag === t ? "" : t)}
            >
              {t.replaceAll("-", " ")}
            </button>
          ))}
        </div>
      )}
      <ErrorNote error={error} />
      {query && !loading && (
        <p className="library-results">
          {results.length} {results.length === 1 ? "result" : "results"} for “
          {query}”
        </p>
      )}
      {loading ? (
        <Empty>Loading your library…</Empty>
      ) : results.length ? (
        <Panel flush className="library-list">
          {results.map((s) => (
            <Link
              key={s.id}
              to="/skills/$id"
              params={{ id: s.id }}
              className="library-row"
            >
              <SkillIconView icon={s.icon} />
              <div className="library-row-text">
                <strong>{s.title}</strong>
                <p>{s.description}</p>
                <SkillActivity skill={s} />
              </div>
              <div className="library-row-tags">
                {s.kind === "bundle" && <span className="tag">bundle</span>}
                {s.tags.slice(0, 2).map((t) => (
                  <span className="tag" key={t}>
                    {t.replaceAll("-", " ")}
                  </span>
                ))}
              </div>
              <ChevronRight size={18} className="library-row-chevron" />
            </Link>
          ))}
        </Panel>
      ) : (
        <EmptyState
          icon={<Library size={18} />}
          title={
            query || tag
              ? "No skills match"
              : view === "available"
                ? "The library is empty"
                : `No ${view} skills`
          }
          description={
            query || tag
              ? "Try another word or clear the category."
              : view === "available"
                ? "Skills are published with the skillbox CLI or the skillbox-publisher skill."
                : undefined
          }
        />
      )}
    </main>
  );
}
function SkillActivity({ skill }: { skill: SkillSummary }) {
  const parts = [
    skill.readCount
      ? `${skill.readCount} agent ${skill.readCount === 1 ? "read" : "reads"}`
      : "",
    skill.usageCount
      ? `used ${skill.usageCount} ${skill.usageCount === 1 ? "time" : "times"}`
      : "",
    skill.lastAgentReadAt ? `last read ${date(skill.lastAgentReadAt)}` : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <small className="library-row-activity">
      <Activity size={13} /> {parts.join(" · ")}
    </small>
  );
}
type DeviceKey = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  lastSeen: string | null;
};
type PendingInstall = {
  id: string;
  device: string;
  code: string;
  codeExpiresAt: string;
  created: boolean;
};
const deviceName = (k: DeviceKey) => k.name.split(" · ")[0];
const lastUse = (k: DeviceKey) => k.lastSeen ?? k.lastUsedAt;
function usedLabel(k: DeviceKey) {
  const when = lastUse(k);
  if (!when) return "not set up yet";
  return new Date(when).toDateString() === new Date().toDateString()
    ? "used today"
    : `used ${date(when)}`;
}
function InstallGuide({
  id,
  onConnected,
}: {
  id: string;
  onConnected: (connected: boolean) => void;
}) {
  const auth = useContext(Auth);
  const url = window.location.origin;
  const [keys, setKeys] = useState<DeviceKey[] | null>(null),
    [limit, setLimit] = useState(5),
    [pending, setPending] = useState<PendingInstall | null>(null),
    [justConnected, setJustConnected] = useState(""),
    [adding, setAdding] = useState(false),
    [device, setDevice] = useState(""),
    [now, setNow] = useState(Date.now()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/my/keys").then((r) => {
      setKeys(r.keys);
      setLimit(r.limit);
      return r.keys as DeviceKey[];
    });
  useEffect(() => {
    if (auth.email) load().catch((e) => setError(e.message));
  }, [auth.email]);
  const connected = (keys ?? []).filter((k) => lastUse(k));
  const unused = (keys ?? []).filter((k) => !lastUse(k) && k.id !== pending?.id);
  const isConnected = connected.length > 0 || !!justConnected;
  useEffect(() => onConnected(isConnected), [isConnected]);
  const expired = pending ? now > Date.parse(pending.codeExpiresAt) : false;
  useEffect(() => {
    if (!pending || expired) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const fresh = await load().catch(() => null);
      const k = fresh?.find((f) => f.id === pending.id);
      if (k && lastUse(k)) {
        setJustConnected(pending.device);
        setPending(null);
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [pending, expired]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const connect = (name: string) =>
    run(async () => {
      const r = await api("/my/keys", {
        method: "POST",
        body: JSON.stringify({ device: name }),
      });
      setPending({ id: r.id, device: name, code: r.code, codeExpiresAt: r.codeExpiresAt, created: true });
      setNow(Date.now());
      setAdding(false);
      setDevice("");
      await load();
    });
  const reinstall = (k: { id: string; device: string }) =>
    run(async () => {
      const r = await api(`/my/keys/${k.id}/install`, { method: "POST" });
      setPending({ id: k.id, device: k.device, code: r.code, codeExpiresAt: r.codeExpiresAt, created: false });
      setNow(Date.now());
      await load();
    });
  const discard = () =>
    run(async () => {
      if (pending?.created && !justConnected)
        await api(`/my/keys/${pending.id}`, { method: "DELETE" });
      setPending(null);
      await load();
    });
  const remaining = pending ? Math.max(0, Date.parse(pending.codeExpiresAt) - now) : 0;
  const clock = `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;
  const command = pending ? `curl -fsSL ${url}/install | sh -s -- ${pending.code}` : "";
  const prompt = `Use the ${id} skill from the library.`;
  const full = (keys?.length ?? 0) >= limit;
  const form = (
    <form
      className="install-form"
      onSubmit={(e) => {
        e.preventDefault();
        connect(device.trim());
      }}
    >
      <label htmlFor="device-name">Name this computer</label>
      <Input
        id="device-name"
        placeholder="e.g. MacBook"
        maxLength={40}
        value={device}
        onChange={(e) => setDevice(e.target.value)}
      />
      <Button className="w-full" disabled={busy || !device.trim() || full}>
        <Terminal size={15} /> Connect this computer
      </Button>
      <p className="field-help">
        {full
          ? `You've reached ${limit} computers. Remove one under My devices.`
          : "You'll get a one-line command to paste in a terminal."}
      </p>
    </form>
  );
  let step: ReactNode;
  let done = false;
  if (!auth.email) {
    step = (
      <>
        <strong className="step-title">Connect your agent</strong>
        <p>Sign in with your Jelou Google account to get your personal install command.</p>
        <Button asChild variant="outline" className="w-full">
          <a href="/api/auth/google">
            <GoogleMark /> Sign in with Google
          </a>
        </Button>
      </>
    );
  } else if (pending && !expired) {
    step = (
      <>
        <strong className="step-title">Run this on {pending.device}</strong>
        <div className="command-card">
          <div className="command-head">
            <span className={`countdown ${remaining < 60000 ? "warn" : ""}`}>
              <Clock size={13} /> Expires in {clock}
            </span>
            <CopyButton text={command} />
          </div>
          <pre>{command}</pre>
        </div>
        <p>
          Paste it in a terminal. It sets up Claude Code, Codex and Cursor in one
          go. Restart your agent afterwards.
        </p>
        <div className="note waiting">
          <LoaderCircle size={15} />
          <p>
            Waiting for {pending.device} to check in…
            <small>This updates by itself once the command has run.</small>
          </p>
        </div>
        <div className="command-actions">
          <Button variant="outline" onClick={() => setPending(null)}>
            Done
          </Button>
          <button type="button" className="text-link" onClick={discard}>
            Cancel
          </button>
        </div>
      </>
    );
  } else if (pending && expired) {
    step = (
      <>
        <strong className="step-title">Connect your agent</strong>
        <div className="note expired">
          <Clock size={15} />
          <p>
            The command for {pending.device} expired.
            <small>Codes last 10 minutes. Nothing was installed.</small>
          </p>
        </div>
        <Button className="w-full" disabled={busy} onClick={() => reinstall(pending)}>
          <RefreshCw size={15} /> Get a new command for {pending.device}
        </Button>
        <button type="button" className="text-link" onClick={() => discard().then(() => setAdding(true))}>
          Use a different name
        </button>
      </>
    );
  } else if (justConnected) {
    done = true;
    step = (
      <>
        <strong className="step-title">Connected</strong>
        <div className="note success">
          <Check size={15} />
          <p>
            {justConnected} is set up.
            <small>Restart your agent once and it will see the whole library.</small>
          </p>
        </div>
      </>
    );
  } else if (keys === null) {
    step = <strong className="step-title">Connect your agent</strong>;
  } else if ((connected.length || unused.length) && !adding) {
    done = connected.length > 0;
    step = (
      <>
        <strong className="step-title">
          {connected.length
            ? `Connected on ${connected.length} ${connected.length === 1 ? "computer" : "computers"}`
            : "Finish connecting your agent"}
        </strong>
        <div className="devices">
          {[...connected, ...unused].map((k) => (
            <div className="device-row" key={k.id}>
              <Laptop size={14} />
              <span>{deviceName(k)}</span>
              {lastUse(k) ? (
                <span className="when">{usedLabel(k)}</span>
              ) : (
                <button
                  type="button"
                  className="text-link when"
                  disabled={busy}
                  onClick={() => reinstall({ id: k.id, device: deviceName(k) })}
                >
                  Get install command
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="command-actions">
          {!full && (
            <button type="button" className="text-link" onClick={() => setAdding(true)}>
              Add another computer
            </button>
          )}
          <Link to="/devices" className="text-link">
            Manage
          </Link>
        </div>
      </>
    );
  } else {
    step = (
      <>
        <strong className="step-title">Connect your agent</strong>
        <p>Once per computer. Works with Claude Code, Codex and Cursor.</p>
        {form}
        {adding && (keys?.length ?? 0) > 0 && (
          <button type="button" className="text-link" onClick={() => setAdding(false)}>
            Cancel
          </button>
        )}
      </>
    );
  }
  return (
    <Panel
      className="install-card"
      icon={<Plug size={18} />}
      title="Use this skill"
      description="Connect your agent once and it gets every skill in the library, updates included."
    >
      <ol className="install-steps">
        <li>
          <span className={`step-number ${done ? "done" : ""}`}>
            {done ? <Check size={13} /> : "1"}
          </span>
          <div>
            {step}
            <ErrorNote error={error} />
          </div>
        </li>
        <li className={isConnected ? "" : "dim"}>
          <span className="step-number">2</span>
          <div>
            <strong className="step-title">Just ask</strong>
            <p>Your agent picks the right skill on its own. To be explicit:</p>
            <div className="copy-line prompt-line">
              <code>{prompt}</code>
              <CopyButton text={prompt} />
            </div>
          </div>
        </li>
      </ol>
    </Panel>
  );
}
function SkillPage() {
  const { id } = skillRoute.useParams();
  const [loaded, setLoaded] = useState<any>(null),
    [files, setFiles] = useState<SkillFile[]>([]),
    [path, setPath] = useState("SKILL.md"),
    [mode, setMode] = useState<"read" | "source" | "history">("read"),
    [history, setHistory] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [catalog, setCatalog] = useState<SkillSummary[]>([]);
  const auth = useContext(Auth);
  const refresh = async () => {
    const l = await api("/skills/" + id);
    const [b, h] = await Promise.all([
      api("/skills/" + id + "/bundle?revision=" + l.revision),
      api("/skills/" + id + "/history"),
    ]);
    setLoaded(l);
    setFiles(b.files);
    setHistory(h);
    setPath("SKILL.md");
    if (l.metadata.kind === "bundle")
      setCatalog((await api("/skills?limit=500")).items);
  };
  useEffect(() => {
    setLoaded(null);
    setError("");
    setMode("read");
    refresh().catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !(e.target as Element).closest?.(".admin-menu")
      )
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);
  const toggleDisabled = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/skills/" + id + "/status", {
        method: "PATCH",
        body: JSON.stringify({
          disabled: !loaded.metadata.disabled,
          expectedRevision: loaded.revision,
        }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!loaded)
    return (
      <main className="page">
        <ErrorNote error={error} />
        {!error && <Empty>Opening skill…</Empty>}
      </main>
    );
  const visibleFiles = files.filter((f) => !isIconAsset(f.path));
  const currentFile = files.find((f) => f.path === path);
  const binary = currentFile ? atob(currentFile.content).includes("\0") : false;
  const text = currentFile && !binary ? decoded(currentFile.content) : "";
  const updated = history.find((h) => h.revision === loaded.revision)?.createdAt;
  const description = String(loaded.metadata.description ?? "")
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return (
    <main
      className={`page skill-page ${loaded.metadata.disabled ? "is-disabled-detail" : ""}`}
    >
      {loaded.metadata.kind === "bundle" ? (
        <Link to="/bundles" className="back-link">
          <ArrowLeft size={15} /> Bundles
        </Link>
      ) : (
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Library
        </Link>
      )}
      <header className="skill-hero">
        <SkillIconView icon={loaded.metadata.icon} />
        <div className="skill-hero-text">
          <h1>{loaded.metadata.title}</h1>
          {description && <p>{description}</p>}
          <div className="skill-meta">
            {loaded.metadata.tags.map((t: string) => (
              <span className="tag" key={t}>
                {t.replaceAll("-", " ")}
              </span>
            ))}
            {connected && !loaded.metadata.disabled && (
              <span className="skill-available">
                <Check size={14} /> Available to your agents
              </span>
            )}
            {updated && <span>Updated {date(updated)}</span>}
            <span>
              {loaded.metadata.kind === "bundle"
                ? `${loaded.metadata.members.length} ${loaded.metadata.members.length === 1 ? "skill" : "skills"}`
                : `${visibleFiles.length} ${visibleFiles.length === 1 ? "file" : "files"}`}
            </span>
          </div>
        </div>
        <div className="skill-hero-actions">
          {connected ? (
            <CopyButton
              primary
              label="Copy prompt"
              text={`Use the ${id} skill from the library.`}
            />
          ) : (
            <Button
              onClick={() => {
                const field = document.getElementById("device-name");
                (field ?? document.querySelector(".install-card"))?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                field?.focus({ preventScroll: true });
              }}
            >
              <Plug size={15} /> Connect my agent
            </Button>
          )}
          {loaded.referenceId && (
            <CopyButton
              label="Copy reference"
              text={skillReferenceMarkdown(
                loaded.metadata.title,
                loaded.referenceId,
              )}
            />
          )}
          {auth.role === "admin" && (
            <div className="admin-menu">
              <Button
                variant="outline"
                size="icon"
                aria-label="Admin actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreHorizontal size={16} />
              </Button>
              {menuOpen && (
                <div className="menu" role="menu">
                  <div className="menu-label">Admin</div>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      toggleDisabled();
                    }}
                  >
                    {loaded.metadata.disabled ? <Eye size={15} /> : <EyeOff size={15} />}
                    <span>
                      <strong>
                        {loaded.metadata.disabled ? "Show to agents again" : "Hide from agents"}
                      </strong>
                      <span>
                        {loaded.metadata.disabled
                          ? "Agents can find and load this skill again."
                          : "Agents stop seeing this skill. Files, history and bundles are kept. You can bring it back any time."}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      setMode("history");
                    }}
                  >
                    <Clock size={15} />
                    <span>
                      <strong>Version history</strong>
                      <span>
                        Revision {loaded.revision.slice(0, 8)} and older versions.
                      </span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <ErrorNote error={error} />
      {loaded.metadata.disabled && (
        <div className="archive-note hidden-note" role="status">
          <EyeOff size={16} />
          <span>
            Hidden from agents. Files, history and bundles are kept.
          </span>
          {auth.role === "admin" && (
            <Button variant="outline" disabled={busy} onClick={toggleDisabled}>
              <Eye size={15} /> Show to agents again
            </Button>
          )}
        </div>
      )}
      {loaded.metadata.archived && (
        <div className="archive-note">
          Archived · retained for history and existing links.
          {loaded.metadata.replacement && (
            <>
              {" "}
              Use{" "}
              <Link
                to="/skills/$id"
                params={{ id: loaded.metadata.replacement }}
              >
                {loaded.metadata.replacement}
              </Link>
              .
            </>
          )}
        </div>
      )}
      {loaded.metadata.kind === "bundle" && auth.role === "admin" && (
        <BundleComposition loaded={loaded} refresh={refresh} dirty={false} />
      )}
      <div className="skill-layout">
        <aside className="skill-rail">
          <InstallGuide id={id} onConnected={setConnected} />
          {loaded.metadata.kind !== "bundle" && (
          <Panel
            flush
            icon={<Folder size={18} />}
            title="Files"
            badge={<span className="tag">{visibleFiles.length}</span>}
          >
            <div className="skill-files">
              {visibleFiles.map((f) => (
                <button
                  className={path === f.path ? "active" : ""}
                  key={f.path}
                  onClick={() => {
                    setPath(f.path);
                    if (mode === "history") setMode("read");
                  }}
                >
                  <FileText size={14} />
                  <span>{f.path}</span>
                </button>
              ))}
            </div>
            {visibleFiles.some((f) => !/\.(md|txt|json)$/i.test(f.path)) && (
              <details className="settings-disclosure local-copy">
                <summary>Get a local copy</summary>
                <p className="field-help">
                  Only needed when a skill ships scripts. This downloads this
                  version's files to a folder on your computer and prints the
                  path:
                </p>
                <div className="copy-line">
                  <code>{`skillbox fetch ${id}@${loaded.revision}`}</code>
                  <CopyButton text={`skillbox fetch ${id}@${loaded.revision}`} />
                </div>
              </details>
            )}
          </Panel>
          )}
          {auth.role === "admin" && (
            <SkillIntegrations
              id={id}
              revision={loaded.revision}
              selected={loaded.metadata.executorIntegrations ?? []}
              onSaved={refresh}
              disabled={busy}
            />
          )}
        </aside>
        {loaded.metadata.kind === "bundle" ? (
          <Panel
            flush
            className="skill-content"
            icon={<Layers size={18} />}
            title="Skills in this bundle"
            description="Your agent can load any of them on its own, or all of them by asking for the bundle."
          >
            {(loaded.metadata.members as string[])
              .map((m) => catalog.find((c) => c.id === m))
              .filter((c): c is SkillSummary => !!c)
              .map((c) => (
                <Link
                  key={c.id}
                  to="/skills/$id"
                  params={{ id: c.id }}
                  className="library-row"
                >
                  <SkillIconView icon={c.icon} />
                  <div className="library-row-text">
                    <strong>{c.title}</strong>
                    <p>{c.description}</p>
                  </div>
                  {c.kind === "bundle" && (
                    <div className="library-row-tags">
                      <span className="tag">bundle</span>
                    </div>
                  )}
                  <ChevronRight size={18} className="library-row-chevron" />
                </Link>
              ))}
          </Panel>
        ) : (
        <section className="settings-card skill-content">
          <div className="editor-tabs">
            <div>
              <button
                className={mode === "read" ? "active" : ""}
                onClick={() => setMode("read")}
              >
                <BookOpen size={15} /> Preview
              </button>
              <button
                className={mode === "source" ? "active" : ""}
                onClick={() => setMode("source")}
              >
                <Code2 size={15} /> Source
              </button>
              <button
                className={mode === "history" ? "active" : ""}
                onClick={() => setMode("history")}
              >
                <Clock size={15} /> History <span>{history.length}</span>
              </button>
            </div>
            {mode !== "history" && <span>{path}</span>}
          </div>
          {mode === "history" ? (
            <div className="history-list">
              {history.map((h) => (
                <div className="history-row" key={h.revision}>
                  <Clock size={17} />
                  <div>
                    <strong>{h.message}</strong>
                    <p>
                      {h.author} · {new Date(h.createdAt).toLocaleString()} ·{" "}
                      <code>{h.revision.slice(0, 8)}</code>
                    </p>
                  </div>
                  {h.revision === loaded.revision && (
                    <span className="tag">Current</span>
                  )}
                </div>
              ))}
            </div>
          ) : binary ? (
            <Empty>
              Binary asset · {currentFile?.size.toLocaleString()} bytes. Fetch
              the package to use this file.
            </Empty>
          ) : mode === "read" && path.endsWith(".md") ? (
            <article className="markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) =>
                  referenceId(url) ? url : defaultUrlTransform(url)
                }
                components={{
                  a: ({ href, children }) =>
                    href && referenceId(href) ? (
                      <SkillReference id={referenceId(href)!}>
                        {children}
                      </SkillReference>
                    ) : (
                      <a
                        href={
                          href?.startsWith("https://") ||
                          href?.startsWith("http://")
                            ? href
                            : undefined
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          if (href && !/^https?:/.test(href)) {
                            e.preventDefault();
                            const base = path.split("/").slice(0, -1);
                            for (const part of href.split("#")[0].split("/")) {
                              if (part === "..") base.pop();
                              else if (part && part !== ".") base.push(part);
                            }
                            const candidate = base.join("/");
                            if (files.some((f) => f.path === candidate))
                              setPath(candidate);
                            else
                              setError(
                                "Reference is outside this package. Load its skill or fetch it on the execution host.",
                              );
                          }
                        }}
                      >
                        {children}
                      </a>
                    ),
                  img: ({ alt }) => (
                    <span className="tag">
                      Image: {alt ?? "bundled asset"} — available in package
                    </span>
                  ),
                }}
              >
                {text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")}
              </ReactMarkdown>
            </article>
          ) : (
            <pre className="code-preview">{text}</pre>
          )}
        </section>
        )}
      </div>
    </main>
  );
}
function MemberPicker({
  catalog,
  selected,
  onChange,
}: {
  catalog: SkillSummary[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <fieldset className="member-picker">
      <legend>Included skills and bundles</legend>
      <Input
        aria-label="Find bundle members"
        placeholder="Find a skill or bundle…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="member-options">
        {catalog
          .filter((s) =>
            (s.id + " " + s.description)
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, s.id]
                      : selected.filter((id) => id !== s.id),
                  )
                }
              />
              <span>
                {s.title} {s.disabled && <span className="tag">disabled</span>}
                {s.kind === "bundle" && <span className="tag">bundle</span>}
              </span>
            </label>
          ))}
      </div>
      <small>
        {selected.length} selected. Nested bundles share their members
        automatically. Disabled members stay selected but are skipped by agents.
      </small>
    </fieldset>
  );
}
function BundleComposition({
  loaded,
  refresh,
  dirty,
}: {
  loaded: any;
  refresh: () => Promise<void>;
  dirty: boolean;
}) {
  const [editing, setEditing] = useState(false),
    [catalog, setCatalog] = useState<SkillSummary[]>([]),
    [members, setMembers] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const auth = useContext(Auth);
  const composition = loaded.composition;
  return (
    <section className="bundle-composition">
      <div className="bundle-heading">
        <h2>
          <Layers size={20} /> Bundle composition
        </h2>
        <span>{composition?.skills.length ?? 0} unique skills</span>
        {auth.role === "admin" && (
          <Button
            variant="outline"
            disabled={dirty || busy}
            onClick={async () => {
              try {
                setCatalog(
                  (await api("/skills?includeDisabled=true")).items.filter(
                    (s: SkillSummary) => s.id !== loaded.id,
                  ),
                );
                setMembers(loaded.metadata.members);
                setEditing(!editing);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Edit members
          </Button>
        )}
      </div>
      <div className="bundle-members">
        {composition?.members.map((id: string) => {
          const bundle = composition.bundles.find((s: any) => s.id === id);
          const skill = composition.skills.find((s: any) => s.id === id);
          return (
            <Link to="/skills/$id" params={{ id }} key={id}>
              {bundle ? <Layers size={14} /> : <FileText size={14} />}
              {bundle?.title ?? skill?.title ?? id}
            </Link>
          );
        })}
      </div>
      {editing && (
        <>
          <MemberPicker
            catalog={catalog}
            selected={members}
            onChange={setMembers}
          />
          <Button
            disabled={busy || dirty}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/bundles/" + loaded.id, {
                  method: "PUT",
                  body: JSON.stringify({
                    title: loaded.metadata.title,
                    description: loaded.metadata.description,
                    members,
                    expectedRevision: loaded.revision,
                  }),
                });
                await refresh();
                setEditing(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Save members
          </Button>
        </>
      )}
      <ErrorNote error={error} />
      <details>
        <summary>Resolved skills · shared members appear once</summary>
        <div className="bundle-members">
          {composition?.skills.map((s: SkillSummary) => (
            <Link to="/skills/$id" params={{ id: s.id }} key={s.id}>
              {s.title}
            </Link>
          ))}
        </div>
      </details>
    </section>
  );
}
function ActivityPage() {
  const [operation, setOperation] = useState("reads"),
    [skillId, setSkillId] = useState(""),
    [offset, setOffset] = useState(0);
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api(
      `/events?operation=${operation}&skillId=${encodeURIComponent(skillId)}&offset=${offset}`,
    )
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [operation, skillId, offset]);
  return (
    <main className="page">
      <PageHeader
        title="Activity"
        description="Every read, search and reported use from connected agents."
      />
      <ErrorNote error={error} />
      <Panel
        flush
        toolbar={
          <>
        <select
          aria-label="Activity type"
          value={operation}
          onChange={(e) => {
            setOperation(e.target.value);
            setOffset(0);
          }}
        >
          <option value="reads">Agent reads (not usage)</option>
          <option value="usage">Reported usage</option>
          <option value="web">Workspace browsing</option>
          <option value="legacy">Legacy · source unknown</option>
        </select>
        <Input
          aria-label="Skill ID"
          placeholder="Filter by exact skill ID"
          value={skillId}
          onChange={(e) => {
            setSkillId(e.target.value);
            setOffset(0);
          }}
        />
          </>
        }
        footer={
          <>
            <details className="usage-definition">
        <summary>What counts?</summary>
        <p>
          Discovery lists descriptions only. Reads load instructions, files or a
          package and can include bulk audits. Usage requires an explicit agent
          report. Client keys identify the caller; harness and model names are
          self-reported. Historical records lack source details and cannot
          establish usage.
        </p>
            </details>
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={items.length < 100}
              onClick={() => setOffset(offset + 100)}
            >
              Next
            </Button>
          </>
        }
      >
      {items.length ? (
        <div className="activity-list">
          {items.map((e) => (
            <div key={e.id}>
              <span className="event-dot" />
              <strong>{e.clientName}</strong>
              <span className="event-operation">
                {{
                  load: "Read instructions",
                  read_file: "Read file",
                  bundle: "Fetched package",
                  reported_use: "Reported use",
                  browse: "Listed index",
                  search: "Searched index",
                }[e.operation as string] ?? e.operation.replaceAll("_", " ")}
              </span>
              {e.skillId ? (
                <Link to="/skills/$id" params={{ id: e.skillId }}>
                  {e.skillId}
                </Link>
              ) : (
                <span>Library index</span>
              )}
              <time>{new Date(e.createdAt).toLocaleString()}</time>
              <details className="event-details">
                <summary>Details</summary>
                <dl>
                  {Object.entries({ ...e.context, clientId: e.clientId }).map(
                    ([k, v]) => (
                      <React.Fragment key={k}>
                        <dt>{k}</dt>
                        <dd>{String(v ?? "Unknown")}</dd>
                      </React.Fragment>
                    ),
                  )}
                  {!e.context?.model && (
                    <>
                      <dt>model</dt>
                      <dd>Not reported</dd>
                    </>
                  )}
                  {!e.context?.harness && (
                    <>
                      <dt>harness</dt>
                      <dd>Not reported</dd>
                    </>
                  )}
                </dl>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Activity size={18} />}
          title="No activity yet"
          description="Reads, searches and reported uses appear here once an agent connects with a client key."
        />
      )}
      </Panel>
    </main>
  );
}
type MyKey = DeviceKey;
function MyKeys() {
  const url = window.location.origin;
  const [keys, setKeys] = useState<MyKey[]>([]),
    [limit, setLimit] = useState(5),
    [device, setDevice] = useState(""),
    [created, setCreated] = useState<{ key: string; code: string } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api("/my/keys").then((r) => {
      setKeys(r.keys);
      setLimit(r.limit);
    });
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  const installCommand = created
    ? `curl -fsSL ${url}/install | sh -s -- ${created.code}`
    : "";
  const claudeCommand = created
    ? `claude mcp add --scope user --transport http skillbox ${url}/mcp --header "Authorization: Bearer ${created.key}"`
    : "";
  return (
    <>
      <ErrorNote error={error} />
      {created && (
        <Panel
          icon={<KeyRound size={18} />}
          title="Install on this device"
          description="Run this in a terminal within 10 minutes. It connects Claude Code, Codex and Cursor, installs the library skill and the skillbox command."
          footer={
            <Button variant="outline" onClick={() => setCreated(null)}>
              Done
            </Button>
          }
        >
          <div className="code-block command-block">
            <CopyButton text={installCommand} />
            <pre>{installCommand}</pre>
          </div>
          <details className="settings-disclosure">
            <summary>Set it up by hand instead</summary>
            <p className="field-help">
              The key is shown only once. For Claude Code over HTTP:
            </p>
            <div className="code-block command-block">
              <CopyButton text={claudeCommand} />
              <pre>{claudeCommand}</pre>
            </div>
            <div className="copy-line">
              <code>{created.key}</code>
              <CopyButton text={created.key} label="Copy key" />
            </div>
          </details>
        </Panel>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            setCreated(
              await api("/my/keys", {
                method: "POST",
                body: JSON.stringify({ device }),
              }),
            );
            setDevice("");
            await refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Panel
          flush
          icon={<Plug size={18} />}
          title="Connected computers"
          description={`Each computer gets its own key, so you can remove a lost laptop without touching the others. Up to ${limit}.`}
          toolbar={
            <>
              <Input
                aria-label="Device name"
                placeholder="Device name, e.g. MacBook"
                maxLength={40}
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              />
              <Button disabled={busy || !device.trim() || keys.length >= limit}>
                <Terminal size={15} /> Connect a computer
              </Button>
            </>
          }
        >
          {keys.map((k) => (
            <div className="client-row" key={k.id}>
              <div className="client-avatar">
                <Laptop size={18} />
              </div>
              <div className="client-identity">
                <strong>{deviceName(k)}</strong>
                <p>
                  {lastUse(k) ? (
                    <span className="skill-available">
                      <Check size={13} /> Connected · {usedLabel(k)}
                    </span>
                  ) : (
                    "Not set up yet. Open any skill to get its install command."
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Revoke ${k.name}`}
                title="Revoke"
                disabled={busy}
                onClick={async () => {
                  setError("");
                  try {
                    await api(`/my/keys/${k.id}`, { method: "DELETE" });
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {!keys.length && (
            <EmptyState
              icon={<KeyRound size={18} />}
              title="No keys yet"
              description="Name this device and create a key to connect Claude Code, Codex or Cursor."
            />
          )}
        </Panel>
      </form>
    </>
  );
}
function ConnectPage() {
  const url = window.location.origin;
  const auth = useContext(Auth);
  const [error, setError] = useState("");
  const snippet = JSON.stringify(
    {
      mcpServers: {
        skillbox: {
          command: "node",
          args: ["/absolute/path/to/skillbox.mjs", "mcp"],
          env: { SKILLBOX_URL: url, SKILLBOX_TOKEN: "YOUR_CLIENT_KEY" },
        },
      },
    },
    null,
    2,
  );
  return (
    <main className="page connect-page">
      <PageHeader
        title="My devices"
        description={
          auth.role === "admin"
            ? "Your connected computers, plus manual setup for shared agents."
            : "Computers where your agent is connected to the library. Remove one to cut its access."
        }
      />
      <ErrorNote error={error} />
      {auth.email && <MyKeys />}
      {auth.role === "admin" && (
      <>
      <Panel
        icon={<span className="step-number">1</span>}
        title="Create a client key"
        description="Use a different key for each agent so you can change access independently."
        footer={
          <Button variant="outline" asChild>
            <Link to="/clients">
              <KeyRound size={15} /> Manage clients <ArrowUpRight size={14} />
            </Link>
          </Button>
        }
      />
      <Panel
        icon={<span className="step-number">2</span>}
        title="Connect the library"
        description="For clients that support HTTP MCP, add this endpoint with a Bearer token."
      >
        <div className="copy-line">
          <code>{url}/mcp</code>
          <CopyButton text={url + "/mcp"} />
        </div>
        <details className="settings-disclosure">
          <summary>Use the stdio bridge instead</summary>
          <p className="field-help">
            Download these two files into the same directory, then add the
            config below. Requires Node 20+ or Bun.
          </p>
          <div className="download-links">
            <a href="/cli/skillbox.mjs" download>
              skillbox.mjs <Download size={13} />
            </a>
            <a href="/cli/package.mjs" download>
              package.mjs <Download size={13} />
            </a>
          </div>
          <div className="code-block">
            <CopyButton text={snippet} />
            <pre>{snippet}</pre>
          </div>
          <p className="field-help">
            Replace the file path and YOUR_CLIENT_KEY in your agent's local MCP
            configuration. Use a protected config file or secret environment
            variable.
          </p>
        </details>
      </Panel>
      <Panel
        icon={<span className="step-number">3</span>}
        title="Install the bootstrap skill"
        description="It teaches your agent to browse the library at task start, load the right workflow, and fetch scripts on the right machine."
        footer={
          <Button variant="outline" asChild>
            <a href="/bootstrap/SKILL.md" download="SKILL.md">
              <Download size={15} /> Download SKILL.md
            </a>
          </Button>
        }
      >
        <p className="field-help">
          Place it in your agent's native skills directory as
          skills-library/SKILL.md.
        </p>
      </Panel>
      </>
      )}
      <div className="connect-note">
        <ShieldCheck size={18} />
        <p>
          The library provides instructions and files. Your agent's existing
          tools handle execution and service permissions.
        </p>
      </div>
    </main>
  );
}
const rootRoute = createRootRoute({ component: Shell });
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: ExecutorSettings,
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LibraryPage,
});
const bundlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bundles",
  component: BundlesPage,
});
const skillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills/$id",
  component: SkillPage,
});
const profilesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profiles",
  component: ProfilesPage,
});
const proposalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/proposals",
  component: ProposalsPage,
});
const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/clients",
  component: ClientsPage,
});
const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: ActivityPage,
});
const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  component: PeoplePage,
});
const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/connect",
  component: ConnectPage,
});
const devicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/devices",
  component: ConnectPage,
});
const router = createRouter({
  defaultViewTransition: !window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches,
  routeTree: rootRoute.addChildren([
    indexRoute,
    bundlesRoute,
    skillRoute,
    clientsRoute,
    peopleRoute,
    profilesRoute,
    proposalsRoute,
    activityRoute,
    settingsRoute,
    connectRoute,
    devicesRoute,
  ]),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
