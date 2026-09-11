import React from "react";

/**
 * Shared page shell for all admin console pages.
 *
 * Keeps the kicker/title/description header and card wrapper consistent
 * across the dashboard and the sidebar destinations so every page reads as
 * part of the same console.
 */
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
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8ea3bb]">{kicker}</p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-white">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#8ea3bb]">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** Standard card wrapper used by every admin page body. */
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
    <div className={`overflow-hidden rounded-xl border border-[#1a2737] bg-[#0b131e] shadow-lg ${className}`}>
      <div className="border-b border-[#1a2737] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[10px] text-[#8ea3bb]">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}
