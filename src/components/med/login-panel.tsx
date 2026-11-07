import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { COMPANY } from "@/lib/med/catalog";
import { fieldPersonId, useMed, type WorkShift } from "@/lib/med/store";
import { clock } from "@/lib/ruta/format";

export function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <img src="/logo.png?v=2" alt={COMPANY} className="w-full max-w-sm" />
    </div>
  );
}

export function LoginPanel() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-4">
        <LoginForm />
      </div>
    </main>
  );
}

export function LoginDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 px-4" role="presentation" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-4 shadow-2xl"
        role="dialog"
        aria-label="Inicio de sesión"
        onClick={(event) => event.stopPropagation()}
      >
        <LoginForm onDone={onClose} />
        <button type="button" onClick={onClose} className="mt-2 h-11 w-full rounded-xl border border-line font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function LoginForm({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const signInLocal = useMed((state) => state.signInLocal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const ok = signInLocal(email, password);
        if (!ok) {
          setError("Ese correo o la contraseña no coinciden.");
          return;
        }
        setError("");
        onDone?.();
        void navigate({ to: "/" });
      }}
    >
      <img src="/logo.png?v=2" alt={COMPANY} className="w-full" />
      <p className="mt-3 text-sm text-muted">Entra con tu correo. El dueño crea las cuentas de almacén y del equipo.</p>
      <label className="mt-4 block text-sm font-semibold" htmlFor="med-email">
        Correo
        <input
          id="med-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          inputMode="email"
          className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
        />
      </label>
      <label className="mt-3 block text-sm font-semibold" htmlFor="med-password">
        Contraseña
        <input
          id="med-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3 text-base font-medium"
        />
      </label>
      {error ? (
        <p className="mt-3 text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="mt-4 h-12 w-full rounded-xl bg-teal text-base font-semibold text-drawer">
        Entrar
      </button>
    </form>
  );
}

export function SessionButton() {
  const email = useMed((state) => state.accountEmail);
  const role = useMed((state) => state.role);
  const shifts = useMed((state) => state.shifts) ?? [];
  const personId = email ? fieldPersonId(role) : null;
  const current = personId ? shifts.find((shift) => shift.personId === personId && shift.status !== "closed") : undefined;
  const [open, setOpen] = useState(false);
  const tone = !email ? "bg-danger" : current?.status === "paused" ? "bg-pause" : personId && !current ? "bg-danger" : "bg-ok";
  const label = !email ? "Desconectado. Entrar" : current?.status === "paused" ? "Pausado" : personId && !current ? "Desconectado de la ruta" : "Activo";

  return (
    <>
      <button type="button" aria-label={label} onClick={() => setOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-xl">
        <span className={"size-3.5 rounded-full ring-2 ring-card " + tone} />
      </button>
      {open && !email ? <LoginDialog onClose={() => setOpen(false)} /> : null}
      {open && email ? <LogoutDialog shift={current} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function LogoutDialog({ shift, onClose }: { shift: WorkShift | undefined; onClose: () => void }) {
  const navigate = useNavigate();
  const signOutLocal = useMed((state) => state.signOutLocal);
  const startShift = useMed((state) => state.startShift);
  const pauseShift = useMed((state) => state.pauseShift);
  const resumeShift = useMed((state) => state.resumeShift);
  const endShift = useMed((state) => state.endShift);
  const role = useMed((state) => state.role);
  const field = fieldPersonId(role);
  const status = shift?.status;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/50 px-3 pb-4 sm:place-items-center" role="presentation" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-card p-4 shadow-2xl" role="dialog" aria-label="Sesión" onClick={(event) => event.stopPropagation()}>
        <p className="text-lg font-extrabold text-title">{status === "working" ? "Activo" : status === "paused" ? "En pausa" : "Sesión"}</p>
        <p className="mt-1 text-sm text-muted">
          {shift ? (status === "paused" ? `Pausa desde ${clock(shift.pauses.at(-1)?.from ?? shift.startedAt)}` : `En ruta desde ${clock(shift.startedAt)}`) : "El punto verde es activo, el amarillo es pausa y el rojo es desconectado."}
        </p>
        {field ? (
          <div className="mt-3 flex flex-col gap-2">
            {!shift ? (
              <button type="button" onClick={startShift} className="h-12 rounded-xl bg-ok font-semibold text-card">
                Iniciar
              </button>
            ) : null}
            {status === "working" ? (
              <button type="button" onClick={pauseShift} className="h-12 rounded-xl bg-pause font-semibold text-drawer">
                Pausar
              </button>
            ) : null}
            {status === "paused" ? (
              <button type="button" onClick={resumeShift} className="h-12 rounded-xl bg-ok font-semibold text-card">
                Reactivar
              </button>
            ) : null}
            {shift ? (
              <button type="button" onClick={endShift} className="h-12 rounded-xl border border-line font-semibold">
                Terminar periodo
              </button>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            signOutLocal();
            onClose();
            void navigate({ to: "/" });
          }}
          className="mt-3 h-12 w-full rounded-xl bg-danger font-semibold text-card"
        >
          Cerrar sesión
        </button>
        <button type="button" onClick={onClose} className="mt-2 h-11 w-full rounded-xl border border-line font-semibold">
          Seguir
        </button>
      </div>
    </div>
  );
}
