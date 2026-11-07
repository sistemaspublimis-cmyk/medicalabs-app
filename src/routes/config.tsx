import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SessionChip, Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { ScalePrefs, ViewPrefs } from "@/components/med/view-prefs";
import { accountByEmail } from "@/lib/med/accounts";
import { ROLE_META } from "@/lib/med/catalog";
import { useHydrated, useMed } from "@/lib/med/store";

export const Route = createFileRoute("/config")({
  component: ConfigPage,
});

function ConfigPage() {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const role = useMed((state) => state.role);
  const accountEmail = useMed((state) => state.accountEmail);
  const locationConsent = useMed((state) => state.locationConsent);
  const setLocationConsent = useMed((state) => state.setLocationConsent);
  const blankData = useMed((state) => state.blankData);
  const [armed, setArmed] = useState(false);
  const account = accountByEmail(accountEmail);
  const meta = ROLE_META[role];

  return (
    <Shell>
      <PageTitle title="Configuración" hint="El correo con el que entraste define lo que ves. No se cambia de puesto aquí." />
      <div className="mt-4 rounded-2xl border border-line bg-card px-4 py-3">
        <p className="font-semibold text-blue-deep">{account?.name ?? meta.label}</p>
        <p className="text-sm text-muted">{meta.label}</p>
        {account ? <p className="mt-1 text-sm text-ink">{account.email}</p> : null}
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-card p-3">
        <ViewPrefs />
        <div className="mt-3">
          <ScalePrefs />
        </div>
      </div>
      {role !== "owner" && locationConsent === "granted" ? (
        <button
          type="button"
          className="mt-4 h-12 w-full rounded-xl border border-line bg-card font-semibold"
          onClick={() => setLocationConsent("denied")}
        >
          Dejar de compartir ubicación
        </button>
      ) : null}
      <button
        type="button"
        className="mt-4 h-12 w-full rounded-xl border border-line bg-card font-semibold"
        onClick={() => {
          if (!hydrated) return;
          if (!armed) {
            setArmed(true);
            return;
          }
          blankData();
          setArmed(false);
          void navigate({ to: "/" });
        }}
      >
        {armed ? "Confirmar vaciado" : "Vaciar datos de este teléfono"}
      </button>
      <p className="mt-2 text-sm text-muted">
        Deja la app en cero: sin tiendas, pedidos, visitas, carga, zonas ni avisos. El catálogo, el personal y las funciones se quedan. Para salir, toca el punto de arriba. También está en{" "}
        <Link to="/privacidad" className="font-semibold text-blue-deep">
          Privacidad
        </Link>
        .
      </p>
      <div className="mt-4">
        <SessionChip />
      </div>
    </Shell>
  );
}
