import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/med/shell";
import { StoreMap, type StoreMarker, type StorePath } from "@/components/med/store-map";
import { Chip, PageTitle } from "@/components/med/ui";
import { formatFixTime, googleLink } from "@/lib/med/locate";
import { useMed, type JournalEntry, type JournalKind } from "@/lib/med/store";

export const Route = createFileRoute("/bitacora")({
  component: BitacoraPage,
});

const KIND_LABEL: Record<JournalKind, string> = {
  venta: "Venta",
  visita: "Visita",
  entrega: "Entrega",
  incidencia: "Incidencia",
  recordatorio: "Recordatorio",
  tienda: "Registro",
  carga: "Carga",
  producto: "Producto",
  personal: "Personal",
  gasto: "Gasto",
  zona: "Zona",
  ruta: "Ruta",
  sesion: "Entrada",
  jornada: "Jornada",
  aviso: "Aviso",
  inventario: "Inventario",
};

function BitacoraPage() {
  const people = useMed((state) => state.people);
  const locations = useMed((state) => state.locations);
  const unitConsent = useMed((state) => state.unitConsent);
  const journal = useMed((state) => state.journal) ?? [];
  const [personId, setPersonId] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const crew = people.filter((person) => person.kind === "presale" || person.kind === "driver");
  const rows = journal.filter((entry) => personId === "todos" || entry.personId === personId);
  const selected = rows.find((entry) => entry.id === selectedId) ?? null;

  const markers = useMemo(() => {
    const pins: StoreMarker[] = [];
    const visible = journal.filter((entry) => personId === "todos" || entry.personId === personId);
    for (const person of people) {
      if (person.kind !== "presale" && person.kind !== "driver") continue;
      if (unitConsent[person.id] !== "granted") continue;
      if (personId !== "todos" && person.id !== personId) continue;
      const fix = locations[person.id]?.[0];
      if (!fix) continue;
      const last = journal.find((entry) => entry.personId === person.id);
      pins.push({
        id: `who-${person.id}`,
        title: person.name,
        lines: [person.kind === "driver" ? "Repartidor" : "Preventa", `Última lectura ${formatFixTime(fix.at)}`, last?.title ?? "Sin movimientos"],
        lat: fix.lat,
        lng: fix.lng,
        tone: person.kind === "driver" ? "driver" : "presale",
        mapsUrl: googleLink(fix.lat, fix.lng),
      });
    }
    for (const entry of visible) {
      if (entry.lat == null || entry.lng == null) continue;
      if (pins.length > 48) break;
      pins.push({
        id: entry.id,
        title: entry.place || entry.title,
        lines: [whoName(people, entry.personId), entry.title, formatFixTime(entry.at)],
        lat: entry.lat,
        lng: entry.lng,
        tone: "gps",
        mapsUrl: googleLink(entry.lat, entry.lng),
      });
    }
    return pins;
  }, [journal, locations, people, personId, unitConsent]);

  const paths = useMemo(() => {
    const lines: StorePath[] = [];
    for (const person of people) {
      if (person.kind !== "presale" && person.kind !== "driver") continue;
      if (unitConsent[person.id] !== "granted") continue;
      if (personId !== "todos" && person.id !== personId) continue;
      const trail = locations[person.id] ?? [];
      if (trail.length < 2) continue;
      lines.push({
        id: `path-${person.id}`,
        points: [...trail].reverse().map((point) => [point.lat, point.lng]),
        color: person.kind === "driver" ? "#2f9fe0" : "#5b3a8c",
      });
    }
    return lines;
  }, [locations, people, personId, unitConsent]);

  return (
    <Shell>
      <PageTitle title="Bitácora" hint="Dónde está cada persona y qué hizo, con la hora. Si hubo GPS, el movimiento queda en ese punto." />
      <div className="mt-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-section">Equipo ahora</h2>
        <Link to="/mapa" className="text-sm font-semibold text-blue-deep">
          Ver mapa
        </Link>
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {crew.map((person) => {
          const shared = unitConsent[person.id] === "granted";
          const fix = shared ? locations[person.id]?.[0] : undefined;
          const last = journal.find((entry) => entry.personId === person.id);
          return (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => setPersonId(person.id)}
                className={"w-full rounded-2xl border p-3 text-left " + (personId === person.id ? "border-blue bg-blue-soft" : "border-line bg-card")}
              >
                <span className="block font-semibold">{person.name}</span>
                <span className="block text-sm text-muted">
                  {person.kind === "driver" ? "Repartidor" : "Preventa"}
                  {person.routeName ? ` · ${person.routeName}` : ""}
                </span>
                <span className="mt-1 block text-sm text-muted">{fix ? `Ubicación ${formatFixTime(fix.at)}` : shared ? "Aceptó. Aún no hay lectura." : "No está compartiendo su ubicación."}</span>
                <span className="mt-1 block text-sm">{last ? last.title : "Sin movimientos"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {markers.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line">
          <StoreMap markers={markers} paths={paths} selectedId={selected?.id ?? null} onSelect={setSelectedId} className="h-72 w-full" />
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">El mapa muestra al equipo cuando hay una lectura, y el punto de cada movimiento que sí tuvo ubicación.</p>
      )}
      <h2 className="mt-6 text-lg font-extrabold text-section">Qué hicieron</h2>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por persona">
        <FilterChip active={personId === "todos"} label="Todos" onClick={() => setPersonId("todos")} />
        {crew.map((person) => (
          <FilterChip key={person.id} active={personId === person.id} label={person.name.split(" ")[0] ?? person.name} onClick={() => setPersonId(person.id)} />
        ))}
        <FilterChip active={personId === "dueno"} label="Dueño" onClick={() => setPersonId("dueno")} />
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.length === 0 ? <li className="text-sm text-muted">Todavía no hay movimientos de esta persona.</li> : null}
        {rows.map((entry) => (
          <li key={entry.id}>
            <JournalRow entry={entry} people={people} active={selectedId === entry.id} onSelect={() => setSelectedId(entry.id)} />
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={"h-10 shrink-0 rounded-full border px-3 text-sm font-semibold " + (active ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-card")}
    >
      {label}
    </button>
  );
}

function JournalRow({
  entry,
  people,
  active,
  onSelect,
}: {
  entry: JournalEntry;
  people: { id: string; name: string }[];
  active: boolean;
  onSelect: () => void;
}) {
  const tone = entry.kind === "incidencia" ? "danger" : entry.kind === "entrega" || entry.kind === "venta" ? "ok" : "blue";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={"w-full rounded-2xl border p-3 text-left " + (active ? "border-blue bg-blue-soft" : "border-line bg-card")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{formatFixTime(entry.at)}</span>
        <Chip tone={tone}>{KIND_LABEL[entry.kind]}</Chip>
      </span>
      <span className="mt-1 block font-semibold">{entry.title}</span>
      <span className="mt-1 block text-sm text-muted">
        {whoName(people, entry.personId)}
        {entry.place ? ` · ${entry.place}` : ""}
      </span>
      {entry.detail ? <span className="mt-1 block text-sm">{entry.detail}</span> : null}
      <span className="mt-1 block text-sm text-muted">
        {entry.lat != null && entry.lng != null ? `Ubicación ${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}` : "Sin ubicación en ese momento."}
      </span>
    </button>
  );
}

function whoName(people: { id: string; name: string }[], personId: string): string {
  if (personId === "dueno") return "Dueño";
  return people.find((person) => person.id === personId)?.name ?? "Equipo";
}
