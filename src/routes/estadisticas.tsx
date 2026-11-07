import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { useMed } from "@/lib/med/store";
import { isToday, money, orderTotals } from "@/lib/ruta/format";

export const Route = createFileRoute("/estadisticas")({
  component: StatsPage,
});

const COLORS = ["var(--color-teal)", "var(--color-blue)", "var(--color-pause)", "var(--color-section)", "var(--color-blue-deep)", "var(--color-ink)"];

function StatsPage() {
  const orders = useMed((state) => state.orders);
  const people = useMed((state) => state.people);
  const catalog = useMed((state) => state.catalog);
  const today = orders.filter((order) => isToday(order.createdAt) && order.delivery !== "failed");
  const sales = today.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const notes = today.length;
  const ticket = notes === 0 ? 0 : Math.round(sales / notes);
  const gain = today.reduce((sum, order) => {
    const lines = order.lines.reduce((inner, line) => {
      const cost = catalog.find((product) => product.id === line.productId)?.cost ?? 0;
      return inner + (line.price - cost) * line.qty;
    }, 0);
    return sum + lines * (1 - order.discountPct / 100);
  }, 0);
  const hours = hourly(today);
  const products = ranking(today, catalog);
  const crew = byPerson(today, people);
  const label = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long" }).format(new Date());

  return (
    <Shell>
      <PageTitle title="Estadísticas" hint="Resultados de hoy. Cada persona, sus notas y el valor." />
      <p className="mt-4 rounded-2xl border border-line bg-card px-4 py-3 text-center text-sm font-semibold text-ink">Hoy: {label}</p>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
        <StatRow label="Facturación" value={money(sales)} hint={`Mejor tramo ${bestHour(hours)}`} series={hours.map((row) => row.total)} />
        <StatRow label="Ventas" value={String(notes)} hint="Notas que no fueron incidencia" series={hours.map((row) => row.count)} />
        <StatRow label="Ticket medio" value={money(ticket)} hint={notes === 0 ? "Sin notas" : `${notes} notas`} series={hours.map((row) => (row.count ? Math.round(row.total / row.count) : 0))} />
        <StatRow label="Ganancia" value={money(Math.round(gain))} hint="Precio menos costo. Si el costo está en cero, cuenta todo el precio." series={hours.map((row) => row.total)} />
      </ul>

      <h2 className="mt-8 text-lg font-extrabold text-section">Facturación por hora</h2>
      <HourChart rows={hours} />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-3">Hora</th>
              <th className="px-3 py-3">Facturación</th>
              <th className="px-3 py-3">Ventas</th>
              <th className="px-3 py-3">Ticket</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((row) => (
              <tr key={row.hour} className="border-t border-line">
                <td className="px-3 py-3 font-semibold">{row.hour}h</td>
                <td className="px-3 py-3 tabular-nums">{money(row.total)}</td>
                <td className="px-3 py-3 tabular-nums">{row.count}</td>
                <td className="px-3 py-3 tabular-nums">{row.count ? money(Math.round(row.total / row.count)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-extrabold text-section">Productos más vendidos por valor</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-3">Nombre</th>
              <th className="px-3 py-3">Valor</th>
              <th className="px-3 py-3">Ctd</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={3}>
                  Hoy no hay ventas.
                </td>
              </tr>
            ) : null}
            {products.map((row, index) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-3">
                  <span className="mr-2 text-muted">{index + 1}</span>
                  {row.name}
                </td>
                <td className="px-3 py-3 font-semibold text-teal tabular-nums">{money(row.amount)}</td>
                <td className="px-3 py-3 tabular-nums">{row.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-lg font-extrabold text-section">Ventas por usuario</h2>
      <p className="mt-1 text-sm text-muted">
        Número de notas: {notes} / {money(sales)}
      </p>
      <Donut parts={crew.map((row, index) => ({ value: row.amount, color: COLORS[index % COLORS.length] }))} />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-3">Usuario</th>
              <th className="px-3 py-3">Notas</th>
              <th className="px-3 py-3">Valor</th>
            </tr>
          </thead>
          <tbody>
            {crew.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={3}>
                  Nadie tiene notas hoy.
                </td>
              </tr>
            ) : null}
            {crew.map((row, index) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-3">
                  <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                  {row.name}
                </td>
                <td className="px-3 py-3 tabular-nums">{row.count}</td>
                <td className="px-3 py-3 font-semibold tabular-nums">
                  {money(row.amount)}
                  <span className="ml-2 text-muted">{sales ? `${Math.round((row.amount / sales) * 1000) / 10}%` : ""}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function StatRow({ label, value, hint, series }: { label: string; value: string; hint: string; series: number[] }) {
  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{label}</p>
        <p className="text-2xl font-extrabold text-teal tabular-nums">{value}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <Spark values={series} />
    </li>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const width = 112;
  const height = 36;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - (value / max) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-28 text-teal" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function HourChart({ rows }: { rows: { hour: number; total: number }[] }) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  const width = 320;
  const height = 120;
  const points = rows
    .map((row, index) => {
      const x = (index / Math.max(rows.length - 1, 1)) * (width - 16) + 8;
      const y = height - (row.total / max) * (height - 16) - 8;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-32 w-full text-teal" role="img" aria-label="Facturación por hora">
      <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={points} />
    </svg>
  );
}

function Donut({ parts }: { parts: { value: number; color: string }[] }) {
  const used = parts.filter((part) => part.value > 0);
  const total = used.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) {
    return <div className="mx-auto mt-4 size-40 rounded-full border-8 border-line" />;
  }
  let cursor = 0;
  const stops = used.map((part) => {
    const start = cursor;
    cursor += (part.value / total) * 100;
    return `${part.color} ${start}% ${cursor}%`;
  });
  return (
    <div className="relative mx-auto mt-4 size-44 rounded-full" style={{ background: `conic-gradient(${stops.join(",")})` }}>
      <div className="absolute inset-8 rounded-full bg-card" />
    </div>
  );
}

function hourly(orders: { createdAt: string; lines: { productId: string; qty: number; price: number }[]; discountPct: number }[]) {
  const rows = [];
  for (let hour = 8; hour <= 19; hour += 1) {
    const mine = orders.filter((order) => new Date(order.createdAt).getHours() === hour);
    rows.push({
      hour,
      count: mine.length,
      total: mine.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0),
    });
  }
  return rows;
}

function bestHour(rows: { hour: number; total: number }[]) {
  const best = rows.reduce((win, row) => (row.total > win.total ? row : win), rows[0]);
  return best && best.total > 0 ? `${best.hour}h` : "sin movimiento";
}

function ranking(
  orders: { lines: { productId: string; qty: number; price: number }[]; discountPct: number }[],
  catalog: { id: string; name: string }[],
) {
  const map = new Map<string, { id: string; name: string; qty: number; amount: number }>();
  for (const order of orders) {
    const factor = 1 - order.discountPct / 100;
    for (const line of order.lines) {
      const current = map.get(line.productId) ?? {
        id: line.productId,
        name: catalog.find((product) => product.id === line.productId)?.name ?? "Producto",
        qty: 0,
        amount: 0,
      };
      current.qty += line.qty;
      current.amount += Math.round(line.qty * line.price * factor);
      map.set(line.productId, current);
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 15);
}

function byPerson(
  orders: { sellerId: string; lines: { productId: string; qty: number; price: number }[]; discountPct: number }[],
  people: { id: string; name: string; kind: string }[],
) {
  const ids = new Set(orders.map((order) => order.sellerId));
  return [...ids]
    .map((id) => {
      const mine = orders.filter((order) => order.sellerId === id);
      return {
        id,
        name: people.find((person) => person.id === id)?.name ?? "Sin nombre",
        count: mine.length,
        amount: mine.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
