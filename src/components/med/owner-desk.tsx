import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AreaBoard } from "@/components/med/area-board";
import { Shell } from "@/components/med/shell";
import { StoreMap, type StoreArea, type StoreMarker, type StorePath } from "@/components/med/store-map";
import { PageTitle } from "@/components/med/ui";
import { clientMapPoint, MANAGER_ID, type ClientStop, type CrewMember } from "@/lib/med/catalog";
import { personColor } from "@/lib/med/pins";
import { areaColor, assignedZones, hace, isFresh, leftZone, localDay, todayKey, whereLabel, zoneNames } from "@/lib/med/desk";
import { clampPing, formatFixTime, googleLink, ZONE } from "@/lib/med/locate";
import { useMed, type DriverFix, type JournalEntry, type WorkArea } from "@/lib/med/store";

type DeskTab = "mapa" | "zonas" | "historial" | "equipo" | "ajustes";
type CrewFilter = "todos" | "linea" | "fuera";

const TABS: { id: DeskTab; label: string }[] = [
  { id: "mapa", label: "Mapa" },
  { id: "zonas", label: "Zonas" },
  { id: "historial", label: "Historial" },
  { id: "equipo", label: "Equipo" },
  { id: "ajustes", label: "Ajustes" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("") || "·";
}

function farEnough(previous: [number, number] | undefined, lat: number, lng: number): boolean {
  if (!previous) return true;
  const north = (lat - previous[0]) * 111_320;
  const east = (lng - previous[1]) * 111_320 * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(north, east) > 12;
}

function toMapArea(area: WorkArea, index: number, people: CrewMember[], draft = false): StoreArea {
  const person = people.find((item) => item.id === area.personId);
  return {
    id: area.id,
    name: area.name,
    caption: `${area.name} · ${person?.name ?? "Sin asignar"}`,
    kind: area.kind,
    points: area.points.map((point) => [point.lat, point.lng]),
    color: areaColor(area, index),
    draft,
  };
}

export function OwnerDesk() {
  const role = useMed((state) => state.role);
  const people = useMed((state) => state.people);
  const areas = useMed((state) => state.areas);
  const canEdit = role === "owner";
  const crew = people.filter((person) => person.kind === "presale" || person.kind === "driver");
  const visiblePeople = role === "manager" ? crew.filter((person) => person.leadId === MANAGER_ID) : crew;
  const visibleAreas = role === "manager" ? areas.filter((area) => area.personId && visiblePeople.some((person) => person.id === area.personId)) : areas;
  const locations = useMed((state) => state.locations);
  const unitConsent = useMed((state) => state.unitConsent);
  const clients = useMed((state) => state.clients);
  const journal = useMed((state) => state.journal) ?? [];
  const pingMinutes = clampPing(useMed((state) => state.pingMinutes));
  const companyName = useMed((state) => state.companyName) || "Medicalabs";
  const updateWorkArea = useMed((state) => state.updateWorkArea);
  const saveWorkArea = useMed((state) => state.saveWorkArea);
  const [tab, setTab] = useState<DeskTab>("mapa");
  const [historyId, setHistoryId] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const apply = () => {
      const match = /^#historial-([A-Za-z0-9-]+)$/.exec(window.location.hash);
      if (!match) return;
      setTab("historial");
      setHistoryId(match[1]);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function openHistory(personId: string) {
    setHistoryId(personId);
    setTab("historial");
    const next = `#historial-${personId}`;
    if (window.location.hash !== next) window.location.hash = next;
  }

  function giveZone(personId: string, areaId: string) {
    const zonas = areas.filter((area) => area.kind === "zona");
    if (!areaId) {
      for (const area of zonas) {
        if (area.personId === personId) updateWorkArea(area.id, { name: area.name, personId: null });
      }
      return;
    }
    const target = zonas.find((area) => area.id === areaId);
    if (!target) return;
    for (const area of zonas) {
      if (area.personId === personId && area.id !== target.id) updateWorkArea(area.id, { name: area.name, personId: null });
    }
    if (target.personId !== personId) updateWorkArea(target.id, { name: target.name, personId });
  }

  return (
    <Shell>
      <PageTitle
        title={`${companyName} · ${ZONE.label}`}
        hint={
          canEdit
            ? "La última ubicación guardada de cada persona se queda en el mapa. Cada quien tiene su color."
            : "Ves al equipo que el dueño te asignó y la última ubicación guardada de cada uno."
        }
      />
      {role === "manager" && visiblePeople.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-card p-3 text-sm text-hint">El dueño todavía no te asigna gente.</p>
      ) : null}
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(canEdit ? TABS : TABS.filter((item) => item.id === "mapa" || item.id === "historial" || item.id === "equipo")).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={"h-11 shrink-0 rounded-xl px-4 font-semibold " + (tab === item.id ? "bg-blue text-card" : "border border-line bg-card text-blue-deep")}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "mapa" ? (
        <LiveMap
          people={visiblePeople}
          areas={visibleAreas}
          locations={locations}
          unitConsent={unitConsent}
          clients={clients}
          minutes={pingMinutes}
          now={now}
          canAssign={canEdit}
          onHistory={openHistory}
          onAssign={giveZone}
        />
      ) : null}
      {tab === "zonas" ? <ZoneStudio people={people} areas={areas} saveWorkArea={saveWorkArea} /> : null}
      {tab === "historial" ? (
        <HistoryBoard people={visiblePeople} locations={locations} journal={journal} personId={historyId} onPerson={setHistoryId} />
      ) : null}
      {tab === "equipo" ? <CrewBoard people={visiblePeople} areas={visibleAreas} /> : null}
      {tab === "ajustes" ? <SettingsBoard areas={areas} minutes={pingMinutes} companyName={companyName} /> : null}
    </Shell>
  );
}

