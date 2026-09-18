import type { ReactNode } from "react";

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
