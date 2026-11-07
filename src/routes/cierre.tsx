import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/med/shell";
import { PageTitle, Stat } from "@/components/med/ui";
import { dayFigures, driverDays, lowOnRoute, movedToday, sellerDays, spendForToday } from "@/lib/med/cierre";
import { buildDayWorkbook, downloadReport, reportFilename } from "@/lib/med/excel";
import { useMed } from "@/lib/med/store";
import { addDays } from "@/lib/med/weeks";
import { clock, isToday, money, nowLabel, todayKey } from "@/lib/ruta/format";

export const Route = createFileRoute("/cierre")({
  component: ClosePage,
});

function DayLog() {
  const sessions = useMed((state) => state.sessions) ?? [];
  const shifts = useMed((state) => state.shifts) ?? [];
  const people = useMed((state) => state.people);
  const entered = sessions.filter((mark) => isToday(mark.at));
  const worked = shifts.filter((shift) => isToday(shift.startedAt));
  return (
    <section className="mt-6">
      <h2 className="text-lg font-extrabold text-section">Entradas y jornada</h2>
      <p className="mt-1 text-sm text-muted">Hora en que cada persona inició sesión y cómo va su periodo laboral.</p>
      {entered.length === 0 ? <p className="mt-3 text-sm text-muted">Hoy todavía no hay entradas.</p> : null}
      <ul className="mt-3 flex flex-col gap-2">
        {entered.map((mark) => (
          <li key={mark.id} className="rounded-2xl border border-line bg-card p-3">
            <p className="font-semibold">{mark.name}</p>
            <p className="text-sm text-muted">Inició sesión {clock(mark.at)}</p>
          </li>
        ))}
      </ul>
      {worked.length === 0 ? <p className="mt-3 text-sm text-muted">Hoy no hay periodos laborales.</p> : null}
      <ul className="mt-3 flex flex-col gap-2">
        {worked.map((shift) => {
          const name = people.find((person) => person.id === shift.personId)?.name ?? "Ruta";
          const state = shift.status === "working" ? "En ruta" : shift.status === "paused" ? "En pausa" : "Terminado";
          return (
            <li key={shift.id} className="rounded-2xl border border-line bg-card p-3">
              <p className="font-semibold">
                {name} · {state}
              </p>
              <p className="text-sm text-muted">
                Empezó {clock(shift.startedAt)}
                {shift.endedAt ? ` · terminó ${clock(shift.endedAt)}` : ""}
              </p>
              {shift.pauses.map((pause) => (
                <p key={pause.from} className="text-sm text-muted">
                  Pausa {clock(pause.from)}
                  {pause.to ? ` a ${clock(pause.to)}` : ""}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ClosePage() {
  const orders = useMed((state) => state.orders);
  const visits = useMed((state) => state.visits);
  const people = useMed((state) => state.people);
  const catalog = useMed((state) => state.catalog);
  const loads = useMed((state) => state.loads);
  const daySpend = useMed((state) => state.daySpend);
  const clients = useMed((state) => state.clients);
  const setDaySpend = useMed((state) => state.setDaySpend);
  const savedExpense = spendForToday(daySpend);
  const [amount, setAmount] = useState(savedExpense ? String(savedExpense) : "");
  const [note, setNote] = useState(daySpend.day ? daySpend.note : "");
  const [saved, setSaved] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [excelNote, setExcelNote] = useState("");
  const journal = useMed((state) => state.journal) ?? [];
  const weekPlans = useMed((state) => state.weekPlans) ?? [];
  const figures = dayFigures(orders, catalog, savedExpense);
  const lows = lowOnRoute(catalog, loads, people);
  const sellers = sellerDays(orders, visits, people, clients);
  const drivers = driverDays(orders, people);
  const moved = movedToday(orders, catalog).slice(0, 4);
  const lines: { label: string; value: number; strong?: boolean }[] = [
    { label: "Venta bruta", value: figures.gross },
    { label: "Descuentos", value: -figures.discount },
    { label: "Venta neta", value: figures.net, strong: true },
    { label: "Costo de lo vendido", value: -figures.cost },
    { label: "Utilidad bruta", value: figures.grossProfit, strong: true },
    { label: "Gastos del día", value: -figures.expense },
    { label: "Resultado", value: figures.result, strong: true },
  ];

  return (
    <Shell>
      <PageTitle
        title="Día"
        hint={`Resultados de hoy, ${nowLabel()}.`}
      />
      <button
        type="button"
        onClick={() => {
          const day = todayKey();
          const body = buildDayWorkbook({
            day,
            other: addDays(day, -1),
            orders,
            visits,
            people,
            clients,
            catalog,
            journal,
            weekPlans,
            daySpend,
          });
          void downloadReport(reportFilename(day), body).then(setExcelNote);
        }}
        className="mt-4 h-12 w-full rounded-xl border border-line bg-card font-semibold"
      >
        Descargar Excel de hoy
      </button>
      {excelNote ? <p className="mt-2 text-sm text-muted">{excelNote}</p> : null}
      <DayLog />

      <h2 className="mt-6 text-lg font-extrabold text-section">Por agotarse</h2>
      {lows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Ninguna unidad está en el mínimo o debajo.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {lows.map((item) => (
            <li key={`${item.personId}-${item.productId}`} className="rounded-2xl border border-line bg-card p-3">
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-muted">
                {item.personName} · {item.routeName} · quedan {item.qty} · mínimo {item.minQty}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-lg font-extrabold text-section">Estado de resultados</h2>
      <p className="mt-1 text-sm text-muted">
        Pedidos de hoy. Una incidencia no entra: la pieza regresó a la unidad.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Resultado" value={money(figures.result)} hint={`${figures.orders} pedidos en la venta`} />
        <Stat label="Ticket" value={money(figures.ticket)} hint={`${figures.pieces} piezas`} />
      </div>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
        {lines.map((row) => (
          <li key={row.label} className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0">
            <span className={row.strong ? "font-semibold" : "text-sm text-muted"}>{row.label}</span>
            <span className={"tabular-nums " + (row.strong ? "font-extrabold text-blue-deep" : "")}>{money(row.value)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Cobrado" value={money(figures.collected)} hint={`${figures.deliveredCount} entregas`} />
        <Stat label="Por cobrar" value={money(figures.pendingAmount)} hint={`${figures.pendingCount} pendientes`} />
        <Stat label="Incidencias" value={money(figures.failedAmount)} hint={`${figures.failedCount} no vendidas`} />
      </div>

      {spendOpen ? null : (
        <button type="button" onClick={() => setSpendOpen(true)} className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card">
          {savedExpense ? "Cambiar gasto" : "Anotar gasto"}
        </button>
      )}
      {spendOpen ? (
      <form
        className="mt-4 rounded-2xl border border-line bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setDaySpend(Number(amount || 0), note);
          setSaved(true);
          setSpendOpen(false);
        }}
      >
        <h2 className="text-lg font-extrabold text-section">Gastos del día</h2>
        <p className="mt-1 text-sm text-muted">Gasolina, casetas u otro gasto de hoy. Entra al resultado.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-sm font-semibold">
            Importe
            <input
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setSaved(false);
              }}
              inputMode="numeric"
              placeholder="0"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
            />
          </label>
          <label className="block text-sm font-semibold">
            Nota
            <input
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setSaved(false);
              }}
              placeholder="Gasolina"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
            />
          </label>
        </div>
        {saved ? <p className="mt-3 text-sm text-ok">Gasto guardado en el resultado de hoy.</p> : null}
        <button type="submit" className="mt-3 h-12 w-full rounded-xl bg-blue font-semibold text-card">
          Guardar gasto
        </button>
        <button type="button" onClick={() => setSpendOpen(false)} className="mt-2 h-12 w-full rounded-xl border border-line font-semibold">
          Cancelar
        </button>
      </form>
      ) : null}

      <h2 className="mt-6 text-lg font-extrabold text-section">Preventa</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {sellers.length === 0 ? <li className="text-sm text-muted">No hay preventas dadas de alta.</li> : null}
        {sellers.map((person) => (
          <li key={person.id} className="rounded-2xl border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{person.name}</p>
                <p className="text-sm text-muted">{person.routeName}</p>
              </div>
              <p className="font-extrabold text-blue-deep tabular-nums">{money(person.sales)}</p>
            </div>
            <p className="mt-2 text-sm text-muted">
              {person.stops === 0
                ? "Sin clientes en la ruta"
                : `${person.visits}/${person.stops} visitas · ${person.effective} con pedido · ${person.missed} sin venta`}
            </p>
            <p className="text-sm text-muted">
              {person.orders} {person.orders === 1 ? "pedido" : "pedidos"} · ticket {money(person.ticket)}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-lg font-extrabold text-section">Reparto</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {drivers.length === 0 ? <li className="text-sm text-muted">No hay repartidores dados de alta.</li> : null}
        {drivers.map((person) => (
          <li key={person.id} className="rounded-2xl border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{person.name}</p>
                <p className="text-sm text-muted">{person.routeName}</p>
              </div>
              <p className="font-extrabold text-blue-deep tabular-nums">{money(person.deliveredAmount)}</p>
            </div>
            <p className="mt-2 text-sm text-muted">
              {person.assigned === 0
                ? "Sin pedidos asignados hoy"
                : `${person.delivered} entregadas · ${person.pending} pendientes · ${person.failed} incidencias`}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-lg font-extrabold text-section">Lo que más se movió</h2>
      {moved.length === 0 ? <p className="mt-2 text-sm text-muted">Todavía no hay piezas vendidas hoy.</p> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {moved.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 rounded-2xl border border-line bg-card px-3 py-2">
            <span className="font-semibold">
              {item.name}
              <span className="ml-2 text-sm font-medium text-muted">{item.qty} pzas</span>
            </span>
            <span className="tabular-nums">{money(item.amount)}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
