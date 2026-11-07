import type { ReactNode } from "react";

export function Chip({
  tone,
  children,
}: {
  tone: "pending" | "visited" | "ordered" | "sync" | "local";
  children: ReactNode;
}) {
  const toneClass = {
    pending: "bg-line text-ink",
    visited: "bg-amber-soft text-amber",
    ordered: "bg-teal-soft text-teal",
    sync: "bg-teal-soft text-ok",
    local: "bg-amber-soft text-amber",
  }[tone];
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-3">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl leading-none tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center rounded-xl bg-teal px-4 text-base font-semibold text-card disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center rounded-xl border border-line bg-card px-4 text-base font-semibold text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
