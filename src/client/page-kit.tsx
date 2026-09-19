import type { ReactNode } from "react";
import Avatar from "boring-avatars";

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

const AVATAR_COLORS = ["#00B3C7", "#5ED5E3", "#1F3A5F", "#FFB547", "#F07167"];

export function UserAvatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span className="user-avatar" style={{ width: size, height: size }}>
      <Avatar variant="marble" name={name} colors={AVATAR_COLORS} size={size} title={false} />
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
