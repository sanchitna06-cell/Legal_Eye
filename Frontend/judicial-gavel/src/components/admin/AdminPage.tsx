import React from "react";


export function AdminPage({
  kicker,
  title,
  description,
  actions,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div className="admin-page__heading">
          <p className="admin-page__kicker">
            {kicker}
          </p>

          <h1 className="admin-page__title">
            {title}
          </h1>

          <p className="admin-page__description">
            {description}
          </p>
        </div>

        {actions ? (
          <div className="admin-page__actions">
            {actions}
          </div>
        ) : null}
      </header>

      <div className="admin-page__body">
        {children}
      </div>
    </div>
  );
}


/* ================================================================
   STANDARD ADMIN CARD
   ================================================================ */

export function AdminCard({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`admin-card ${className}`}>
      <div className="admin-card__header">
        <div className="admin-card__heading">
          <h3 className="admin-card__title">
            {title}
          </h3>

          {subtitle ? (
            <p className="admin-card__subtitle">
              {subtitle}
            </p>
          ) : null}
        </div>

        {action ? (
          <div className="admin-card__action">
            {action}
          </div>
        ) : null}
      </div>

      <div className="admin-card__body">
        {children}
      </div>
    </section>
  );
}