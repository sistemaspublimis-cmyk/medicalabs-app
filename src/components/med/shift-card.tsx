import { clock } from "@/lib/ruta/format";
import { fieldPersonId, useMed, type WorkShift } from "@/lib/med/store";

function shiftLine(shift: WorkShift): string {
  const start = clock(shift.startedAt);
  if (shift.status === "working") return `En ruta desde ${start}`;
  if (shift.status === "paused") return `En pausa. Empezó ${start}`;
  return `Terminado ${shift.endedAt ? clock(shift.endedAt) : ""}. Empezó ${start}`;
}

export function ShiftCard() {
  const role = useMed((state) => state.role);
  const personId = fieldPersonId(role);
  const shifts = useMed((state) => state.shifts) ?? [];
  const startShift = useMed((state) => state.startShift);
  const pauseShift = useMed((state) => state.pauseShift);
  const resumeShift = useMed((state) => state.resumeShift);
  const endShift = useMed((state) => state.endShift);
  if (!personId) return null;
  const current = shifts.find((shift) => shift.personId === personId && shift.status !== "closed");
  const today = shifts.filter((shift) => shift.personId === personId).slice(0, 3);

  return (
    <section className="mb-4 rounded-2xl border border-line bg-card p-3">
      <p className="text-sm font-semibold text-muted">Periodo laboral</p>
      <p className="mt-1 font-extrabold text-blue-deep">{current ? shiftLine(current) : "Aún no inicia el periodo de hoy."}</p>
      {current?.pauses.length ? (
        <ul className="mt-2 text-sm text-muted">
          {current.pauses.map((pause) => (
            <li key={pause.from}>
              Pausa {clock(pause.from)}
              {pause.to ? ` a ${clock(pause.to)}` : " · sigue en pausa"}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {!current ? (
          <button type="button" onClick={startShift} className="h-12 rounded-xl bg-blue font-semibold text-card">
            Iniciar periodo laboral
          </button>
        ) : null}
        {current?.status === "working" ? (
          <button type="button" onClick={pauseShift} className="h-12 rounded-xl border border-line bg-paper font-semibold">
            Pausar periodo laboral
          </button>
        ) : null}
        {current?.status === "paused" ? (
          <button type="button" onClick={resumeShift} className="h-12 rounded-xl bg-blue font-semibold text-card">
            Reactivar periodo laboral
          </button>
        ) : null}
        {current ? (
          <button type="button" onClick={endShift} className="h-12 rounded-xl bg-danger font-semibold text-card">
            Terminar periodo laboral
          </button>
        ) : null}
      </div>
      {today.length > 1 ? (
        <ul className="mt-3 text-sm text-muted">
          {today.map((shift) => (
            <li key={shift.id}>{shiftLine(shift)}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ShiftButton() {
  const role = useMed((state) => state.role);
  const personId = fieldPersonId(role);
  const shifts = useMed((state) => state.shifts) ?? [];
  const startShift = useMed((state) => state.startShift);
  const pauseShift = useMed((state) => state.pauseShift);
  const resumeShift = useMed((state) => state.resumeShift);
  const endShift = useMed((state) => state.endShift);
  if (!personId) return null;
  const current = shifts.find((shift) => shift.personId === personId && shift.status !== "closed");
  const status = current?.status ?? "closed";
  const tone = status === "working" ? "bg-ok" : status === "paused" ? "bg-pause" : "bg-danger";
  const label = status === "working" ? "Pausar" : "Iniciar";
  const action = status === "working" ? pauseShift : status === "paused" ? resumeShift : startShift;
  const stateLabel = status === "working" ? "Periodo activo" : status === "paused" ? "Periodo en pausa" : "Periodo cerrado";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={action} aria-label={`${label}. ${stateLabel}`} className={`h-11 rounded-xl px-3 text-sm font-semibold text-card ${tone}`}>
        {label}
      </button>
      {current ? (
        <button type="button" onClick={endShift} aria-label="Terminar periodo laboral" className="h-11 rounded-xl bg-danger px-3 text-sm font-semibold text-card">
          Terminar
        </button>
      ) : null}
    </div>
  );
}
