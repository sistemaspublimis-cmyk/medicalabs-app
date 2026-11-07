import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CompareBars } from "@/components/med/compare-bars";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { buildDayWorkbook, downloadReport, reportFilename } from "@/lib/med/excel";
import { changeText, driverCompare, driverStatus, productCompare, sellerCompare } from "@/lib/med/report";
import { useMed } from "@/lib/med/store";
import { addDays, shortDay } from "@/lib/med/weeks";
import { money, todayKey } from "@/lib/ruta/format";

export const Route = createFileRoute("/rendimiento")({
  component: PerformancePage,
});

type Tab = "equipo" | "productos" | "reparto";

function PerformancePage() {
  const orders = useMed((state) => state.orders);
  const visits = useMed((state) => state.visits);
  const people = useMed((state) => state.people);
  const clients = useMed((state) => state.clients);
  const catalog = useMed((state) => state.catalog);
  const journal = useMed((state) => state.journal) ?? [];
  const weekPlans = useMed((state) => state.weekPlans) ?? [];
  const daySpend = useMed((state) => state.daySpend);
  const today = todayKey();
  const [day, setDay] = useState(today);
  const [other, setOther] = useState(addDays(today, -1));
  const [tab, setTab] = useState<Tab>("equipo");
  const [note, setNote] = useState("");
  const sellers = sellerCompare(orders, visits, people, clients, day, other);
  const drivers = driverCompare(orders, people, day, other);
  const products = productCompare(orders, catalog, day, other);
  const dayLabel = shortDay(day);
  const otherLabel = shortDay(other);

  return (
    <Shell>
      <PageTitle title="Rendimiento" hint="Compara un día con otro. Las gráficas y el Excel usan esas dos fechas." />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold">
          Día
          <input type="date" value={day} onChange={(event) => setDay(event.target.value || today)} className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3" />
        </label>
        <label className="text-sm font-semibold">
          Comparar con
          <input type="date" value={other} onChange={(event) => setOther(event.target.value || addDays(day, -1))} className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3" />
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          const body = buildDayWorkbook({ day, other, orders, visits, people, clients, catalog, journal, weekPlans, daySpend });
          void downloadReport(reportFilename(day), body).then(setNote);
        }}
        className="mt-3 h-12 w-full rounded-xl bg-blue font-semibold text-card"
      >
        Descargar Excel de este día
      </button>
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      <p className="mt-2 text-sm text-muted">
        El archivo trae resumen, pedidos, equipo, productos, reparto, pendientes, la ruta de la semana y la bitácora.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Tipo de rendimiento">
        <TabButton active={tab === "equipo"} label="Equipo" onClick={() => setTab("equipo")} />
        <TabButton active={tab === "productos"} label="Productos" onClick={() => setTab("productos")} />
        <TabButton active={tab === "reparto"} label="Reparto" onClick={() => setTab("reparto")} />
      </div>
      {tab === "equipo" ? (
        <section className="mt-4">
          <h2 className="text-lg font-extrabold text-section">Preventa</h2>
          <CompareBars
            rows={sellers.map((row) => ({ name: row.name.split(" ")[0] ?? row.name, a: row.sales, b: row.otherSales }))}
            aLabel={dayLabel}
            bLabel={otherLabel}
            format={money}
          />
          <ul className="mt-3 flex flex-col gap-2">
            {sellers.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-muted">{row.routeName}</p>
                  </div>
                  <p className="font-extrabold text-blue-deep tabular-nums">{changeText(row.sales, row.otherSales, true)}</p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {dayLabel}: {money(row.sales)} · {row.orders} pedidos · {row.visits} visitas
                </p>
                <p className="text-sm text-muted">
                  {otherLabel}: {money(row.otherSales)} · {row.otherOrders} pedidos · {row.otherVisits} visitas
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === "productos" ? (
        <section className="mt-4">
          <h2 className="text-lg font-extrabold text-section">Productos</h2>
          <CompareBars
            rows={products.slice(0, 8).map((row) => ({ name: row.name, a: row.qty, b: row.otherQty }))}
            aLabel={dayLabel}
            bLabel={otherLabel}
            format={(value) => `${value} pzas`}
          />
          {products.length === 0 ? <p className="mt-2 text-sm text-muted">Ningún producto se movió en estas fechas.</p> : null}
          <ul className="mt-3 flex flex-col gap-2">
            {products.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{row.name}</p>
                  <p className="font-extrabold text-blue-deep tabular-nums">{changeText(row.qty, row.otherQty)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {dayLabel}: {row.qty} pzas · {money(row.amount)}
                </p>
                <p className="text-sm text-muted">
                  {otherLabel}: {row.otherQty} pzas · {money(row.otherAmount)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === "reparto" ? (
        <section className="mt-4">
          <h2 className="text-lg font-extrabold text-section">Repartidores</h2>
          <CompareBars
            rows={drivers.map((row) => ({ name: row.name.split(" ")[0] ?? row.name, a: row.delivered, b: row.otherDelivered }))}
            aLabel={`Entregas ${dayLabel}`}
            bLabel={`Entregas ${otherLabel}`}
            format={(value) => String(value)}
          />
          <ul className="mt-3 flex flex-col gap-2">
            {drivers.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-muted">{row.routeName}</p>
                  </div>
                  <p className="text-sm font-semibold text-blue-deep">{driverStatus(row)}</p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {dayLabel}: {row.delivered} entregadas · {row.pending} pendientes · {row.failed} no entregadas
                </p>
                <p className="text-sm text-muted">
                  {otherLabel}: {row.otherDelivered} entregadas · {row.otherPending} pendientes · {row.otherFailed} no entregadas
                </p>
                <p className="mt-1 text-sm">Cambio de entregas: {changeText(row.delivered, row.otherDelivered)}</p>
              </li>
            ))}
          </ul>
          <Link to="/rutas" className="mt-3 inline-flex h-11 items-center font-semibold text-blue-deep">
            Repartir la ruta de la semana
          </Link>
        </section>
      ) : null}
    </Shell>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={"h-11 rounded-xl border text-sm font-semibold " + (active ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-card")}
    >
      {label}
    </button>
  );
}
