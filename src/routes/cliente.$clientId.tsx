import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OrderDetail } from "@/components/med/order-detail";
import { Shell } from "@/components/med/shell";
import { StoreMap, type StoreMarker } from "@/components/med/store-map";
import { Chip, PageTitle } from "@/components/med/ui";
import { clientMapPoint, type ClientStop } from "@/lib/med/catalog";
import { formatAccuracy, formatFixTime, googleLink } from "@/lib/med/locate";
import { placeFromAddress } from "@/lib/med/place";
import { clock, isToday, lineSummary, money, orderTotals } from "@/lib/ruta/format";
import { operatingSellerId, useMed } from "@/lib/med/store";

const NO_SALE = ["Cerrado", "Sin dinero", "Inventario lleno"] as const;

export const Route = createFileRoute("/cliente/$clientId")({
  component: ClientPage,
});

function ClientPage() {
  const { clientId } = Route.useParams();
  const client = useMed((state) => state.clients.find((item) => item.id === clientId));
  const navigate = useNavigate();
  const visits = useMed((state) => state.visits);
  const orders = useMed((state) => state.orders);
  const catalog = useMed((state) => state.catalog);
  const people = useMed((state) => state.people);
  const checkIn = useMed((state) => state.checkIn);
  const setActiveClient = useMed((state) => state.setActiveClient);
  const role = useMed((state) => state.role);
  const sellerId = useMed(operatingSellerId);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!client) {
    return (
      <Shell>
        <PageTitle title="Cliente no encontrado" />
        <Link to="/clientes" className="mt-4 inline-flex h-11 items-center font-semibold text-blue">
          Volver
        </Link>
      </Shell>
    );
  }

  const visit = visits.find((item) => item.clientId === client.id && item.sellerId === client.sellerId && isToday(item.at));
  const history = orders.filter((order) => order.clientId === client.id);
  const mine = history.filter((order) => isToday(order.createdAt));
  const past = history.filter((order) => !isToday(order.createdAt));
  const clientVisits = visits.filter((item) => item.clientId === client.id);
  const seller = people.find((person) => person.id === client.sellerId);
  const locked = role !== "presale" || client.sellerId !== sellerId;
  const lockReason =
    role !== "presale"
      ? "Esta visita la registra la preventa de la ruta."
      : `Este cliente es de ${seller?.name ?? "otra ruta"}.`;

  return (
    <Shell>
      <Link to="/clientes" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-blue">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Clientes
      </Link>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-title">{client.store}</h1>
      <p className="mt-2 text-sm text-muted">
        {client.contact} · {client.zone}
      </p>
      <p className="text-sm text-muted">{client.address}</p>
      <Attendants client={client} people={people} orders={history} visits={clientVisits} />
      <PlaceLookup client={client} />
      <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="mt-3 inline-flex h-11 items-center gap-2 font-semibold text-blue">
        <Phone className="size-4" aria-hidden="true" />
        {client.phone}
      </a>
      {client.facade ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {client.facade.map((photo, index) => (
            <img
              key={photo.slice(0, 48) + index}
              src={photo}
              alt={`Fachada ${index + 1} de ${client.store}`}
              className="aspect-[3/4] w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      ) : null}
      <ClientMap client={client} />
      {clientMapPoint(client) ? (
        <button
          type="button"
          className="mt-3 inline-flex h-11 items-center font-semibold text-blue"
          onClick={() => {
            useMed.getState().setMapFocus(client.id);
            void navigate({ to: "/mapa" });
          }}
        >
          Ver en el mapa
        </button>
      ) : null}
      <div className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Visita de hoy</p>
          <Chip tone={mine.length > 0 ? "blue" : visit ? "muted" : "muted"}>{mine.length > 0 ? "Pedido" : visit ? visit.note : "Pendiente"}</Chip>
        </div>
        <p className="mt-2 text-sm text-muted">{visit ? `Registrada ${clock(visit.at)}` : "Aún no hay visita."}</p>
      </div>
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          setActiveClient(client.id);
          void navigate({ to: "/" });
        }}
        className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card disabled:opacity-40"
      >
        Vender a este cliente
      </button>
      {locked ? <p className="mt-2 text-sm text-muted">{lockReason}</p> : null}
      {mine.length > 0 ? null : <p className="mt-6 text-sm font-semibold text-kicker">Visita sin venta</p>}
      {mine.length > 0 ? null : <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {NO_SALE.map((reason) => (
          <button
            key={reason}
            type="button"
            disabled={locked}
            onClick={() => checkIn(client.id, reason)}
            className="h-12 rounded-xl border border-line bg-card font-semibold disabled:opacity-40"
          >
            {reason}
          </button>
        ))}
      </div>}
      <h2 className="mt-8 text-lg font-extrabold text-section">Historial de compras</h2>
      <p className="mt-1 text-sm text-muted">
        {history.length === 0
          ? "Esta tienda todavía no tiene compras."
          : `${history.length} ${history.length === 1 ? "compra" : "compras"} · ${clientVisits.length} ${clientVisits.length === 1 ? "visita" : "visitas"}.`}
      </p>
      <h2 className="mt-6 text-lg font-extrabold text-section">Pedidos de hoy</h2>
      {mine.length === 0 ? <p className="mt-2 text-sm text-muted">Todavía no hay pedido.</p> : null}
      <ul className="mt-3 flex flex-col gap-2">
        {mine.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => setOpenId(order.id)}
              className="w-full rounded-2xl border border-line bg-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{order.id}</p>
                <Chip tone={order.delivery === "delivered" ? "ok" : order.delivery === "failed" ? "danger" : "blue"}>
                  {order.delivery === "delivered" ? "Entregado" : order.delivery === "failed" ? "Incidencia" : "Por entregar"}
                </Chip>
              </div>
              <p className="mt-1 text-sm text-muted">
                {clock(order.createdAt)} · {lineSummary(order.lines, catalog)}
              </p>
              <p className="mt-1 font-semibold tabular-nums">{money(orderTotals(order.lines, order.discountPct).total)}</p>
              <p className="mt-1 text-sm font-semibold text-blue">Ver ticket</p>
            </button>
          </li>
        ))}
      </ul>
      {past.length > 0 ? <h2 className="mt-8 text-lg font-extrabold text-section">Compras anteriores</h2> : null}
      <ul className="mt-3 flex flex-col gap-2">
        {past.map((order) => (
          <li key={order.id}>
            <button type="button" onClick={() => setOpenId(order.id)} className="w-full rounded-2xl border border-line bg-card p-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{order.id}</p>
                <Chip tone={order.delivery === "delivered" ? "ok" : order.delivery === "failed" ? "danger" : "blue"}>
                  {order.delivery === "delivered" ? "Entregado" : order.delivery === "failed" ? "Incidencia" : "Por entregar"}
                </Chip>
              </div>
              <p className="mt-1 text-sm text-muted">
                {clock(order.createdAt)} · {lineSummary(order.lines, catalog)}
              </p>
              <p className="mt-1 font-semibold tabular-nums">{money(orderTotals(order.lines, order.discountPct).total)}</p>
            </button>
          </li>
        ))}
      </ul>
      {clientVisits.length > 0 ? <h2 className="mt-8 text-lg font-extrabold text-section">Visitas</h2> : null}
      <ul className="mt-3 flex flex-col gap-2">
        {clientVisits.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-card p-3">
            <p className="font-semibold">{item.note || "Visita"}</p>
            <p className="text-sm text-muted">
              {clock(item.at)} · {people.find((person) => person.id === item.sellerId)?.name ?? "Preventa"}
            </p>
          </li>
        ))}
      </ul>
      {openId ? <OrderDetail orderId={openId} onClose={() => setOpenId(null)} /> : null}
    </Shell>
  );
}

