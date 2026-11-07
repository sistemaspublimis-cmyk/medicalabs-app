import { Link } from "@tanstack/react-router";
import { clientById, clientMapPoint, MANAGER_ID } from "@/lib/med/catalog";
import { DeliveryRoute } from "@/components/med/delivery-route";
import { OrderDetail } from "@/components/med/order-detail";
import { Chip, PageTitle, Stat } from "@/components/med/ui";
import { formatFixTime, googleAddressLink, googleLink } from "@/lib/med/locate";
import { sortByNear } from "@/lib/med/near";
import { inWeek, mondayOf, stopsForDriver, weekSpan } from "@/lib/med/weeks";
import { isToday, lineSummary, money, orderTotals, storeName } from "@/lib/ruta/format";
import { operatingDriverId, sessionAccess, useMed, type DeliveryState, type JournalEntry } from "@/lib/med/store";
import { useState } from "react";

export function OwnerBoard() {
  const role = useMed((state) => state.role);
  const orders = useMed((state) => state.orders);
  const visits = useMed((state) => state.visits);
  const people = useMed((state) => state.people);
  const [personId, setPersonId] = useState<string | null>(null);
  const today = orders.filter((order) => isToday(order.createdAt));
  const counted = today.filter((order) => order.delivery !== "failed");
  const sales = counted.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const pending = today.filter((order) => order.delivery === "pending").length;
  const delivered = today.filter((order) => order.delivery === "delivered").length;
  const failed = today.filter((order) => order.delivery === "failed").length;
  const locations = useMed((state) => state.locations);
  const unitConsent = useMed((state) => state.unitConsent);
  const journal = useMed((state) => state.journal) ?? [];
  const clients = useMed((state) => state.clients);
  const crew = people.filter((person) => person.kind === "presale" || person.kind === "driver");
  const visible = role === "manager" ? crew.filter((person) => person.leadId === MANAGER_ID) : crew;
  const preventas = visible.filter((person) => person.kind === "presale");
  const drivers = visible.filter((person) => person.kind === "driver");
  const canEdit = role === "owner";
  const dispatchMode = useMed((state) => state.dispatchMode);
  const soloDriverId = useMed((state) => state.soloDriverId);
  const setDispatch = useMed((state) => state.setDispatch);
  const solo = drivers.find((person) => person.id === soloDriverId);
  const waiting = today.filter((order) => order.delivery === "pending" && !order.driverId).length;

  return (
    <div>
      <PageTitle
        title="Tablero"
        hint={role === "manager" ? "El equipo que el dueño te dejó. Toca un nombre para ver su historial." : "Dónde está el equipo y qué hizo cada uno. Toca un nombre para ver su historial."}
      />
      {role === "manager" && visible.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-card p-3 text-sm text-hint">El dueño todavía no te asigna gente.</p>
      ) : null}
      <Link to="/mapa" className="mt-4 flex h-12 items-center justify-center rounded-xl bg-blue font-semibold text-card">
        Mapa de Coacalco
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Venta" value={money(sales)} hint={`${counted.length} ${counted.length === 1 ? "pedido" : "pedidos"}`} />
        <Stat label="Por entregar" value={String(pending)} hint={`${delivered} entregados · ${failed} incidencias`} />
      </div>
      <p className="mt-2 text-sm text-muted">La venta no incluye pedidos que el reparto marcó como incidencia.</p>
      <div className="mt-3 flex flex-wrap gap-x-4">
        <Link to="/cierre" className="inline-flex h-11 items-center font-semibold text-blue-deep">
          Ver el día
        </Link>
        <Link to="/bitacora" className="inline-flex h-11 items-center font-semibold text-blue-deep">
          Bitácora
        </Link>
        <Link to="/rendimiento" className="inline-flex h-11 items-center font-semibold text-blue-deep">
          Rendimiento
        </Link>
        <Link to="/rutas" className="inline-flex h-11 items-center font-semibold text-blue-deep">
          Rutas
        </Link>
      </div>
      <h2 className="mt-6 text-lg font-extrabold text-section">Preventa</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {preventas.length === 0 ? <li className="text-sm text-muted">No hay preventas dadas de alta.</li> : null}
        {preventas.map((person) => {
          const mine = today.filter((order) => order.sellerId === person.id && order.delivery !== "failed");
          const total = mine.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
          const stops = clients.filter((client) => client.sellerId === person.id);
          const seen = visits.filter((visit) => visit.sellerId === person.id && isToday(visit.at)).length;
          const fix = locations[person.id]?.[0];
          const last = journal.find((entry) => entry.personId === person.id);
          return (
            <li key={person.id}>
              <button type="button" onClick={() => setPersonId(person.id)} className="w-full rounded-2xl border border-line bg-card p-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-title">{person.name}</p>
                    <p className="text-sm text-hint">
                      {person.routeName || "Sin ruta"} · {stops.length === 0 ? "sin clientes" : `${seen}/${stops.length} visitas`}
                    </p>
                  </div>
                  <p className="font-extrabold text-section tabular-nums">{money(total)}</p>
                </div>
                <p className="mt-1 text-sm text-hint">{fix ? `Última ubicación ${formatFixTime(fix.at)}` : "Sin ubicación guardada"}</p>
                <p className="mt-1 text-sm">{last ? last.title : "Sin movimientos"}</p>
              </button>
            </li>
          );
        })}
      </ul>
      {canEdit && drivers.length > 1 ? (
      <>
      <div className="mt-6 flex items-end justify-between gap-3">
        <h2 className="text-lg font-extrabold text-section">Reparto</h2>
        <Link to="/mapa" className="text-sm font-semibold text-blue-deep">
          Ver mapa
        </Link>
      </div>
      <div className="mt-2 rounded-2xl border border-line bg-card p-3">
        <p className="text-sm font-semibold">Cómo llegan los repartos</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={dispatchMode === "asignar"}
            onClick={() => setDispatch("asignar")}
            className={
              "h-11 rounded-xl border font-semibold " +
              (dispatchMode === "asignar" ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")
            }
          >
            Yo asigno
          </button>
          <button
            type="button"
            aria-pressed={dispatchMode === "solo"}
            onClick={() => setDispatch("solo", soloDriverId ?? drivers[0]?.id ?? null)}
            className={
              "h-11 rounded-xl border font-semibold " +
              (dispatchMode === "solo" ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")
            }
          >
            Uno solo
          </button>
        </div>
        {dispatchMode === "solo" ? (
          <>
            <div className="mt-2 flex flex-col gap-2">
              {drivers.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={soloDriverId === person.id}
                  onClick={() => setDispatch("solo", person.id)}
                  className={
                    "h-11 rounded-xl border px-3 text-left font-semibold " +
                    (soloDriverId === person.id ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")
                  }
                >
                  {person.name}
                  {person.routeName ? ` · ${person.routeName}` : ""}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">
              {solo
                ? `Los pedidos abiertos de hoy y los que salgan después le llegan a ${solo.name}.`
                : "Da de alta un repartidor para que reciba los pedidos."}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Cada pedido espera a que elijas el repartidor.
            {waiting > 0 ? ` Hay ${waiting} ${waiting === 1 ? "pedido sin asignar" : "pedidos sin asignar"}.` : ""}
          </p>
        )}
      </div>
      </>
      ) : (
        <div className="mt-6">
          <h2 className="text-lg font-extrabold text-section">Reparto</h2>
          {canEdit && drivers.length === 1 ? (
            <p className="mt-1 text-sm text-muted">Hay un solo repartidor. Los pedidos le llegan a {drivers[0].name} sin preguntar.</p>
          ) : null}
        </div>
      )}
      <ul className="mt-2 flex flex-col gap-2">
        {drivers.length === 0 ? <li className="text-sm text-muted">No hay repartidores dados de alta.</li> : null}
        {drivers.map((person) => {
          const mine = today.filter((order) => order.driverId === person.id);
          const done = mine.filter((order) => order.delivery !== "pending").length;
          const fix = locations[person.id]?.[0];
          const last = journal.find((entry) => entry.personId === person.id);
          return (
            <li key={person.id}>
              <button type="button" onClick={() => setPersonId(person.id)} className="w-full rounded-2xl border border-line bg-card p-3 text-left">
                <p className="font-semibold text-title">{person.name}</p>
                <p className="text-sm text-hint">
                  {person.routeName || "Sin ruta"} · {mine.length === 0 ? "sin pedidos hoy" : `${done}/${mine.length} cerradas`}
                </p>
                <p className="mt-1 text-sm text-hint">{fix ? `Última ubicación ${formatFixTime(fix.at)}` : "Sin ubicación guardada"}</p>
                <p className="mt-1 text-sm">{last ? last.title : "Sin movimientos"}</p>
              </button>
            </li>
          );
        })}
      </ul>
      {personId ? <PersonSheet personId={personId} onClose={() => setPersonId(null)} /> : null}
    </div>
  );
}

function PersonSheet({ personId, onClose }: { personId: string; onClose: () => void }) {
  const people = useMed((state) => state.people);
  const journal = useMed((state) => state.journal) ?? [];
  const locations = useMed((state) => state.locations);
  const shifts = useMed((state) => state.shifts) ?? [];
  const person = people.find((item) => item.id === personId);
  const rows = journal.filter((entry) => entry.personId === personId).slice(0, 24);
  const fix = locations[personId]?.[0];
  const shift = shifts.find((item) => item.personId === personId && isToday(item.startedAt));
  if (!person) return null;
  const puesto = person.kind === "driver" ? "Repartidor" : person.kind === "presale" ? "Preventa" : "Gerente";
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        className="max-h-[86vh] w-full overflow-y-auto rounded-t-3xl bg-paper px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        role="dialog"
        aria-label={person.name}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-kicker">{puesto}</p>
            <h2 className="text-2xl font-extrabold text-title">{person.name}</h2>
            <p className="text-sm text-hint">
              {person.routeName || "Sin ruta"}
              {person.phone ? ` · ${person.phone}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-11 px-2 font-semibold text-blue">
            Cerrar
          </button>
        </div>
        <p className="mt-3 text-sm text-ink">{fix ? `Última ubicación ${formatFixTime(fix.at)}` : "Sin ubicación guardada."}</p>
        <p className="mt-1 text-sm text-hint">
          {shift ? (shift.status === "working" ? "Periodo activo" : shift.status === "paused" ? "Periodo en pausa" : "Periodo cerrado") : "Hoy no ha iniciado periodo."}
        </p>
        <h3 className="mt-4 text-sm font-semibold text-kicker">Historial</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {rows.length === 0 ? <li className="text-sm text-hint">Todavía no hay movimientos.</li> : null}
          {rows.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: JournalEntry }) {
  return (
    <li className="rounded-2xl border border-line bg-card p-3">
      <p className="font-semibold text-title">{entry.title}</p>
      <p className="text-sm text-hint">{formatFixTime(entry.at)}{entry.place ? ` · ${entry.place}` : ""}</p>
      {entry.detail ? <p className="mt-1 text-sm">{entry.detail}</p> : null}
      {entry.lat != null && entry.lng != null ? (
        <p className="mt-1 text-sm text-kicker tabular-nums">
          {entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}
        </p>
      ) : null}
    </li>
  );
}

export function DriverBoard() {
  const orders = useMed((state) => state.orders);
  const people = useMed((state) => state.people);
  const markDelivery = useMed((state) => state.markDelivery);
  const undoDelivery = useMed((state) => state.undoDelivery);
  const remindDelivery = useMed((state) => state.remindDelivery);
  const locations = useMed((state) => state.locations);
  const role = useMed((state) => state.role);
  const driverId = useMed(operatingDriverId);
  const clients = useMed((state) => state.clients);
  const weekPlans = useMed((state) => state.weekPlans) ?? [];
  const driver = people.find((person) => person.id === driverId);
  const week = mondayOf(new Date());
  const stops = stopsForDriver(week, driverId, clients, weekPlans);
  const weekOrders = orders.filter((order) => order.driverId === driverId && inWeek(order.createdAt, week));
  const here = locations[driverId]?.[0];
  const open = sortByNear(
    orders.filter((order) => order.driverId === driverId && order.delivery === "pending"),
    here ?? null,
    (order) => {
      const client = clients.find((item) => item.id === order.clientId) ?? clientById(order.clientId);
      return client ? clientMapPoint(client) : null;
    },
  ).sort((left, right) => Number(Boolean(left.remindAt)) - Number(Boolean(right.remindAt)));
  const reminders = open.filter((order) => order.remindAt && Date.parse(order.remindAt) <= Date.now());
  const closed = weekOrders.filter((order) => order.delivery !== "pending");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <PageTitle
        title="Entregas"
        hint={`${driver?.name ?? "Reparto"} · semana ${weekSpan(week)} · ${stops.length} paradas · ${open.length} pendientes.`}
      />
      <DeliveryRoute driverId={driverId} list={false} />
      {reminders.length > 0 ? (
        <p className="mt-3 rounded-2xl bg-blue-soft px-3 py-2 text-sm font-semibold text-blue-deep">
          {reminders.length === 1 ? "Tienes un recordatorio de entrega." : `Tienes ${reminders.length} recordatorios de entrega.`}
        </p>
      ) : null}
      <h2 className="mt-4 text-lg font-extrabold text-section">Por entregar</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {open.length === 0 ? <li className="text-sm text-muted">No tienes pendientes. La ruta de la semana está al corriente.</li> : null}
        {open.map((order) => (
          <DeliveryCard
            key={order.id}
            orderId={order.id}
            locked={!sessionAccess(role, people).includes("entregar")}
            onMark={markDelivery}
            onRemind={remindDelivery}
            onOpen={setOpenId}
          />
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-extrabold text-section">Ruta de la semana</h2>
      <p className="mt-1 text-sm text-muted">La reparte el dueño. Aquí ves qué parada ya se entregó y cuál sigue pendiente.</p>
      <ul className="mt-2 flex flex-col gap-2">
        {stops.length === 0 ? <li className="text-sm text-muted">Esta semana no tienes paradas.</li> : null}
        {stops.map((stop) => {
          const related = weekOrders.filter((order) => order.clientId === stop.id);
          const pending = related.some((order) => order.delivery === "pending");
          const delivered = related.some((order) => order.delivery === "delivered");
          const failed = related.some((order) => order.delivery === "failed");
          const status = pending ? "Pendiente" : delivered ? "Entregado" : failed ? "No entregado" : "Sin pedido";
          const tone = pending ? "blue" : delivered ? "ok" : failed ? "danger" : "muted";
          return (
            <li key={stop.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-card p-3">
              <div>
                <p className="font-semibold">{stop.store}</p>
                <p className="text-sm text-muted">
                  {stop.zone} · {stop.address}
                </p>
              </div>
              <Chip tone={tone}>{status}</Chip>
            </li>
          );
        })}
      </ul>
      {closed.length > 0 ? <h2 className="mt-6 text-lg font-extrabold text-section">Cerradas esta semana</h2> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {closed.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => setOpenId(order.id)}
              className="w-full rounded-2xl border border-line bg-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{storeName(order.clientId, clients)}</p>
                <Chip tone={order.delivery === "delivered" ? "ok" : "danger"}>
                  {order.delivery === "delivered" ? "Entregado" : "Incidencia"}
                </Chip>
              </div>
              <p className="mt-1 text-sm text-muted">{order.deliveryNote || order.id}</p>
              <p className="mt-1 text-sm font-semibold text-blue">Ver ticket</p>
            </button>
            {role === "driver" && order.delivery === "delivered" ? (
              <button
                type="button"
                onClick={() => undoDelivery(order.id)}
                className="mt-2 h-11 w-full rounded-xl border border-line bg-paper font-semibold"
              >
                Aún no entregado
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {openId ? <OrderDetail orderId={openId} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

function laterValue(): string {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DeliveryCard({
  orderId,
  locked,
  onMark,
  onRemind,
  onOpen,
}: {
  orderId: string;
  locked: boolean;
  onMark: (orderId: string, delivery: DeliveryState, note: string) => void;
  onRemind: (orderId: string, at: string) => void;
  onOpen: (orderId: string) => void;
}) {
  const order = useMed((state) => state.orders.find((item) => item.id === orderId));
  const catalog = useMed((state) => state.catalog);
  const people = useMed((state) => state.people);
  const clients = useMed((state) => state.clients);
  const [later, setLater] = useState(laterValue);
  const [open, setOpen] = useState(false);
  if (!order) return null;
  const client = clients.find((item) => item.id === order.clientId) ?? clientById(order.clientId);
  const seller = people.find((person) => person.id === order.sellerId);
  const total = orderTotals(order.lines, order.discountPct).total;
  const phone = client?.phone.replace(/\s/g, "") ?? "";
  const point = client ? clientMapPoint(client) : null;
  const maps = point ? googleLink(point.lat, point.lng) : client ? googleAddressLink(client.address, client.zone) : "";
  return (
    <li className="rounded-2xl border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{client?.store ?? storeName(order.clientId, clients)}</p>
          <p className="text-sm text-muted">
            {client?.address} · {client?.zone}
          </p>
        </div>
        <p className="font-extrabold text-blue-deep tabular-nums">{money(total)}</p>
      </div>
      <p className="mt-2 text-sm text-muted">Pedido de {seller?.name ?? "preventa"}</p>
      <p className="mt-1 text-sm">{lineSummary(order.lines, catalog)}</p>
      {maps ? (
        <a href={maps} target="_blank" rel="noreferrer" className="mt-3 flex h-12 items-center justify-center rounded-xl bg-blue font-semibold text-card">
          Cómo llegar
        </a>
      ) : null}
      <button type="button" onClick={() => setOpen((value) => !value)} className="mt-2 h-12 w-full rounded-xl border border-line bg-paper font-semibold text-title">
        {open ? "Ocultar pedido" : "Ver pedido"}
      </button>
      {open ? (
        <>
      <button type="button" onClick={() => onOpen(order.id)} className="mt-1 text-sm font-semibold text-blue">
        Ver ticket
      </button>
      {phone ? (
        <a href={`tel:${phone}`} className="mt-2 inline-flex h-11 items-center font-semibold text-blue">
          Llamar {client?.phone}
        </a>
      ) : null}
      {order.remindAt ? (
        <p className="mt-2 text-sm font-semibold text-blue-deep">Recordatorio {formatFixTime(order.remindAt)}</p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={() => onMark(order.id, "delivered", "")}
          className="h-11 rounded-xl bg-blue font-semibold text-card disabled:opacity-40"
        >
          Entregado
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => onRemind(order.id, later)}
          className="h-11 rounded-xl border border-line bg-paper font-semibold disabled:opacity-40"
        >
          Más tarde
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => onMark(order.id, "failed", "No se encuentra")}
          className="h-11 rounded-xl border border-line bg-paper font-semibold disabled:opacity-40"
        >
          No se encuentra
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => onMark(order.id, "failed", "Equivocado")}
          className="h-11 rounded-xl border border-line bg-paper font-semibold disabled:opacity-40"
        >
          Equivocado
        </button>
      </div>
      <label className="mt-2 block text-sm text-muted">
        Recordatorio
        <input
          type="datetime-local"
          value={later}
          onChange={(event) => setLater(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
        />
      </label>
        </>
      ) : null}
    </li>
  );
}

