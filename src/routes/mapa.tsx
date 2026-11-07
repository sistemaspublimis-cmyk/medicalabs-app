import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Shell } from "@/components/med/shell";
import type { MapPoint } from "@/components/med/staff-map";
import { AreaBoard } from "@/components/med/area-board";
import { OwnerDesk } from "@/components/med/owner-desk";
import { DeliveryRoute } from "@/components/med/delivery-route";
import { StoreMap, type StoreArea, type StoreMarker, type StorePath } from "@/components/med/store-map";
import type { StaffArea } from "@/components/med/staff-map";
import { PageTitle, PinLegend } from "@/components/med/ui";
import { clientMapPoint } from "@/lib/med/catalog";
import { clientMark, markLabel, markTone, personColor } from "@/lib/med/pins";
import { formatAccuracy, formatFixTime, googleLink, ZONE } from "@/lib/med/locate";
import { operatingDriverId, operatingSellerId, storesForSeller, useMed, zoneSightOf, type DriverFix, type LocationConsent, type WorkArea } from "@/lib/med/store";

export const Route = createFileRoute("/mapa")({
  component: MapPage,
});

function MapPage() {
  const role = useMed((state) => state.role);
  if (role === "driver") return <DriverMap />;
  if (role === "owner" || role === "manager") return <OwnerDesk />;
  return <StorePins />;
}

function toMapArea(area: WorkArea, draft = false): StoreArea {
  return {
    id: area.id,
    name: area.name,
    kind: area.kind,
    points: area.points.map((point) => [point.lat, point.lng]),
    draft,
  };
}

function farEnough(previous: [number, number] | undefined, lat: number, lng: number): boolean {
  if (!previous) return true;
  const north = (lat - previous[0]) * 111_320;
  const east = (lng - previous[1]) * 111_320 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(north, east) > 12;
}