function Attendants({
  client,
  people,
  orders,
  visits,
}: {
  client: ClientStop;
  people: { id: string; name: string }[];
  orders: { sellerId: string; driverId: string }[];
  visits: { sellerId: string }[];
}) {
  const seller = people.find((person) => person.id === client.sellerId);
  const driver = people.find((person) => person.id === client.driverId);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const id of [client.sellerId, client.driverId, ...orders.map((order) => order.sellerId), ...orders.map((order) => order.driverId), ...visits.map((visit) => visit.sellerId)]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    names.push(people.find((person) => person.id === id)?.name ?? "Sin nombre");
  }
  return (
    <div className="mt-4 rounded-2xl border border-line bg-card p-4">
      <p className="font-semibold">Quién atiende</p>
      <p className="mt-1 text-sm">Preventa: {seller?.name ?? "Sin asignar"}</p>
      <p className="text-sm">Reparto: {driver?.name ?? "Sin asignar"}</p>
      <p className="mt-2 text-sm text-muted">En las notas y visitas: {names.join(", ") || "Nadie todavía."}</p>
    </div>
  );
}

function PlaceLookup({ client }: { client: ClientStop }) {
  const pinClient = useMed((state) => state.pinClient);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (clientMapPoint(client) || !client.address.trim()) return;
    let alive = true;
    setStatus("Buscando la dirección…");
    void placeFromAddress(client.address, client.zone).then((point) => {
      if (!alive) return;
      if (!point) {
        setStatus("No se encontró un punto para esa dirección.");
        return;
      }
      pinClient(client.id, point.lat, point.lng);
      setStatus("");
    });
    return () => {
      alive = false;
    };
  }, [client, pinClient]);
  if (!status) return null;
  return <p className="mt-2 text-sm text-muted">{status}</p>;
}

