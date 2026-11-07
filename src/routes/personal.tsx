import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/med/shell";
import { Chip, PageTitle } from "@/components/med/ui";
import { ACCESS, ACCESS_PRESETS, MANAGER_ID, ROLE_META, type AccessId, type WorkspaceRole } from "@/lib/med/catalog";
import { useMed, zoneSightOf, type ZoneSight } from "@/lib/med/store";

export const Route = createFileRoute("/personal")({
  component: PersonalPage,
});

const KINDS: WorkspaceRole[] = ["presale", "driver", "warehouse", "manager", "owner"];

function PersonalPage() {
  const people = useMed((state) => state.people);
  const savePerson = useMed((state) => state.savePerson);
  const removePerson = useMed((state) => state.removePerson);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [routeName, setRouteName] = useState("");
  const [kind, setKind] = useState<WorkspaceRole>("presale");
  const [access, setAccess] = useState<AccessId[]>([...ACCESS_PRESETS.presale]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const options = ACCESS.filter((item) => item.roles.includes(kind));

  function chooseKind(next: WorkspaceRole) {
    setKind(next);
    setAccess([...ACCESS_PRESETS[next]]);
  }

  function toggle(id: AccessId) {
    setAccess((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setPhone("");
    setRouteName("");
    setKind("presale");
    setAccess([...ACCESS_PRESETS.presale]);
    setEmail("");
    setPassword("");
    setError(null);
    setOpen(false);
  }

  return (
    <Shell>
      <PageTitle title="Personal" hint="El dueño registra al equipo, da permisos y asigna gente al gerente. Preventa y repartidor pueden recibir los permisos del otro." />
      {open ? null : (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card">
          Agregar persona
        </button>
      )}
      {open ? (
      <form
        className="mt-4 rounded-2xl border border-line bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setError("Escribe el nombre.");
            return;
          }
          if (access.length === 0) {
            setError("Elige al menos un acceso.");
            return;
          }
          if (!editing && (!email.includes("@") || password.length < 4)) {
            setError("Para una cuenta nueva escribe correo y una contraseña de 4 caracteres.");
            return;
          }
          savePerson({ id: editing ?? undefined, name, phone, routeName, kind, access, email, password });
          resetForm();
        }}
      >
        <h2 className="text-lg font-extrabold text-section">{editing ? "Editar acceso" : "Nueva persona"}</h2>
        <label className="mt-3 block text-sm font-semibold">
          Nombre
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre y apellido"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Teléfono
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
            placeholder="55 0000 0000"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Ruta o zona
          <input
            value={routeName}
            onChange={(event) => setRouteName(event.target.value)}
            placeholder="Prev Coacalco"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Correo para entrar
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            inputMode="email"
            autoComplete="off"
            placeholder="nombre@correo.com"
            className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Contraseña
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder={editing ? "Vacío conserva la actual" : "Mínimo 4"}
            className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
          />
        </label>
        <p className="mt-4 text-sm font-semibold">Puesto</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {KINDS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => chooseKind(item)}
              className={
                "h-11 rounded-xl text-sm font-semibold " +
                (kind === item ? "bg-blue text-card" : "border border-line bg-paper")
              }
            >
              {ROLE_META[item].label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold">A qué tiene acceso</p>
        <div className="mt-2 flex flex-col gap-2">
          {options.map((item) => {
            const on = access.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(item.id)}
                className={
                  "flex h-12 items-center justify-between rounded-xl border px-3 text-left font-semibold " +
                  (on ? "border-blue bg-blue-soft text-blue-deep" : "border-line bg-paper")
                }
              >
                <span>{item.label}</span>
                <span className="text-sm">{on ? "Sí" : "No"}</span>
              </button>
            );
          })}
        </div>
        {kind === "presale" || kind === "driver" ? (
          <MirrorAccess kind={kind} access={access} onChange={setAccess} />
        ) : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <button type="submit" className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card">
          {editing ? "Guardar cambios" : "Registrar persona"}
        </button>
        <button type="button" onClick={resetForm} className="mt-2 h-12 w-full rounded-xl border border-line font-semibold">
          Cancelar
        </button>
      </form>
      ) : null}

      <h2 className="mt-8 text-lg font-extrabold text-section">Quién ya está dado de alta</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {people.map((person) => (
          <li key={person.id} className="rounded-2xl border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{person.name}</p>
                {person.email ? <p className="text-sm text-muted">{person.email}</p> : null}
                <p className="text-sm text-muted">
                  {ROLE_META[person.kind].label}
                  {person.routeName ? ` · ${person.routeName}` : ""}
                  {person.phone ? ` · ${person.phone}` : ""}
                </p>
              </div>
              <Chip tone="blue">{person.access.length} accesos</Chip>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {person.access.map((id) => (
                <Chip key={id} tone="muted">
                  {ACCESS.find((item) => item.id === id)?.label ?? id}
                </Chip>
              ))}
            </div>
            {person.kind === "manager" ? <TeamPick managerId={person.id} /> : null}
            {person.kind === "presale" ? <ZonePick personId={person.id} /> : null}
            {person.kind === "presale" || person.kind === "driver" ? <IdlePick personId={person.id} /> : null}
            <button
              type="button"
              onClick={() => {
                setEditing(person.id);
                setName(person.name);
                setPhone(person.phone);
                setRouteName(person.routeName);
                setKind(person.kind);
                setAccess([...person.access]);
                setEmail(person.email ?? "");
                setPassword("");
                setError(null);
                setOpen(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="mt-3 h-11 w-full rounded-xl border border-line font-semibold"
            >
              Editar
            </button>
            {person.seeded ? null : (
              <button
                type="button"
                onClick={() => {
                  if (armed !== person.id) {
                    setArmed(person.id);
                    return;
                  }
                  removePerson(person.id);
                  if (editing === person.id) resetForm();
                  setArmed(null);
                }}
                className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-danger"
              >
                {armed === person.id ? "Confirmar baja" : "Dar de baja"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function MirrorAccess({
  kind,
  access,
  onChange,
}: {
  kind: "presale" | "driver";
  access: AccessId[];
  onChange: (next: AccessId[]) => void;
}) {
  const other = kind === "driver" ? "presale" : "driver";
  const extra = ACCESS_PRESETS[other];
  const on = extra.every((id) => access.includes(id));
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        if (on) {
          const drop = new Set(extra.filter((id) => !ACCESS_PRESETS[kind].includes(id)));
          onChange(access.filter((id) => !drop.has(id)));
          return;
        }
        onChange([...new Set([...access, ...extra])]);
      }}
      className={"mt-4 h-12 w-full rounded-xl px-3 text-left text-sm font-semibold " + (on ? "bg-section text-card" : "border border-line bg-paper")}
    >
      {kind === "driver" ? "También los permisos de preventa" : "También los permisos de repartidor"}
    </button>
  );
}

function TeamPick({ managerId }: { managerId: string }) {
  const people = useMed((state) => state.people);
  const setLead = useMed((state) => state.setLead);
  const crew = people.filter((person) => person.kind === "presale" || person.kind === "driver");
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-kicker">Gente de este gerente</p>
      <div className="mt-2 flex flex-col gap-2">
        {crew.map((person) => {
          const on = person.leadId === managerId;
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={on}
              onClick={() => setLead(person.id, on ? null : managerId)}
              className={"flex h-11 items-center justify-between rounded-xl px-3 text-left text-sm font-semibold " + (on ? "bg-blue text-card" : "border border-line bg-paper")}
            >
              <span>
                {person.name}
                {person.routeName ? ` · ${person.routeName}` : ""}
              </span>
              <span>{on ? "Sí" : "No"}</span>
            </button>
          );
        })}
      </div>
      {managerId === MANAGER_ID ? null : <p className="mt-2 text-sm text-hint">La cuenta gerente@gmail.com ve a quien tenga como gerente a Gerente.</p>}
    </div>
  );
}

function ZonePick({ personId }: { personId: string }) {
  const sight = useMed((state) => zoneSightOf(state.zoneSight, personId));
  const setZoneSight = useMed((state) => state.setZoneSight);
  const options: { id: ZoneSight; label: string }[] = [
    { id: "tiendas", label: "Ve las tiendas de su zona" },
    { id: "oculta", label: "No ve las tiendas de la zona" },
    { id: "zona", label: "Ve la zona que le toca" },
  ];
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold">Qué ve el prevendedor</p>
      <div className="mt-2 flex flex-col gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={sight === option.id}
            onClick={() => setZoneSight(personId, option.id)}
            className={
              "h-11 rounded-xl px-3 text-left text-sm font-semibold " +
              (sight === option.id ? "bg-blue text-card" : "border border-line bg-paper")
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function IdlePick({ personId }: { personId: string }) {
  const stored = useMed((state) => state.idleByPerson?.[personId]);
  const setPersonIdle = useMed((state) => state.setPersonIdle);
  const [text, setText] = useState(stored == null ? "30" : String(stored));
  return (
    <label className="mt-3 block text-sm font-semibold">
      Avisar si no hay movimiento (minutos)
      <input
        value={text}
        inputMode="numeric"
        onChange={(event) => setText(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
        onBlur={() => setPersonIdle(personId, Number(text || "0"))}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
      />
      <span className="mt-1 block font-medium text-muted">Si no lo cambias, avisa a los 30 minutos. 0 no avisa.</span>
    </label>
  );
}
