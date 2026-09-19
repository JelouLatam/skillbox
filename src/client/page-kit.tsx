import { useEffect, useState, type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="standard-heading page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  icon,
  title,
  description,
  badge,
  toolbar,
  footer,
  flush,
  className = "",
  children,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`settings-card ${className}`}>
      {title && (
        <header className="settings-card-header">
          {icon && <div className="settings-card-icon">{icon}</div>}
          <div className="settings-card-title">
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {badge}
        </header>
      )}
      {toolbar && <div className="panel-toolbar">{toolbar}</div>}
      {children && (
        <div className={flush ? "panel-flush" : "settings-card-body"}>
          {children}
        </div>
      )}
      {footer && <footer className="settings-card-footer">{footer}</footer>}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="settings-card-icon">{icon}</div>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

const AVATAR_GRADIENTS = [
  ["#00B3C7", "#5ED5E3"],
  ["#1F3A5F", "#00B3C7"],
  ["#FFB547", "#F07167"],
  ["#7C5CFF", "#00B3C7"],
  ["#18BA81", "#5ED5E3"],
  ["#F07167", "#7C5CFF"],
];

function initials(name: string) {
  const words = name
    .split("@")[0]
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)
  ).toUpperCase();
}

export function UserAvatar({
  name,
  seed = name,
  size = 32,
}: {
  name: string;
  seed?: string;
  size?: number;
}) {
  let hash = 0;
  for (const char of seed.toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return (
    <span
      className="user-avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Keeps a popover mounted briefly after it closes so its exit animation can play. */
export function usePresence(open: boolean, exitMs = 120) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) return setMounted(true);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return {
    mounted: open || mounted,
    state: open ? "open" : "closed",
  } as const;
}
