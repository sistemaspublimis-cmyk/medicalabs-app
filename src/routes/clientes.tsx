import { createFileRoute, Link } from "@tanstack/react-router";
import { RegisterClient } from "@/components/med/register-client";
import { Shell } from "@/components/med/shell";
import { Chip, PageTitle } from "@/components/med/ui";
import { clientMapPoint, MANAGER_ID, staffById } from "@/lib/med/catalog";
import { distanceMeters, formatDistance, sortByNear } from "@/lib/med/near";
import { clock, isToday } from "@/lib/ruta/format";
import { fieldPersonId, operatingDriverId, operatingSellerId, storesForSeller, useMed, zoneSightOf } from "@/lib/med/store";

export const Route = createFileRoute("/clientes")({
  component: ClientsPage,
});

function ClientsPage() {
  const role = useMed((state) => state.role);
  const people = useMed((state) => state.people);
  const visits = useMed((state) => state.visits);
  const orders = useMed((state) => state.orders);
  const clients = useMed((state) => state.clients);
  const areas = useMed((state) => state.areas) ?? [];
  const zoneSight = useMed((state) => state.zoneSight);
  const sellerId = useMed(operatingSellerId);
  const driverId = useMed(operatingDriverId);
  const locations = useMed((state) => state.locations);
  const personId = fieldPersonId(role);
  const here = personId ? locations[personId]?.[0] : undefined;
  const seller = people.find((person) => person.id === sellerId);
  const driver = people.find((person) => person.id === driverId);
  const team = new Set(people.filter((person) => person.leadId === MANAGER_ID).map((person) => person.id));
  const stops =
    role === "owner"
      ? clients
      : role === "manager"
        ? clients.filter((stop) => team.has(stop.sellerId) || team.has(stop.driverId))
      : role === "driver"
        ? clients.filter((stop) => stop.driverId === driverId)
        : storesForSeller(sellerId, clients, areas, zoneSightOf(zoneSight, sellerId) === "oculta" ? "oculta" : "tiendas");
  const hint =
    role === "owner"
      ? "Todas las cuentas. Cada una indica de qué preventa es."
      : role === "manager"
        ? "Las tiendas del equipo que el dueño te asignó."
      : role === "driver"
        ? `${driver?.name ?? "Reparto"} · ${driver?.routeName ?? "ruta"}.`
        : `${seller?.name ?? "Preventa"} · las tiendas de su zona y las que el dueño le designó.`;
  const ordered = sortByNear(stops, here ?? null, (stop) => clientMapPoint(stop));
  return (
    <Shell>
      <PageTitle title="Clientes" hint={hint} />
      <RegisterClient />
      {here ? (
        <p className="mt-3 text-sm text-muted">Ordenados del más cercano al más lejos.</p>
      ) : role === "driver" || role === "presale" ? (
        <p className="mt-3 text-sm text-muted">Activa la ubicación para ordenar la lista por cercanía.</p>
      ) : null}
      {ordered.length === 0 ? <p className="mt-4 text-sm text-muted">Esta ruta todavía no tiene clientes.</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {ordered.map((stop) => {
          const point = clientMapPoint(stop);
          const away = here && point ? formatDistance(distanceMeters(here, point)) : "";
          const visit = visits.find((item) => item.clientId === stop.id && item.sellerId === stop.sellerId && isToday(item.at));
          const history = orders.filter((order) => order.clientId === stop.id);
          const bought = history.some((order) => isToday(order.createdAt) && order.delivery !== "failed");
          const owner = staffById(stop.sellerId)?.name ?? people.find((person) => person.id === stop.sellerId)?.name;
          return (
            <li key={stop.id}>
              <Link to="/cliente/$clientId" params={{ clientId: stop.id }} className="block rounded-2xl border border-line bg-card p-3">
                <span className="flex items-start justify-between gap-2">
                  <span className="block font-semibold">{stop.store}</span>
                  <Chip tone={bought ? "ok" : visit ? "blue" : "muted"}>{bought ? "Pedido" : visit ? visit.note : "Pendiente"}</Chip>
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {stop.zone} · {stop.address}
                  {away ? ` · ${away}` : ""}
                  {visit ? ` · ${clock(visit.at)}` : ""}
                </span>
                <span className="block text-sm text-muted">
                  {stop.contact}
                  {history.length > 0 ? ` · ${history.length} ${history.length === 1 ? "compra" : "compras"}` : " · Sin compras"}
                  {role === "owner" && owner ? ` · ${owner}` : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