function LiveMap({
  people,
  areas,
  locations,
  unitConsent,
  clients,
  minutes,
  now,
  canAssign,
  onHistory,
  onAssign,
}: {
  people: CrewMember[];
  areas: WorkArea[];
  locations: Record<string, DriverFix[]>;
  unitConsent: Record<string, "unknown" | "granted" | "denied">;
  clients: ClientStop[];
  minutes: number;
  now: number;
  canAssign: boolean;
  onHistory: (personId: string) => void;
  onAssign: (personId: string, areaId: string) => void;
}) {
  const [filter, setFilter] = useState<CrewFilter>("todos");
  const [focus, setFocus] = useState<string | null>(null);
  const [homeTick, setHomeTick] = useState(0);
  const [showStores, setShowStores] = useState(false);
  const presales = people.filter((person) => person.kind === "presale");
  const drivers = people.filter((person) => person.kind === "driver");
  const zonas = areas.filter((area) => area.kind === "zona");

  const rows = useMemo(() => {
    return [...presales, ...drivers].map((person) => {
      const shared = unitConsent[person.id] === "granted";
      const fix = locations[person.id]?.[0];
      const fresh = fix ? isFresh(fix.at, minutes, now) : false;
      const point = fix ? { lat: fix.lat, lng: fix.lng } : null;
      return { person, shared, fix, fresh, point, outside: leftZone(areas, point, person.id) };
    });
  }, [areas, drivers, locations, minutes, now, presales, unitConsent]);

  function visible(row: (typeof rows)[number]): boolean {
    if (filter === "linea") return row.fresh;
    if (filter === "fuera") return row.outside;
    return true;
  }

  const shown = rows.filter(visible);
  const mapAreas = areas.map((area, index) => toMapArea(area, index, people));
  const markers = useMemo(() => {
    const next: StoreMarker[] = [];
    if (showStores) {
      for (const client of clients) {
        const point = clientMapPoint(client);
        if (!point) continue;
        next.push({
          id: client.id,
          title: client.store,
          lines: [client.address, client.zone].filter(Boolean),
          lat: point.lat,
          lng: point.lng,
          tone: point.kind === "gps" ? "gps" : "store",
          href: `/cliente/${client.id}`,
          mapsUrl: googleLink(point.lat, point.lng),
          photo: point.kind === "gps" ? client.facade?.[0] : undefined,
        });
      }
    }
    for (const row of shown) {
      if (!row.fix) continue;
      const puesto = row.person.kind === "driver" ? "Repartidor" : "Preventa";
      next.push({
        id: `who-${row.person.id}`,
        title: row.person.name,
        lines: [puesto, row.fresh ? hace(row.fix.at, now) : `Última guardada ${hace(row.fix.at, now)}`, whereLabel(areas, row.point, row.person.id)],
        lat: row.fix.lat,
        lng: row.fix.lng,
        tone: "crew",
        color: personColor(row.person.id),
        mapsUrl: googleLink(row.fix.lat, row.fix.lng),
        actionHref: `#historial-${row.person.id}`,
        actionLabel: "Ver historial del día",
      });
    }
    return next;
  }, [areas, clients, now, showStores, shown]);

  const counts = {
    todos: rows.length,
    linea: rows.filter((row) => row.fresh).length,
    fuera: rows.filter((row) => row.outside).length,
  };

  return (
    <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-3">
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <FilterChip pressed={filter === "todos"} onClick={() => setFilter("todos")} label={`Todos ${counts.todos}`} />
          <FilterChip pressed={filter === "linea"} onClick={() => setFilter("linea")} label={`En línea ${counts.linea}`} />
          <FilterChip pressed={filter === "fuera"} onClick={() => setFilter("fuera")} label={`Fuera de zona ${counts.fuera}`} />
        </div>
        <div className="relative z-0 overflow-hidden rounded-2xl border border-line bg-card">
          <StoreMap
            markers={markers}
            areas={mapAreas}
            fit="zone"
            homeTick={homeTick}
            className="h-[68vh] min-h-[22rem] w-full"
            selectedId={focus}
            openSelected
            onSelect={setFocus}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
          <button type="button" onClick={() => { setFocus(null); setHomeTick((value) => value + 1); }} className="font-semibold text-blue-deep">
            Centrar Coacalco
          </button>
          <button type="button" aria-pressed={showStores} onClick={() => setShowStores((value) => !value)} className="font-semibold text-blue-deep">
            {showStores ? "Ocultar tiendas" : "Ver tiendas"}
          </button>
          <span>{minutes === 1 ? "En línea: último minuto" : `En línea: últimos ${minutes} minutos`}</span>
        </div>
      </div>
      <aside className="mt-4 lg:mt-0">
        <CrewList title="Preventa" rows={shown.filter((row) => row.person.kind === "presale")} zonas={zonas} now={now} canAssign={canAssign} onFocus={setFocus} onHistory={onHistory} onAssign={onAssign} />
        <CrewList title="Reparto" rows={shown.filter((row) => row.person.kind === "driver")} zonas={zonas} now={now} canAssign={canAssign} onFocus={setFocus} onHistory={onHistory} onAssign={onAssign} />
        {shown.length === 0 ? <p className="mt-3 text-sm text-muted">Nadie coincide con ese filtro.</p> : null}
      </aside>
    </div>
  );
}

