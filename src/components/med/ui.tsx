import type { ReactNode } from "react";

export function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "blue" | "ok" | "muted" | "danger";
}) {
  const toneClass = {
    blue: "bg-blue-soft text-blue-deep",
    ok: "bg-blue-soft text-ok",
    muted: "bg-line text-ink",
    danger: "bg-blue-soft text-danger",
  }[tone];
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

export function ProductMark({ name, image, size = "size-16" }: { name: string; image: string; size?: string }) {
  if (image) return <img src={image} alt="" loading="lazy" decoding="async" className={`${size} shrink-0 rounded-xl object-cover`} />;
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-xl bg-blue-soft text-lg font-extrabold text-blue-deep`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-3">
      <p className="text-xs font-semibold tracking-wide text-kicker uppercase">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-title">{value}</p>
      {hint ? <p className="mt-1 text-xs text-hint">{hint}</p> : null}
    </div>
  );
}

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight text-title">{title}</h1>
      {hint ? <p className="mt-1 text-sm font-medium text-kicker">{hint}</p> : null}
    </div>
  );
}

export function PinLegend({ mode }: { mode: "visita" | "entrega" }) {
  const items =
    mode === "entrega"
      ? [
          ["bg-blue", "Azul · pendiente"],
          ["bg-ok", "Verde · entregado"],
        ]
      : [
          ["bg-[#8aa0b3]", "Gris · falta pasar"],
          ["bg-blue", "Azul · pasó, no pidió"],
          ["bg-ok", "Verde · con pedido"],
        ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-hint">
      {items.map(([tone, label]) => (
        <li key={label} className="inline-flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${tone}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
