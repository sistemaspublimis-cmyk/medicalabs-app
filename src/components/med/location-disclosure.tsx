import { Link } from "@tanstack/react-router";
import { pingLabel } from "@/lib/med/locate";
import { useMed } from "@/lib/med/store";

export function LocationDisclosure({
  puesto,
  onAccept,
  onDecline,
}: {
  puesto: "preventa" | "reparto";
  onAccept: () => void;
  onDecline: () => void;
}) {
  const preventa = puesto === "preventa";
  const every = pingLabel(useMed((state) => state.pingMinutes));
  return (
    <section className="rounded-2xl border border-blue bg-card p-4" aria-labelledby="ubicacion-titulo">
      <h2 id="ubicacion-titulo" className="text-xl font-extrabold text-title">
        {preventa ? "Ubicación de esta preventa" : "Ubicación de esta unidad"}
      </h2>
      <p className="mt-2 text-sm text-ink">Medicalabs usa la ubicación precisa de este teléfono.</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-ink">
        <li>Para qué: el dueño ve en el mapa dónde estás.</li>
        <li>Cuándo: solo con la app abierta y a la vista, al entrar y {every}. No se lee con la app cerrada ni en segundo plano.</li>
        <li>Dónde queda: en este teléfono. No se manda a un servidor.</li>
        <li>
          {preventa
            ? "Si no aceptas, puedes seguir tomando pedidos. El dueño no verá el punto de esta preventa."
            : "Si no aceptas, puedes seguir entregando. El dueño no verá el punto de esta unidad."}
        </li>
      </ul>
      <p className="mt-3 text-sm text-muted">
        Puedes dejar de compartir en Configuración, o en Ajustes de Android, Aplicaciones, Medicalabs, Permisos, Ubicación.
      </p>
      <Link to="/privacidad" className="mt-3 inline-flex text-sm font-semibold text-blue-deep">
        Ver la privacidad
      </Link>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" onClick={onAccept} className="h-12 rounded-xl bg-blue font-semibold text-card">
          Aceptar y compartir
        </button>
        <button type="button" onClick={onDecline} className="h-12 rounded-xl border border-line bg-paper font-semibold">
          Ahora no
        </button>
      </div>
    </section>
  );
}
