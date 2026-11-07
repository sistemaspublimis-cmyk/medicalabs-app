import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrderDetail } from "@/components/med/order-detail";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { mondayOf, weekSpan, inWeek } from "@/lib/med/weeks";
import { operatingDriverId, operatingSellerId, useMed } from "@/lib/med/store";
import { isToday, lineSummary, money, orderTotals, storeName } from "@/lib/ruta/format";

export const Route = createFileRoute("/ventas")({
  component: SalesSheet,
});

function SalesSheet() {
  const role = useMed((state) => state.role);
  const orders = useMed((state) => state.orders);
  const people = useMed((state) => state.people);
  const clients = useMed((state) => state.clients);
  const catalog = useMed((state) => state.catalog);
  const sellerId = useMed(operatingSellerId);
  const driverId = useMed(operatingDriverId);
  const [span, setSpan] = useState<"dia" | "semana">("dia");
  const [openId, setOpenId] = useState<string | null>(null);
  const week = mondayOf(new Date());
  const desk = role === "owner" || role === "manager";
  const mine = orders.filter((order) => {
    if (order.delivery === "failed") return false;
    const onSpan = span === "dia" ? isToday(order.createdAt) : inWeek(order.createdAt, week);
    if (!onSpan) return false;
    if (desk) return true;
    if (role === "driver") return order.driverId === driverId;
    return order.sellerId === sellerId;
  });
  const total = mine.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const peopleIds = [...new Set(mine.map((order) => order.sellerId))];

  return (
    <Shell>
      <PageTitle
        title="Mis ventas"
        hint={desk ? "Notas de todo el equipo, del día o de la semana." : "Tus notas del día o de la semana. Toca una para ver el detalle."}
      />
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Periodo">
        <button type="button" aria-pressed={span === "dia"} onClick={() => setSpan("dia")} className={"h-11 rounded-xl font-semibold " + (span === "dia" ? "bg-teal text-drawer-ink" : "border border-line bg-card")}>
          Hoy
        </button>
        <button type="button" aria-pressed={span === "semana"} onClick={() => setSpan("semana")} className={"h-11 rounded-xl font-semibold " + (span === "semana" ? "bg-teal text-drawer-ink" : "border border-line bg-card")}>
          Semana
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">{span === "semana" ? weekSpan(week) : "Hoy"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-sm text-muted">Notas</p>
          <p className="text-2xl font-extrabold text-teal tabular-nums">{mine.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-3">
          <p className="text-sm text-muted">Valor</p>
          <p className="text-2xl font-extrabold text-teal tabular-nums">{money(total)}</p>
        </div>
      </div>
      {desk ? (
        <ul className="mt-4 flex flex-col gap-2">
          {peopleIds.length === 0 ? <li className="text-sm text-muted">En este periodo no hay notas.</li> : null}
          {peopleIds.map((id) => {
            const rows = mine.filter((order) => order.sellerId === id);
            const amount = rows.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
            const name = people.find((person) => person.id === id)?.name ?? "Sin nombre";
            return (
              <li key={id} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{name}</p>
                  <p className="font-extrabold text-teal tabular-nums">{money(amount)}</p>
                </div>
                <p className="text-sm text-muted">{rows.length} {rows.length === 1 ? "nota" : "notas"}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
      <h2 className="mt-6 text-lg font-extrabold text-section">Notas</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {mine.length === 0 ? <li className="text-sm text-muted">Todavía no hay ventas en este periodo.</li> : null}
        {mine.map((order) => (
          <li key={order.id}>
            <button type="button" onClick={() => setOpenId(order.id)} className="w-full rounded-2xl border border-line bg-card p-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{storeName(order.clientId, clients)}</p>
                <p className="font-extrabold text-teal tabular-nums">{money(orderTotals(order.lines, order.discountPct).total)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {order.id} · {people.find((person) => person.id === order.sellerId)?.name ?? "Preventa"}
              </p>
              <p className="mt-1 text-sm">{lineSummary(order.lines, catalog)}</p>
            </button>
          </li>
        ))}
      </ul>
      {openId ? <OrderDetail orderId={openId} onClose={() => setOpenId(null)} /> : null}
    </Shell>
  );
}
