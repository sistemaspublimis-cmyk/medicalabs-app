import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/med/shell";
import { Chip, PageTitle, Stat } from "@/components/med/ui";
import { staffById, type CrewMember } from "@/lib/med/catalog";
import { isToday, money, orderTotals } from "@/lib/ruta/format";
import { useMed, type Order } from "@/lib/med/store";

export const Route = createFileRoute("/equipo")({
  component: TeamPage,
});

function TeamPage() {
  const orders = useMed((state) => state.orders);
  const visits = useMed((state) => state.visits);
  const crew = useMed((state) => state.people).filter((person) => person.kind === "presale" || person.kind === "driver");
  const [focus, setFocus] = useState(crew[0]?.id ?? "ana");
  const person = crew.find((item) => item.id === focus) ?? crew[0];
  const today = orders.filter((order) => isToday(order.createdAt) && order.delivery !== "failed");
  const sales = today.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);

  return (
    <Shell>
      <PageTitle title="Equipo" hint="Preventa captura el pedido. Reparto lo cierra en la entrega." />
      <div className="mt-4">
        <Stat label="Venta del día" value={money(sales)} hint={`${today.length} ${today.length === 1 ? "pedido" : "pedidos"}`} />
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {crew.length === 0 ? <li className="text-sm text-muted">Todavía no hay preventa ni reparto.</li> : null}
        {crew.map((item) => (
          <li key={item.id}>
            <PersonButton person={item} active={item.id === focus} onClick={() => setFocus(item.id)} orders={today} visits={visits} />
          </li>
        ))}
      </ul>
      {person ? <RouteSketch person={person} /> : null}
    </Shell>
  );
}

function PersonButton({
  person,
  active,
  onClick,
  orders,
  visits,
}: {
  person: CrewMember;
  active: boolean;
  onClick: () => void;
  orders: Order[];
  visits: { sellerId: string; at: string }[];
}) {
  const related =
    person.kind === "presale"
      ? orders.filter((order) => order.sellerId === person.id)
      : orders.filter((order) => order.driverId === person.id);
  const total = related.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const seen = visits.filter((visit) => visit.sellerId === person.id && isToday(visit.at)).length;
  return (
    <button
      type="button"
      onClick={onClick}
      className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left " + (active ? "border-blue bg-blue-soft" : "border-line bg-card")}
    >
      <span className="grid size-11 place-items-center rounded-full bg-blue-deep text-sm font-bold text-card">{initials(person.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{person.name}</span>
        <span className="block text-sm text-muted">
          {person.routeName || "Sin ruta"}
          {person.kind === "presale" ? ` · ${seen} visitas` : ` · ${related.length} entregas`}
        </span>
      </span>
      <span className="font-extrabold text-blue-deep tabular-nums">
        {person.kind === "presale" ? money(total) : (staffById(person.id)?.vehicle ?? "Reparto")}
      </span>
    </button>
  );
}

function initials(name: string): string {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "•";
}

function RouteSketch({ person }: { person: CrewMember }) {
  const clients = useMed((state) => state.clients);
  const stops = person.kind === "presale" ? clients.filter((stop) => stop.sellerId === person.id) : clients.filter((stop) => stop.driverId === person.id);
  return (
    <div className="mt-6">
      <h2 className="text-lg font-extrabold text-section">Paradas de {person.name.split(" ")[0]}</h2>
      {stops.length === 0 ? <p className="mt-2 text-sm text-muted">Esta persona todavía no tiene paradas asignadas.</p> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {stops.map((stop) => (
          <li key={stop.id} className="rounded-2xl border border-line bg-card px-3 py-3">
            <p className="font-semibold">{stop.store}</p>
            <p className="text-sm text-muted">
              {stop.zone} · {stop.address}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Chip tone="blue">{person.kind === "presale" ? "Preventa" : "Reparto"}</Chip>
      </div>
    </div>
  );
}