function ClientMap({ client }: { client: ClientStop }) {
  const point = clientMapPoint(client);
  const lat = point?.lat;
  const lng = point?.lng;
  const kind = point?.kind;
  const markers = useMemo<StoreMarker[]>(() => {
    if (lat == null || lng == null || !kind) return [];
    return [
      {
        id: client.id,
        title: client.store,
        lines: [client.address, kind === "gps" ? "Registrada en la puerta" : "Punto de la ruta"],
        lat,
        lng,
        tone: kind === "gps" ? "gps" : "store",
        mapsUrl: googleLink(lat, lng),
        photo: kind === "gps" ? client.facade?.[0] : undefined,
      },
    ];
  }, [client.address, client.facade, client.id, client.store, kind, lat, lng]);

  if (!point || markers.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-line bg-card p-4">
      <p className="font-semibold">{point.kind === "gps" ? "Ubicación al registrar" : "Punto de la ruta"}</p>
      {point.kind === "gps" && client.fix ? (
        <>
          <p className="mt-1 text-sm text-blue-deep tabular-nums">
            {client.fix.lat.toFixed(6)}, {client.fix.lng.toFixed(6)}
            {formatAccuracy(client.fix.accuracy) ? ` · ${formatAccuracy(client.fix.accuracy)}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">{formatFixTime(client.fix.at)}</p>
        </>
      ) : client.mapPin ? (
        <p className="mt-1 text-sm text-blue-deep tabular-nums">
          {client.mapPin.lat.toFixed(6)}, {client.mapPin.lng.toFixed(6)}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Referencia para ubicar la tienda. No es una lectura del teléfono.</p>
      )}
      <div className="mt-3 overflow-hidden rounded-2xl border border-line">
        <StoreMap markers={markers} className="h-64 w-full" />
      </div>
      <a
        href={googleLink(point.lat, point.lng)}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex h-11 items-center font-semibold text-blue"
      >
        Abrir en Google Maps
      </a>
    </div>
  );
}

