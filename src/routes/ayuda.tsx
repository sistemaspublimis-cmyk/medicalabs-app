import { createFileRoute } from "@tanstack/react-router";
import { PublisherCredit } from "@/components/med/credit";
import { Shell } from "@/components/med/shell";
import { PageTitle } from "@/components/med/ui";
import { useMed } from "@/lib/med/store";

export const Route = createFileRoute("/ayuda")({
  component: HelpPage,
});

const STEPS = [
  { title: "Cuenta", body: "El correo y la contraseña abren el inicio de ese puesto. En el menú no se cambia entre dueño, preventa y repartidor." },
  {
    title: "Dueño",
    body: "El mapa deja la última ubicación guardada de cada persona, cada una con su color. En el tablero, toca un nombre para ver su historial. Puede registrar y rellenar productos, y eso se ve al momento en este teléfono. Puede quitar cualquier aviso, incluso los fijos. El gerente ve lo mismo de la gente que el dueño le asigna, pero no modifica ni da permisos.",
  },
  { title: "Preventa", body: "Al entrar puede iniciar, pausar, reactivar o terminar su periodo laboral. Al vender ve las tiendas más cercanas. Revisa el pedido y puede modificarlo antes de cerrar la venta." },
  {
    title: "Repartidor",
    body: "En cada entrega primero está Cómo llegar. Al abrir el pedido salen Entregado, Más tarde, No se encuentra y Equivocado. Más tarde baja el pedido al final de la fila. En el mapa, pendiente es azul y entregado es verde.",
  },
  {
    title: "Mapa",
    body: "Gris: falta pasar. Azul: ya pasó y no pidió. Verde: ya hubo pedido. En reparto, azul es pendiente y verde es entregado. El dueño ve a todo el equipo. Cada quien ve solo su punto. El mapa tiene Centrar. Al hacer un pedido se guarda la ubicación de quien lo tomó, si ya había una lectura.",
  },
  {
    title: "Avisos",
    body: "La campana abre los avisos. El dueño se entera de sesiones, pausas, pedidos y productos por terminarse. Puede publicar un aviso fijo: el equipo no lo quita, el dueño sí.",
  },
];

function HelpPage() {
  const role = useMed((state) => state.role);
  const steps = STEPS.filter((step) => {
    if (step.title === "Avisos" && role !== "owner") return false;
    return true;
  });
  return (
    <Shell>
      <PageTitle title="Ayuda" hint="Medicalabs es la operación del día. La nota de pedido no es factura." />
      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.title} className="rounded-2xl border border-line bg-card p-3">
            <p className="font-semibold text-blue-deep">{step.title}</p>
            <p className="mt-1 text-sm text-muted">{step.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <PublisherCredit />
      </div>
    </Shell>
  );
}
