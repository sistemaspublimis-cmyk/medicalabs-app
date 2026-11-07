import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/med/shell";
import { PageTitle, Stat } from "@/components/med/ui";
import { isToday, money, orderTotals } from "@/lib/ruta/format";
import { MANAGER_ID } from "@/lib/med/catalog";
import { operatingSellerId, useMed } from "@/lib/med/store";

export const Route = createFileRoute("/finanzas")({
  component: FinancePage,
});

function FinancePage() {
  const role = useMed((state) => state.role);
  const people = useMed((state) => state.people);
  const sellerId = useMed(operatingSellerId);
  const seller = people.find((person) => person.id === sellerId);
  const orders = useMed((state) => state.orders);
  const catalog = useMed((state) => state.catalog);
  const team = new Set(people.filter((person) => person.leadId === MANAGER_ID).map((person) => person.id));
  const today = orders.filter((order) => {
    if (!isToday(order.createdAt)) return false;
    if (role === "owner") return true;
    if (role === "manager") return team.has(order.sellerId) || team.has(order.driverId);
    return order.sellerId === sellerId;
  });
  const counted = today.filter((order) => order.delivery !== "failed");
  const failed = today.filter((order) => order.delivery === "failed");
  const sales = counted.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const discount = counted.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).off, 0);
  const byCategory = catalog.reduce<Record<string, number>>((acc, product) => {
    acc[product.category] = 0;
    return acc;
  }, {});
  for (const order of counted) {
    for (const line of order.lines) {
      const product = catalog.find((item) => item.id === line.productId);
      if (!product) continue;
      byCategory[product.category] = (byCategory[product.category] ?? 0) + line.qty * line.price;
    }
  }
  const gross = Object.values(byCategory).reduce((sum, amount) => sum + amount, 0);
  const max = Math.max(1, ...Object.values(byCategory));
  const ticket = counted.length === 0 ? 0 : Math.round(sales / counted.length);
  const rows = Object.entries(byCategory).filter(([, amount]) => amount > 0);

  return (
    <Shell>
      <PageTitle
        title="Finanzas"
        hint={role === "owner" ? "Venta de todas las preventas, sin incidencias." : role === "manager" ? "Venta del equipo que el dueño te asignó." : `Lo vendido hoy por ${seller?.name ?? "esta preventa"}.`}
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Venta" value={money(sales)} hint={`${counted.length} ${counted.length === 1 ? "pedido" : "pedidos"}`} />
        <Stat label="Ticket" value={money(ticket)} hint={discount > 0 ? `Descuento ${money(discount)}` : "Sin descuentos"} />
      </div>
      {failed.length > 0 ? (
        <p className="mt-3 text-sm text-muted">
          {failed.length} {failed.length === 1 ? "incidencia no entra" : "incidencias no entran"} en la venta: la pieza regresó a la unidad.
        </p>
      ) : null}
      <h2 className="mt-6 text-lg font-extrabold text-section">Por categoría</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">Todavía no hay venta por categoría.</p> : null}
      {gross > sales && rows.length > 0 ? <p className="mt-1 text-sm text-muted">Antes de descuento. El total de arriba ya lo resta.</p> : null}
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map(([category, amount]) => (
          <li key={category}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{category}</span>
              <span className="tabular-nums">{money(amount)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-line">
              <div className="h-full rounded-full bg-blue" style={{ width: `${Math.round((amount / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
