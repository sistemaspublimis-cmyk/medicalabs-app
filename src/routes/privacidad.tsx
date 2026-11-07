import { createFileRoute } from "@tanstack/react-router";
import { PublisherCredit } from "@/components/med/credit";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { pingLabel } from "@/lib/med/locate";
import { PLAY } from "@/lib/med/play";
import { useMed } from "@/lib/med/store";

export const Route = createFileRoute("/privacidad")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const every = pingLabel(useMed((state) => state.pingMinutes));
  return (
    <Shell>
      <PageTitle title="Privacidad" hint="Lo que esta app lee y dónde se queda." />
      <div className="mt-4 flex flex-col gap-3 text-sm text-ink">
        <section className="rounded-2xl border border-line bg-card p-3">
          <h2 className="font-semibold text-section">Responsable</h2>
          <p className="mt-1">
            {PLAY.developer}. Operación en {PLAY.city}. Esta copia es la app de reparto Medicalabs, paquete {PLAY.packageId}.
          </p>
          <p className="mt-2">Tel contacto 5650837323. Empresa Medicalabs distribuidora.</p>
        </section>
        <section className="rounded-2xl border border-line bg-card p-3">
          <h2 className="font-semibold text-section">Qué se guarda en el teléfono</h2>
          <p className="mt-1">Pedidos, visitas, carga del día, avisos de entrega, la bitácora de qué hizo cada persona y, si la preventa o el repartidor aceptan, la ubicación de esa persona. Si en ese momento hay una lectura, la bitácora guarda el lugar junto con la acción.</p>
          <p className="mt-2">Eso vive en este teléfono. La app no tiene servidor propio y no vende esos datos.</p>
        </section>
        <section className="rounded-2xl border border-line bg-card p-3">
          <h2 className="font-semibold text-section">Ubicación</h2>
          <p className="mt-1">
            La preventa y el repartidor pueden compartir la ubicación precisa. Se pide con un aviso dentro de la app, antes del permiso de Android. Si aceptan, se lee al entrar y {every} mientras la app está abierta y a la vista. No se lee con la app cerrada ni en segundo plano. El dueño cuenta como en línea una lectura de ese mismo lapso.
          </p>
          <p className="mt-2">La ve el dueño en el mapa, para saber dónde va cada uno. Cada quien ve su propio aviso y puede dejar de compartir. Quien no acepta no aparece.</p>
          <p className="mt-2">El mapa de la app usa teselas de OpenStreetMap. El botón Abrir en Google Maps abre ese servicio con la coordenada.</p>
        </section>
        <section className="rounded-2xl border border-line bg-card p-3">
          <h2 className="font-semibold text-section">Borrar los datos</h2>
          <p className="mt-1">
            En Configuración, “Borrar datos de este teléfono” deja la app como al empezar. También puedes borrar el almacenamiento de Medicalabs en Ajustes de Android. No hay cuenta en un servidor que borrar.
          </p>
        </section>
        <PublisherCredit />
        <section className="rounded-2xl border border-line bg-card p-3">
          <h2 className="font-semibold text-section">Para quién es</h2>
          <p className="mt-1">Es una herramienta de trabajo para el personal de la distribuidora. No es para menores de 18 años y no da consejo médico.</p>
        </section>
      </div>
    </Shell>
  );
}
