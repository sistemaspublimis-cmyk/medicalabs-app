import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrderDetail } from "@/components/med/order-detail";
import { Shell } from "@/components/med/shell";
import { Chip, PageTitle } from "@/components/med/ui";
import { clock, isToday, lineSummary, money, orderTotals, storeName } from "@/lib/ruta/format";
import { operatingDriverId, operatingSellerId, useMed } from "@/lib/med/store";

export const Route = createFileRoute("/transacciones")({
  component: TxPage,
});

function TxPage() {
  const role = useMed((state) => state.role);
  const orders = useMed((state) => state.orders);
  const catalog = useMed((state) => state.catalog);
  const syncMine = useMed((state) => state.syncMine);
  const sellerId = useMed(operatingSellerId);
  const driverId = useMed(operatingDriverId);
  const clients = useMed((state) => state.clients);
  const [note, setNote] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const mine = orders.filter((order) => {
    if (!isToday(order.createdAt)) return false;
    if (role === "owner") return true;
    if (role === "driver") return order.driverId === driverId;
    return order.sellerId === sellerId;
  });
  const pending = mine.filter((order) => order.sellerId === sellerId && !order.synced).length;

  return (
    <Shell>
      <PageTitle
        title="Transacciones"
        hint={role === "driver" ? "Tickets que traes en esta unidad." : "Marca los que ya cerraste. En este teléfono pasan de pendientes a enviados."}
      />
      {role === "presale" ? (
        <button
          type="button"
          disabled={pending === 0}
          onClick={() => {
            if (!navigator.onLine) {
              setNote("Sin red. El pedido sigue en el teléfono.");
              return;
            }
            const count = syncMine();
            setNote(count === 0 ? "No había pedidos pendientes." : `${count} pedido${count === 1 ? "" : "s"} marcado${count === 1 ? "" : "s"} como enviado${count === 1 ? "" : "s"}.`);
          }}
          className="mt-4 h-12 w-full rounded-xl bg-blue font-semibold text-card disabled:opacity-40"
        >
          {pending === 0 ? "Nada pendiente" : `Marcar ${pending} como enviado${pending === 1 ? "" : "s"}`}
        </button>
      ) : null}
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
      {mine.length === 0 ? <p className="mt-4 text-sm text-muted">Todavía no hay tickets de hoy.</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {mine.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => setOpenId(order.id)}
              className="w-full rounded-2xl border border-line bg-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{storeName(order.clientId, clients)}</p>
                <Chip tone={order.synced ? "ok" : "blue"}>{order.synced ? "Enviado" : "En el teléfono"}</Chip>
              </div>
              <p className="mt-1 text-sm text-muted">
                {clock(order.createdAt)} · {order.id}
              </p>
              <p className="mt-1 text-sm">{lineSummary(order.lines, catalog)}</p>
              <p className="mt-1 font-extrabold text-blue-deep tabular-nums">{money(orderTotals(order.lines, order.discountPct).total)}</p>
              <p className="mt-1 text-sm font-semibold text-blue">Ver ticket</p>
            </button>
          </li>
        ))}
      </ul>
      {openId ? <OrderDetail orderId={openId} onClose={() => setOpenId(null)} /> : null}
    </Shell>
  );
}
