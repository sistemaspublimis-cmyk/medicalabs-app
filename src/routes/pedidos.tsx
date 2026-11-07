import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrderDetail } from "@/components/med/order-detail";
import { Shell } from "@/components/med/shell";
import { Chip, PageTitle } from "@/components/med/ui";
import { clientById, MANAGER_ID } from "@/lib/med/catalog";
import { clock, isToday, lineSummary, money, orderTotals, storeName } from "@/lib/ruta/format";
import { operatingDriverId, operatingSellerId, useMed } from "@/lib/med/store";

export const Route = createFileRoute("/pedidos")({
  component: OrdersPage,
});

function OrdersPage() {
  const role = useMed((state) => state.role);
  const orders = useMed((state) => state.orders);
  const catalog = useMed((state) => state.catalog);
  const people = useMed((state) => state.people);
  const sellerId = useMed(operatingSellerId);
  const driverId = useMed(operatingDriverId);
  const clients = useMed((state) => state.clients);
  const assignDriver = useMed((state) => state.assignDriver);
  const drivers = people.filter((person) => person.kind === "driver");
  const [openId, setOpenId] = useState<string | null>(null);
  const seller = people.find((person) => person.id === sellerId);
  const driver = people.find((person) => person.id === driverId);
  const team = new Set(people.filter((person) => person.leadId === MANAGER_ID).map((person) => person.id));
  const mine =
    role === "owner"
      ? orders.filter((order) => isToday(order.createdAt))
      : role === "manager"
        ? orders.filter((order) => isToday(order.createdAt) && (team.has(order.sellerId) || team.has(order.driverId)))
      : role === "driver"
        ? orders.filter((order) => order.driverId === driverId && isToday(order.createdAt))
        : orders.filter((order) => order.sellerId === sellerId && isToday(order.createdAt));

  return (
    <Shell>
      <PageTitle
        title="Pedidos"
        hint={
          role === "driver"
            ? `Los que ${driver?.name ?? "esta unidad"} entrega hoy.`
            : role === "owner"
              ? "Elige el repartidor de cada pedido, o deja uno solo en el tablero."
              : role === "manager"
                ? "Pedidos del equipo que el dueño te asignó."
              : `Los que capturó ${seller?.name ?? "esta preventa"} hoy.`
        }
      />
      <ul className="mt-4 flex flex-col gap-2">
        {mine.length === 0 ? <li className="text-sm text-muted">Todavía no hay pedidos.</li> : null}
        {mine.map((order) => {
          const client = role === "driver" ? (clients.find((item) => item.id === order.clientId) ?? clientById(order.clientId)) : undefined;
          return (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => setOpenId(order.id)}
              className="w-full rounded-2xl border border-line bg-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{storeName(order.clientId, clients)}</p>
                <Chip tone={order.delivery === "delivered" ? "ok" : order.delivery === "failed" ? "danger" : "blue"}>
                  {order.delivery === "delivered" ? "Entregado" : order.delivery === "failed" ? "Incidencia" : "Por entregar"}
                </Chip>
              </div>
              {client ? (
                <p className="mt-1 text-sm font-semibold">
                  {client.address || "Sin dirección"}
                  {client.zone ? ` · ${client.zone}` : ""}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                {clock(order.createdAt)} · {order.id}
                {order.synced ? " · Enviado" : " · En el teléfono"}
                {role !== "presale" ? ` · ${people.find((person) => person.id === order.sellerId)?.name ?? "Preventa"}` : ""}
              </p>
              <p className="mt-1 text-sm">{lineSummary(order.lines, catalog)}</p>
              <p className="mt-1 font-extrabold text-blue-deep tabular-nums">{money(orderTotals(order.lines, order.discountPct).total)}</p>
              <p className="mt-1 text-sm font-semibold text-blue">Ver ticket</p>
            </button>
            {role === "owner" && order.delivery === "pending" && drivers.length > 1 ? (
              <label className="mt-2 block text-sm font-semibold">
                Repartidor
                <select
                  value={order.driverId}
                  onChange={(event) => assignDriver(order.id, event.target.value)}
                  className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base font-medium"
                >
                  <option value="">Sin asignar</option>
                  {drivers.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                      {person.routeName ? ` · ${person.routeName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : role === "owner" ? (
              <p className="mt-2 text-sm text-muted">
                Reparto {people.find((person) => person.id === order.driverId)?.name ?? "sin asignar"}
              </p>
            ) : null}
          </li>
          );
        })}
      </ul>
      {openId ? <OrderDetail orderId={openId} onClose={() => setOpenId(null)} /> : null}
    </Shell>
  );
}