function FilterChip({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={"h-10 rounded-full px-3 text-sm font-semibold " + (pressed ? "bg-blue-deep text-card" : "border border-line bg-card text-blue-deep")}
    >
      {label}
    </button>
  );
}

function CrewList({
  title,
  rows,
  zonas,
  now,
  canAssign,
  onFocus,
  onHistory,
  onAssign,
}: {
  title: string;
  rows: { person: CrewMember; shared: boolean; fix?: DriverFix; fresh: boolean; outside: boolean }[];
  zonas: WorkArea[];
  now: number;
  canAssign: boolean;
  onFocus: (id: string) => void;
  onHistory: (personId: string) => void;
  onAssign: (personId: string, areaId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-3 first:mt-0">
      <h2 className="text-lg font-extrabold text-section">{title}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <PersonCard key={row.person.id} row={row} zonas={zonas} now={now} canAssign={canAssign} onFocus={onFocus} onHistory={onHistory} onAssign={onAssign} />
        ))}
      </ul>
    </section>
  );
}

function PersonCard({
  row,
  zonas,
  now,
  canAssign,
  onFocus,
  onHistory,
  onAssign,
}: {
  row: { person: CrewMember; shared: boolean; fix?: DriverFix; fresh: boolean; outside: boolean };
  zonas: WorkArea[];
  now: number;
  canAssign: boolean;
  onFocus: (id: string) => void;
  onHistory: (personId: string) => void;
  onAssign: (personId: string, areaId: string) => void;
}) {
  const { person, shared, fix, fresh, outside } = row;
  const mine = assignedZones(zonas, person.id)[0]?.id ?? "";
  const [pick, setPick] = useState(mine);
  const [showAssign, setShowAssign] = useState(!mine);
  const status = !fix ? (shared ? "Aceptó. Aún no hay lectura." : "Sin ubicación guardada") : fresh ? `En línea · ${hace(fix.at, now)}` : `Última guardada ${hace(fix.at, now)}`;
  return (
    <li className="rounded-2xl border border-line bg-card p-3">
      <button type="button" onClick={() => fix && onFocus(`who-${person.id}`)} className="flex w-full items-center gap-3 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-card" style={{ background: personColor(person.id) }}>{initials(person.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-blue-deep">{person.name}</span>
          <span className="block text-sm text-muted">{status}</span>
          <span className="block text-sm">{zoneNames(zonas, person.id)}</span>
          {outside ? <span className="block text-sm font-semibold text-danger">Salió de su zona</span> : null}
        </span>
      </button>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => onHistory(person.id)} className="h-10 rounded-xl border border-line px-3 text-sm font-semibold text-blue-deep">
          Historial del día
        </button>
      </div>
      {canAssign && person.kind === "presale" && zonas.length > 0 && !showAssign ? (
        <button type="button" onClick={() => setShowAssign(true)} className="mt-2 h-10 rounded-xl border border-line px-3 text-sm font-semibold text-kicker">
          Cambiar zona
        </button>
      ) : null}
      {canAssign && person.kind === "presale" && zonas.length > 0 && showAssign ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onAssign(person.id, pick);
            setShowAssign(false);
          }}
        >
          <select value={pick} onChange={(event) => setPick(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-paper px-2 text-sm">
            <option value="">Sin zona</option>
            {zonas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-10 shrink-0 rounded-xl bg-blue px-3 text-sm font-semibold text-card">
            Cambiar zona
          </button>
        </form>
      ) : null}
    </li>
  );
}

function ZoneStudio({
  people,
  areas,
  saveWorkArea,
}: {
  people: CrewMember[];
  areas: WorkArea[];
  saveWorkArea: (input: { name: string; kind: "zona" | "ruta"; points: { lat: number; lng: number }[]; personId: string | null }) => { ok: true; id: string } | { ok: false; error: string };
}) {
  const updateWorkArea = useMed((state) => state.updateWorkArea);
  const [drawing, setDrawing] = useState(false);
  const [kind, setKind] = useState<"zona" | "ruta">("zona");
  const [areaName, setAreaName] = useState("");
  const [personId, setPersonId] = useState("");
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);

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
      : saveWorkArea({ name: areaName, kind, points, personId: personId || null });
    if (!result.ok) {
      setAreaError(result.error);
      return;
    }
    resetDrawing();
  }

  const mapAreas = [
    ...areas.map((area, index) => toMapArea(area, index, people)),
    ...(drawing
      ? [
          {
            id: "draft",
            name: areaName.trim() || (kind === "zona" ? "Zona nueva" : "Ruta nueva"),
            kind,
            points: draft,
            draft: true,
          } satisfies StoreArea,
        ]
      : []),
  ];

  return (
    <div className="mt-3">
      {!drawing ? (
        <button type="button" onClick={() => setDrawing(true)} className="h-12 w-full rounded-xl bg-blue font-semibold text-card">
          Nueva zona o ruta
        </button>
      ) : (
        <form
          className="rounded-2xl border border-line bg-card p-4"
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
            <button type="button" aria-pressed={kind === "zona"} onClick={() => setKind("zona")} className={"h-11 rounded-xl border font-semibold " + (kind === "zona" ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")}>
              Zona
            </button>
            <button type="button" aria-pressed={kind === "ruta"} onClick={() => setKind("ruta")} className={"h-11 rounded-xl border font-semibold " + (kind === "ruta" ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")}>
              Ruta
            </button>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Preventa o repartidor
            <select value={personId} onChange={(event) => setPersonId(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium">
              <option value="">Sin asignar</option>
              {people
                .filter((person) => person.kind === "presale" || person.kind === "driver")
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.kind === "presale" ? "Preventa" : "Reparto"} · {person.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="mt-3 text-sm text-muted">
            {kind === "zona" ? "Toca el mapa para marcar las esquinas. Con tres puntos se cierra el área." : "Toca el mapa en orden. Con dos puntos ya se ve la línea de la ruta."}
          </p>
          <p className="mt-2 text-sm text-muted">{draft.length === 1 ? "1 punto" : `${draft.length} puntos`}</p>
          {areaError ? <p className="mt-2 text-sm text-danger">{areaError}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDraft((current) => current.slice(0, -1))} disabled={draft.length === 0} className="h-12 rounded-xl border border-line bg-card font-semibold text-blue-deep disabled:opacity-40">
              Deshacer punto
            </button>
            <button type="submit" className="h-12 rounded-xl bg-blue font-semibold text-card">
              {kind === "zona" ? "Guardar zona" : "Guardar ruta"}
            </button>
          </div>
          <button type="button" onClick={resetDrawing} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-danger">
            Cancelar
          </button>
        </form>
      )}
      <div className="relative z-0 mt-3 overflow-hidden rounded-2xl border border-line bg-card">
        <StoreMap markers={[]} areas={mapAreas} drawing={drawing} onMapClick={addDraftPoint} fit="fit" className="h-[52vh] min-h-80 w-full" />
      </div>
      <AreaBoard areas={areas} canEdit onRedraw={redrawArea} />
      {areas.length === 0 ? <p className="mt-3 text-sm text-muted">Todavía no hay zonas. Dibuja la primera sobre Coacalco.</p> : null}
    </div>
  );
}

function HistoryBoard({
  people,
  locations,
  journal,
  personId,
  onPerson,
}: {
  people: CrewMember[];
  locations: Record<string, DriverFix[]>;
  journal: JournalEntry[];
  personId: string;
  onPerson: (id: string) => void;
}) {
  const field = people.filter((person) => person.kind === "presale" || person.kind === "driver");
  const selected = field.find((person) => person.id === personId)?.id ?? field.find((person) => person.kind === "presale")?.id ?? field[0]?.id ?? "";
  const [day, setDay] = useState(todayKey);
  const fixes = (locations[selected] ?? []).filter((fix) => localDay(fix.at) === day).slice().reverse();
  const acts = journal.filter((entry) => entry.personId === selected && localDay(entry.at) === day);
  const fallback = acts.filter((entry) => entry.lat != null && entry.lng != null);
  const path: StorePath[] =
    fixes.length > 1
      ? [{ id: selected, points: fixes.map((fix) => [fix.lat, fix.lng]), color: "#5b3a8c" }]
      : [];
  const spots = fixes.length
    ? fixes.map((fix) => ({ id: fix.at, title: formatFixTime(fix.at), at: fix.at, lat: fix.lat, lng: fix.lng }))
    : fallback.flatMap((entry) =>
        entry.lat == null || entry.lng == null ? [] : [{ id: entry.id, title: entry.title, at: entry.at, lat: entry.lat, lng: entry.lng }],
      );
  const markers: StoreMarker[] = spots.map((item) => ({
    id: item.id,
    title: item.title,
    lines: [formatFixTime(item.at)],
    lat: item.lat,
    lng: item.lng,
    tone: "presale",
    mapsUrl: googleLink(item.lat, item.lng),
  }));

  return (
    <div className="mt-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Persona
          <select value={selected} onChange={(event) => onPerson(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base font-medium">
            {field.map((person) => (
              <option key={person.id} value={person.id}>
                {person.kind === "presale" ? "Preventa" : "Reparto"} · {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Día
          <input type="date" value={day} onChange={(event) => setDay(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-line bg-card px-3 text-base font-medium" />
        </label>
      </div>
      <p className="mt-2 text-sm text-muted">Recorrido guardado en este teléfono. Si ese día no hubo lectura, el mapa se queda en Coacalco.</p>
      <div className="relative z-0 mt-3 overflow-hidden rounded-2xl border border-line bg-card">
        <StoreMap markers={markers} paths={path} fit={markers.length > 0 ? "fit" : "zone"} className="h-[52vh] min-h-80 w-full" />
      </div>
      {markers.length === 0 ? <p className="mt-3 text-sm text-muted">Ese día no hay recorrido.</p> : null}
      {acts.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {acts.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-line bg-card px-3 py-2">
              <p className="font-semibold">{entry.title}</p>
              <p className="text-sm text-muted">{formatFixTime(entry.at)}{entry.place ? ` · ${entry.place}` : ""}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CrewBoard({ people, areas }: { people: CrewMember[]; areas: WorkArea[] }) {
  const presales = people.filter((person) => person.kind === "presale");
  return (
    <div className="mt-3">
      <Link to="/personal" className="flex h-12 items-center justify-center rounded-xl bg-blue font-semibold text-card">
        Agregar o quitar en Personal
      </Link>
      <ul className="mt-3 flex flex-col gap-2">
        {presales.map((person) => (
          <li key={person.id} className="rounded-2xl border border-line bg-card p-3">
            <p className="font-semibold text-blue-deep">{person.name}</p>
            <p className="text-sm text-muted">{person.routeName || "Sin ruta"} · {zoneNames(areas, person.id)}</p>
            {person.phone ? (
              <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className="mt-1 inline-flex font-semibold text-blue-deep">
                {person.phone}
              </a>
            ) : (
              <p className="mt-1 text-sm text-muted">Sin teléfono</p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">Ana y Luis vienen con la app. Desde Personal se agregan preventas nuevas y se quitan las que no son fijas.</p>
    </div>
  );
}

function SettingsBoard({ areas, minutes, companyName }: { areas: WorkArea[]; minutes: number; companyName: string }) {
  const setDesk = useMed((state) => state.setDesk);
  const updateWorkArea = useMed((state) => state.updateWorkArea);
  const [company, setCompany] = useState(companyName);
  const [every, setEvery] = useState(String(minutes));
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="mt-3 rounded-2xl border border-line bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setDesk({ companyName: company, pingMinutes: Number(every) });
        setSaved(true);
      }}
    >
      <label className="block text-sm font-semibold">
        Nombre de la empresa
        <input value={company} onChange={(event) => { setCompany(event.target.value); setSaved(false); }} maxLength={40} className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium" />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Minutos entre lecturas
        <input
          type="number"
          min={3}
          max={30}
          value={every}
          onChange={(event) => { setEvery(event.target.value); setSaved(false); }}
          className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
        />
      </label>
      <p className="mt-2 text-sm text-muted">
        En línea significa que la última lectura no pasa de estos minutos. Este teléfono manda el punto al entrar y luego con ese tiempo, con la app abierta. El teléfono de cada preventa usa el tiempo guardado ahí.
      </p>
      <button type="submit" className="mt-3 h-12 w-full rounded-xl bg-blue font-semibold text-card">
        Guardar ajustes
      </button>
      {saved ? <p className="mt-2 text-sm font-semibold text-blue-deep">Quedó guardado en este teléfono.</p> : null}
      {areas.length > 0 ? <h2 className="mt-5 text-lg font-extrabold text-section">Colores</h2> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {areas.map((area, index) => (
          <li key={area.id} className="flex items-center gap-3">
            <input
              type="color"
              aria-label={`Color de ${area.name}`}
              value={areaColor(area, index)}
              onChange={(event) => updateWorkArea(area.id, { name: area.name, personId: area.personId, color: event.target.value })}
              className="size-11 rounded-lg border border-line bg-paper"
            />
            <span className="font-semibold">{area.name}</span>
          </li>
        ))}
      </ul>
    </form>
  );
}