function StorePins() {
  const role = useMed((state) => state.role);
  const people = useMed((state) => state.people);
  const clients = useMed((state) => state.clients);
  const locations = useMed((state) => state.locations);
  const unitConsent = useMed((state) => state.unitConsent);
  const areas = useMed((state) => state.areas);
  const zoneSight = useMed((state) => state.zoneSight);
  const saveWorkArea = useMed((state) => state.saveWorkArea);
  const updateWorkArea = useMed((state) => state.updateWorkArea);
  const sellerId = useMed(operatingSellerId);
  const visits = useMed((state) => state.visits);
  const orders = useMed((state) => state.orders);
  const mapFocusId = useMed((state) => state.mapFocusId);
  const setMapFocus = useMed((state) => state.setMapFocus);
  const [focus, setFocus] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [kind, setKind] = useState<"zona" | "ruta">("zona");
  const [areaName, setAreaName] = useState("");
  const [personId, setPersonId] = useState("");
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapFocusId) return;
    setFocus(mapFocusId);
    setMapFocus(null);
  }, [mapFocusId, setMapFocus]);

  const markers = useMemo(() => {
    const sight = zoneSightOf(zoneSight, sellerId);
    const visible = role === "presale" ? storesForSeller(sellerId, clients, areas, sight === "oculta" ? "oculta" : "tiendas") : clients;
    const next: StoreMarker[] = [];
    for (const client of visible) {
      const point = clientMapPoint(client);
      if (!point) continue;
      const seller = people.find((person) => person.id === client.sellerId);
      const mark = clientMark({ clientId: client.id, role, personId: sellerId, visits, orders });
      next.push({
        id: client.id,
        title: client.store,
        lines: [
          client.address,
          client.zone,
          seller ? seller.routeName || seller.name : "",
          markLabel(mark, role),
        ].filter(Boolean),
        lat: point.lat,
        lng: point.lng,
        tone: markTone(mark),
        href: `/cliente/${client.id}`,
        mapsUrl: googleLink(point.lat, point.lng),
        photo: point.kind === "gps" ? client.facade?.[0] : undefined,
      });
    }
    if (role === "presale") {
      const person = people.find((item) => item.id === sellerId);
      const fix = person && unitConsent[person.id] === "granted" ? locations[person.id]?.[0] : undefined;
      if (person && fix) {
        next.push({
          id: `who-${person.id}`,
          title: person.name,
          lines: ["Tu ubicación", `Última ${formatFixTime(fix.at)}`],
          lat: fix.lat,
          lng: fix.lng,
          tone: "crew",
          color: personColor(person.id),
          mapsUrl: googleLink(fix.lat, fix.lng),
        });
      }
    }
    return next;
  }, [areas, clients, locations, orders, people, role, sellerId, unitConsent, visits, zoneSight]);

  const paths = useMemo<StorePath[]>(() => {
    if (role !== "owner" && role !== "presale") return [];
    return people.flatMap((person) => {
      const field = person.kind === "driver" || person.kind === "presale";
      if (!field) return [];
      if (role === "presale" && person.id !== sellerId) return [];
      if (unitConsent[person.id] !== "granted") return [];
      const trail = locations[person.id] ?? [];
      if (trail.length < 2) return [];
      return [
        {
          id: person.id,
          color: personColor(person.id),
          points: [...trail].reverse().map((point) => [point.lat, point.lng] as [number, number]),
        },
      ];
    });
  }, [locations, people, role, sellerId, unitConsent]);

  const visibleAreas = useMemo(() => {
    if (role === "owner") return areas;
    if (role !== "presale") return [];
    return areas.filter((area) => area.personId === sellerId);
  }, [areas, role, sellerId]);
  const mapAreas = useMemo<StoreArea[]>(() => {
    const saved = visibleAreas.map((area) => toMapArea(area));
    if (!drawing) return saved;
    return [
      ...saved,
      {
        id: "draft",
        name: areaName.trim() || (kind === "zona" ? "Zona nueva" : "Ruta nueva"),
        kind,
        points: draft,
        draft: true,
      },
    ];
  }, [areaName, draft, drawing, kind, visibleAreas]);

  function resetDrawing() {
    setDrawing(false);
    setKind("zona");
    setAreaName("");
    setPersonId("");
    setDraft([]);
    setEditingId(null);
    setAreaError(null);
  }

  function redrawArea(area: WorkArea) {
    setEditingId(area.id);
    setDrawing(true);
    setKind(area.kind);
    setAreaName(area.name);
    setPersonId(area.personId ?? "");
    setDraft(area.points.map((point) => [point.lat, point.lng]));
    setAreaError(null);
  }

  function addDraftPoint(lat: number, lng: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setDraft((current) => {
      if (current.length >= 40 || !farEnough(current[current.length - 1], lat, lng)) return current;
      return [...current, [lat, lng]];
    });
    setAreaError(null);
  }

  function saveArea() {
    const points = draft.map(([lat, lng]) => ({ lat, lng }));
    const result = editingId
      ? updateWorkArea(editingId, { name: areaName, personId: personId || null, kind, points })
      : saveWorkArea({
          name: areaName,
          kind,
          points,
          personId: personId || null,
        });
    if (!result.ok) {
      setAreaError(result.error);
      return;
    }
    resetDrawing();
  }

  const stores = markers.filter((item) => item.tone === "pending" || item.tone === "passed" || item.tone === "done" || item.tone === "store" || item.tone === "gps");
  const drivers = markers.filter((item) => item.tone === "driver");
  const selectedId = focus && markers.some((item) => item.id === focus) ? focus : null;
  const selected = markers.find((item) => item.id === selectedId) ?? null;

  return (
    <Shell>
      <PageTitle
        title="Mapa"
        hint={
          role === "presale"
            ? "Tus tiendas y la zona o ruta que el dueño te asignó."
            : "Cada tienda lleva su nombre. La preventa y el repartidor aparecen aquí cuando aceptan compartir. La app guarda su punto cada 10 minutos, con la app abierta."
        }
      />
      {role === "owner" && !drawing ? (
        <button type="button" onClick={() => setDrawing(true)} className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card">
          Nueva zona o ruta
        </button>
      ) : null}
      {role === "owner" && drawing ? (
        <form
          className="mt-4 rounded-2xl border border-line bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveArea();
          }}
        >
          <h2 className="text-lg font-extrabold text-section">{editingId ? "Editar zona o ruta" : "Nueva zona o ruta"}</h2>
          <label className="mt-3 block text-sm font-semibold">
            Nombre
            <input
              value={areaName}
              onChange={(event) => setAreaName(event.target.value)}
              maxLength={40}
              placeholder={kind === "zona" ? "Ejemplo: Coacalco centro" : "Ejemplo: Ruta norte"}
              className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={kind === "zona"}
              onClick={() => setKind("zona")}
              className={"h-11 rounded-xl border font-semibold " + (kind === "zona" ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")}
            >
              Zona
            </button>
            <button
              type="button"
              aria-pressed={kind === "ruta"}
              onClick={() => setKind("ruta")}
              className={"h-11 rounded-xl border font-semibold " + (kind === "ruta" ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")}
            >
              Ruta
            </button>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Preventa o repartidor
            <select
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
            >
              <option value="">Sin asignar</option>
              {people
                .filter((person) => person.kind === "presale" || person.kind === "driver")
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.kind === "presale" ? "Preventa" : "Reparto"} · {person.name}
                    {person.routeName ? ` · ${person.routeName}` : ""}
                  </option>
                ))}
            </select>
          </label>
          <p className="mt-3 text-sm text-muted">
            {kind === "zona"
              ? "Toca el mapa para marcar las esquinas. Con tres puntos se cierra el área."
              : "Toca el mapa en orden. Con dos puntos ya se ve la línea de la ruta."}
          </p>
        </form>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <i className="size-3 rounded-full bg-blue" aria-hidden="true" /> Tienda
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="size-3 rounded-full bg-ok" aria-hidden="true" /> Registrada con GPS
        </span>
        {role === "owner" || role === "presale" ? (
          <span className="inline-flex items-center gap-2">
            <i className="size-3 rounded-full" style={{ background: "#5b3a8c" }} aria-hidden="true" /> Preventa
          </span>
        ) : null}
        {role === "owner" ? (
          <span className="inline-flex items-center gap-2">
            <i className="size-3 rounded-full bg-banner" aria-hidden="true" /> Repartidor
          </span>
        ) : null}
        {role === "owner" || role === "presale" ? (
          <span className="inline-flex items-center gap-2">
            <i className="h-1 w-6 rounded-full bg-banner" aria-hidden="true" /> Recorrido
          </span>
        ) : null}
        {role === "owner" || visibleAreas.length > 0 ? (
          <span className="inline-flex items-center gap-2">
            <i className="h-3 w-5 rounded-sm border border-blue-deep" style={{ background: "rgba(61, 203, 116, 0.45)" }} aria-hidden="true" /> Zona
          </span>
        ) : null}
        {role === "owner" || visibleAreas.length > 0 ? (
          <span className="inline-flex items-center gap-2">
            <i className="h-1 w-6 rounded-full" style={{ background: "#c45c26" }} aria-hidden="true" /> Ruta de trabajo
          </span>
        ) : null}
      </div>
      <div className="relative z-0 mt-3 overflow-hidden rounded-2xl border border-line bg-card">
        <StoreMap
          markers={markers}
          paths={paths}
          areas={mapAreas}
          drawing={role === "owner" && drawing}
          onMapClick={addDraftPoint}
          selectedId={selectedId}
          onSelect={setFocus}
        />
      </div>
      <PinLegend mode="visita" />
      {role === "owner" && drawing ? (
        <div className="mt-3">
          <p className="text-sm text-muted">
            {draft.length === 1 ? "1 punto" : `${draft.length} puntos`}
          </p>
          {areaError ? <p className="mt-2 text-sm text-danger">{areaError}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDraft((current) => current.slice(0, -1))}
              disabled={draft.length === 0}
              className="h-12 rounded-xl border border-line bg-card font-semibold text-blue-deep disabled:opacity-40"
            >
              Deshacer punto
            </button>
            <button type="button" onClick={saveArea} className="h-12 rounded-xl bg-blue font-semibold text-card">
              {kind === "zona" ? "Guardar zona" : "Guardar ruta"}
            </button>
          </div>
          <button type="button" onClick={resetDrawing} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-danger">
            Cancelar
          </button>
        </div>
      ) : null}
      <AreaBoard areas={visibleAreas} canEdit={role === "owner"} onRedraw={role === "owner" ? redrawArea : undefined} />
      {role === "presale" ? <PresaleZone sellerId={sellerId} /> : null}
      {selected ? (
        <a href={selected.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-11 items-center font-semibold text-blue-deep">
          Abrir {selected.title} en Google Maps
        </a>
      ) : null}
      {stores.length === 0 ? <p className="mt-4 text-sm text-muted">Todavía no hay tiendas con ubicación.</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {stores.map((item) => {
          const active = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(item.id)}
                className={"w-full rounded-2xl border px-4 py-3 text-left " + (active ? "border-blue bg-blue-soft" : "border-line bg-card")}
              >
                <span className="block font-semibold text-blue-deep">{item.title}</span>
                <span className="block text-sm text-muted">{item.lines.slice(0, 2).join(" · ")}</span>
                <span className="mt-1 block text-sm font-semibold text-blue">{item.tone === "gps" ? "GPS de la puerta" : "Punto de la ruta"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {role === "owner" ? <OwnerTrails people={people} locations={locations} unitConsent={unitConsent} onFocus={setFocus} focusId={selectedId} /> : null}
      {role !== "owner" && drivers.length > 0 ? <h2 className="mt-6 text-lg font-extrabold text-section">Reparto</h2> : null}
      {role === "owner" ? null : (
      <ul className="mt-2 flex flex-col gap-2">
        {drivers.map((item) => {
          const active = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(item.id)}
                className={"w-full rounded-2xl border px-4 py-3 text-left " + (active ? "border-blue bg-blue-soft" : "border-line bg-card")}
              >
                <span className="block font-semibold text-blue-deep">{item.title}</span>
                <span className="block text-sm text-muted">{item.lines.join(" · ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      )}
      <p className="mt-4 text-sm text-muted">
        El repartidor ve su propia unidad, no este mapa de tiendas.{" "}
        <Link to="/clientes" className="font-semibold text-blue-deep">
          Ver clientes
        </Link>
      </p>
    </Shell>
  );
}

function OwnerTrails({
  people,
  locations,
  unitConsent,
  onFocus,
  focusId,
}: {
  people: { id: string; name: string; routeName: string; kind: string }[];
  locations: Record<string, DriverFix[]>;
  unitConsent: Record<string, LocationConsent>;
  onFocus: (id: string) => void;
  focusId: string | null;
}) {
  const journal = useMed((state) => state.journal) ?? [];
  const rows = people.filter((person) => person.kind === "driver" || person.kind === "presale");
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-extrabold text-section">Dónde están</h2>
        <Link to="/bitacora" className="text-sm font-semibold text-blue-deep">
          Bitácora
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">Cada preventa y cada repartidor. El punto se guarda cada 10 minutos si su app está abierta y aceptaron compartir. Cada venta, visita, entrega y registro queda en la bitácora.</p>
      {rows.map((person) => {
        const shared = unitConsent[person.id] === "granted";
        const trail = shared ? (locations[person.id] ?? []) : [];
        const puesto = person.kind === "driver" ? "Repartidor" : "Preventa";
        const markerId = `who-${person.id}`;
        const active = focusId === markerId;
        const last = journal.find((entry) => entry.personId === person.id);
        return (
          <div key={person.id} className="mt-3">
            <button
              type="button"
              disabled={trail.length === 0}
              aria-pressed={active}
              onClick={() => onFocus(markerId)}
              className={"w-full rounded-2xl border px-4 py-3 text-left " + (active ? "border-blue bg-blue-soft" : "border-line bg-card")}
            >
              <span className="block font-semibold text-blue-deep">{person.name}</span>
              <span className="block text-sm text-muted">
                {puesto}
                {person.routeName ? ` · ${person.routeName}` : ""}
                {" · "}
                {!shared
                  ? "No está compartiendo su ubicación."
                  : trail.length === 0
                    ? "Aceptó. La primera lectura llega con la app abierta."
                    : trail.length === 1
                      ? `Última ${formatFixTime(trail[0].at)}. La línea se dibuja con la siguiente.`
                      : `${trail.length} lecturas · última ${formatFixTime(trail[0].at)}`}
              </span>
              <span className="mt-1 block text-sm">{last ? last.title : "Sin movimientos registrados."}</span>
            </button>
            {trail.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {trail.slice(0, 12).map((point, index) => (
                <li key={`${point.at}-${index}`} className="rounded-2xl border border-line bg-card px-3 py-2">
                  <p className="font-semibold">{formatFixTime(point.at)}</p>
                  <p className="text-sm text-muted tabular-nums">
                    {point.lat.toFixed(5)}, {point.lng.toFixed(5)} {formatAccuracy(point.accuracy)}
                  </p>
                </li>
              ))}
            </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function staffAreas(areas: WorkArea[]): StaffArea[] {
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    kind: area.kind,
    points: area.points.map((point) => [point.lat, point.lng] as [number, number]),
  }));
}

function DriverMap() {
  const people = useMed((state) => state.people);
  const locations = useMed((state) => state.locations);
  const consent = useMed((state) => state.locationConsent);
  const areas = useMed((state) => state.areas);
  const driverId = useMed(operatingDriverId);
  const driver = people.find((person) => person.id === driverId);
  const trail = locations[driverId] ?? [];
  const last = trail[0];
  const point = last ? [{ id: driverId, name: driver?.name ?? "Tu unidad", lat: last.lat, lng: last.lng }] : [];
  const path = [...trail].reverse().map((point) => [point.lat, point.lng] as [number, number]);
  const mine = staffAreas(areas.filter((area) => area.personId === driverId));

  return (
    <Shell>
      <PageTitle title="Mapa" hint="Dirección y punto de cada tienda que entregas hoy." />
      <DeliveryRoute driverId={driverId} />
      {consent !== "granted" ? (
        <p className="mt-4 rounded-2xl border border-line bg-card p-3 text-sm text-muted">
          Sin tu aceptación no hay punto en el mapa del dueño.
        </p>
      ) : null}
      {last ? (
        <FixBlock
          title={driver?.name ?? "Tu unidad"}
          subtitle={`${driver?.routeName ?? "Reparto"} · ${formatFixTime(last.at)} ${formatAccuracy(last.accuracy)}`}
          fix={last}
          points={point}
          path={path}
          areas={mine}
        />
      ) : (
        <ZoneBlock areas={mine} />
      )}
      <AreaBoard areas={areas.filter((area) => area.personId === driverId)} canEdit={false} />
      {trail.length > 0 ? <Trail trail={trail} /> : null}
    </Shell>
  );
}

function FixBlock({
  title,
  subtitle,
  fix,
  points,
  path = [],
  areas = [],
  center,
}: {
  title: string;
  subtitle: string;
  fix: DriverFix | null;
  points: MapPoint[];
  path?: [number, number][];
  areas?: StaffArea[];
  center?: { lat: number; lng: number };
}) {
  const here = center ?? (fix ? { lat: fix.lat, lng: fix.lng } : ZONE);
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-section">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {fix ? (
          <a href={googleLink(fix.lat, fix.lng)} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-blue-deep">
            Abrir en Google Maps
          </a>
        ) : null}
      </div>
      <LiveMap points={points} center={here} path={path} areas={areas} />
      {fix ? (
        <p className="mt-2 text-sm text-muted tabular-nums">
          {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
        </p>
      ) : null}
    </section>
  );
}

function ZoneBlock({ areas = [] }: { areas?: StaffArea[] }) {
  return (
    <section className="mt-4">
      <h2 className="text-lg font-extrabold text-section">Zona de reparto</h2>
      <p className="mt-1 text-sm text-muted">
        {areas.length > 0
          ? "Todavía no hay GPS guardado. El mapa muestra tu zona o ruta y el centro de Coacalco, no la posición de una unidad."
          : `Todavía no hay GPS guardado. El mapa muestra ${ZONE.label}, no la posición de una unidad.`}
      </p>
      <div className="mt-2">
        <LiveMap points={[]} center={ZONE} areas={areas} />
      </div>
      <a
        href={googleLink(ZONE.lat, ZONE.lng)}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex text-sm font-semibold text-blue-deep"
      >
        Abrir Coacalco en Google Maps
      </a>
    </section>
  );
}

function Trail({ trail }: { trail: DriverFix[] }) {
  return (
    <section className="mt-4">
      <h2 className="text-lg font-extrabold text-section">Lecturas guardadas</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {trail.slice(0, 8).map((point, index) => (
          <li key={`${point.at}-${index}`} className="rounded-2xl border border-line bg-card px-3 py-2">
            <p className="font-semibold">{formatFixTime(point.at)}</p>
            <p className="text-sm text-muted tabular-nums">
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)} {formatAccuracy(point.accuracy)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LiveMap({
  points,
  center,
  path = [],
  areas = [],
}: {
  points: MapPoint[];
  center: { lat: number; lng: number };
  path?: [number, number][];
  areas?: StaffArea[];
}) {
  const [View, setView] = useState<ComponentType<{
    points: MapPoint[];
    center: { lat: number; lng: number };
    path?: [number, number][];
    areas?: StaffArea[];
  }> | null>(null);
  useEffect(() => {
    let alive = true;
    void import("@/components/med/staff-map").then((mod) => {
      if (alive) setView(() => mod.StaffMap);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!View) return <div className="h-80 rounded-2xl border border-line bg-blue-soft" />;
  return <View points={points} center={center} path={path} areas={areas} />;
}

function PresaleZone({ sellerId }: { sellerId: string }) {
  const clients = useMed((state) => state.clients);
  const areas = useMed((state) => state.areas) ?? [];
  const mine = areas.filter((area) => area.personId === sellerId);
  const stores = storesForSeller(sellerId, clients, areas, "tiendas");
  return (
    <section className="mt-4">
      <h2 className="text-lg font-extrabold text-section">Tu zona</h2>
      <p className="mt-1 text-sm text-muted">
        {mine.length === 0
          ? "El dueño todavía no te asigna una zona o una ruta. Cuando lo haga, la figura se ve en el mapa."
          : mine.map((area) => `${area.kind === "zona" ? "Zona" : "Ruta"} ${area.name}`).join(" · ")}
      </p>
      <h2 className="mt-4 text-lg font-extrabold text-section">Tiendas de tu zona</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {stores.length === 0 ? <li className="text-sm text-muted">El dueño todavía no designa tiendas en tu zona.</li> : null}
        {stores.map((store) => (
          <li key={store.id}>
            <Link to="/cliente/$clientId" params={{ clientId: store.id }} className="block rounded-2xl border border-line bg-card p-3">
              <p className="font-semibold">{store.store}</p>
              <p className="text-sm text-muted">{store.address || "Sin dirección"}{store.zone ? ` · ${store.zone}` : ""}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
