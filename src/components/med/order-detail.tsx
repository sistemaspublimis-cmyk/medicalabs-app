import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { clientById, type Product } from "@/lib/med/catalog";
import { shareTicketPdf, ticketPdf } from "@/lib/med/ticket-pdf";
import { moneyFine, orderStamp, orderTotals, receiptText } from "@/lib/ruta/format";
import { useMed, type Order } from "@/lib/med/store";

function deliveryLabel(order: Order): string {
  if (order.delivery === "delivered") return "Entregado";
  if (order.delivery === "failed") return order.deliveryNote ? `Incidencia: ${order.deliveryNote}` : "Incidencia";
  return "Por entregar";
}

function useTicket(orderId: string) {
  const order = useMed((state) => state.orders.find((item) => item.id === orderId));
  const catalog = useMed((state) => state.catalog);
  const people = useMed((state) => state.people);
  const clients = useMed((state) => state.clients);
  if (!order) return null;
  const client = clients.find((item) => item.id === order.clientId) ?? clientById(order.clientId);
  const seller = people.find((person) => person.id === order.sellerId);
  const driver = people.find((person) => person.id === order.driverId);
  const totals = orderTotals(order.lines, order.discountPct);
  const pieces = order.lines.reduce((sum, line) => sum + line.qty, 0);
  const delivery = deliveryLabel(order);
  const sync = order.synced ? "Enviado" : "En el teléfono";
  const text = receiptText({
    id: order.id,
    store: client?.store ?? "Cliente",
    seller: seller?.name ?? "Preventa",
    driver: driver?.name,
    address: client ? `${client.address} · ${client.zone}` : undefined,
    createdAt: order.createdAt,
    lines: order.lines,
    discountPct: order.discountPct,
    products: catalog,
    delivery,
    sync,
  });
  return { order, catalog, client, seller, driver, totals, pieces, delivery, sync, text };
}

export function OrderDetail({
  orderId,
  onClose,
  title = "Pedido",
  closeLabel = "Cerrar",
}: {
  orderId: string;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
}) {
  const ticket = useTicket(orderId);
  const role = useMed((state) => state.role);
  const undoDelivery = useMed((state) => state.undoDelivery);
  const [copied, setCopied] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [ticketView, setTicketView] = useState(false);
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const styleId = "ticket-print-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        "#ticket-print { display: none; }",
        "@media print {",
        "body > *:not(#ticket-print) { display: none !important; }",
        "#ticket-print { display: block !important; width: 72mm; margin: 0; color: #111; background: #fff; font-size: 12px; line-height: 1.35; }",
        "#ticket-print h1 { margin: 0 0 2px; font-size: 16px; }",
        "#ticket-print p, #ticket-print li { margin: 0; }",
        "#ticket-print ul { margin: 0; padding: 0; list-style: none; }",
        "#ticket-print hr { margin: 6px 0; border: 0; border-top: 1px dashed #111; }",
        "#ticket-print img { height: 42px; width: auto; }",
        "}",
      ].join("\n");
      document.head.appendChild(style);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!ticket || typeof document === "undefined") return null;
  const { order, catalog, client, seller, driver, totals, pieces, delivery, sync, text } = ticket;

  const printTicket = () => {
    document.body.style.overflow = "";
    const restore = () => {
      document.body.style.overflow = "hidden";
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    setPrinted(true);
  };

  const sendPdf = (mode: "whatsapp" | "archivo") => {
    const bytes = ticketPdf(text);
    const file = `Medicalabs-${order.id}.pdf`;
    void shareTicketPdf(file, bytes, text, mode, client?.phone ?? "").then(
      (result) =>
        setShareNote(
          mode === "archivo"
            ? result === "enviado"
              ? "Elige WhatsApp u otra app para compartir el PDF."
              : "Se descargó el PDF."
            : result === "enviado"
              ? "Listo para enviar el PDF por WhatsApp."
              : "Se descargó el PDF y se abrió el WhatsApp del cliente para adjuntarlo.",
        ),
      () => setShareNote("No se pudo abrir el envío. El PDF se puede imprimir desde aquí."),
    );
  };

  const copyTicket = () => {
    const mark = () => setCopied(true);
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (ok) mark();
    };
    if (!navigator.clipboard?.writeText) {
      fallback();
      return;
    }
    void navigator.clipboard.writeText(text).then(mark, fallback);
  };

  const sheet = (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-paper"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <h2 className="text-xl font-extrabold text-title">{title}</h2>
          <button type="button" onClick={onClose} className="h-11 px-2 font-semibold text-blue">
            {closeLabel}
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">
        <p className="text-sm font-semibold text-muted">Hora del pedido</p>
        <p className="text-2xl font-extrabold text-blue-deep">{orderStamp(order.createdAt)}</p>
        <p className="mt-1 text-sm text-muted">{order.id}</p>

        <div className="mt-4 rounded-2xl border border-line bg-card p-3">
          <p className="font-semibold">{client?.store ?? "Cliente"}</p>
          {client ? (
            <p className="mt-1 text-sm text-muted">
              {client.contact} · {client.address} · {client.zone}
            </p>
          ) : null}
          {client?.phone ? (
            <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="mt-1 inline-flex h-11 items-center font-semibold text-blue">
              {client.phone}
            </a>
          ) : null}
          <p className="mt-2 text-sm">
            Preventa {seller?.name ?? "sin nombre"}
            {seller?.routeName ? ` · ${seller.routeName}` : ""}
          </p>
          <p className="text-sm">
            Reparto {driver?.name ?? "sin nombre"}
            {driver?.routeName ? ` · ${driver.routeName}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            {delivery} · {sync}
          </p>
          <Link
            to="/cliente/$clientId"
            params={{ clientId: order.clientId }}
            className="mt-2 inline-flex h-11 items-center font-semibold text-blue"
          >
            Ver tienda
          </Link>
        </div>

        <h3 className="mt-4 text-sm font-semibold text-muted">
          {order.lines.length} {order.lines.length === 1 ? "partida" : "partidas"} · {pieces} {pieces === 1 ? "pieza" : "piezas"}
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {order.lines.map((line) => {
            const product = catalog.find((item) => item.id === line.productId);
            return (
              <li key={line.productId} className="rounded-2xl border border-line bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">
                    {line.qty} × {product?.name ?? "Producto"}
                  </p>
                  <p className="font-extrabold text-blue-deep tabular-nums">{moneyFine(line.qty * line.price)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {product?.unit ? `${product.unit} · ` : ""}
                  {moneyFine(line.price)} c/u
                </p>
              </li>
            );
          })}
        </ul>
        {order.discountPct > 0 ? (
          <p className="mt-3 text-sm text-muted">
            Descuento {order.discountPct}% · −{moneyFine(totals.off)}
          </p>
        ) : null}
        <p className="mt-2 text-3xl font-extrabold text-blue-deep tabular-nums">{moneyFine(totals.total)}</p>
        <p className="mt-1 text-sm text-muted">Nota de pedido. No es factura.</p>
        </div>
        <div className="border-t border-line bg-paper px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {ticketView ? (
            <pre className="mb-3 max-h-48 overflow-auto rounded-2xl border border-line bg-card p-3 text-xs whitespace-pre-wrap text-ink">{text}</pre>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setTicketView((value) => !value)} className="h-12 rounded-xl border border-line bg-card font-semibold">
              {ticketView ? "Ocultar ticket" : "Ver ticket"}
            </button>
            <button type="button" onClick={() => sendPdf("whatsapp")} className="h-12 rounded-xl bg-ok font-semibold text-card">
              WhatsApp al cliente
            </button>
            <button type="button" onClick={() => sendPdf("archivo")} className="h-12 rounded-xl border border-line bg-card font-semibold">
              Compartir PDF
            </button>
          </div>
          <button type="button" onClick={printTicket} className="mt-2 h-12 w-full rounded-xl border border-line bg-card font-semibold">
            {printed ? "Imprimir otro ticket" : "Imprimir"}
          </button>
          {role === "driver" && order.delivery === "delivered" ? (
            <button
              type="button"
              onClick={() => undoDelivery(order.id)}
              className="mt-2 h-12 w-full rounded-xl border border-line bg-card font-semibold"
            >
              Aún no entregado
            </button>
          ) : null}
          {shareNote ? <p className="mt-2 text-sm text-muted">{shareNote}</p> : null}
          <button type="button" onClick={copyTicket} className="mt-2 h-12 w-full rounded-xl border border-line bg-card font-semibold">
            {copied ? "Nota copiada" : "Copiar nota"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(sheet, document.body)}
      {createPortal(<TicketPrint ticket={ticket} products={catalog} />, document.body)}
    </>
  );
}

function TicketPrint({
  ticket,
  products,
}: {
  ticket: NonNullable<ReturnType<typeof useTicket>>;
  products: Product[];
}) {
  const { order, client, seller, driver, totals, delivery, sync } = ticket;
  return (
    <article id="ticket-print" aria-hidden="true">
      <img src="/logo.png" alt="" />
      <h1>Medicalabs</h1>
      <p>Distribución farmacéutica</p>
      <p>Nota de pedido. No es factura.</p>
      <hr />
      <p>{order.id}</p>
      <p>Hora del pedido</p>
      <p>{orderStamp(order.createdAt)}</p>
      <p>{client?.store ?? "Cliente"}</p>
      {client ? (
        <p>
          {client.contact} · {client.address} · {client.zone}
        </p>
      ) : null}
      {client?.phone ? <p>{client.phone}</p> : null}
      <p>Preventa {seller?.name ?? "sin nombre"}</p>
      <p>Reparto {driver?.name ?? "sin nombre"}</p>
      <p>
        {delivery} · {sync}
      </p>
      <hr />
      <ul>
        {order.lines.map((line) => {
          const product = products.find((item) => item.id === line.productId);
          return (
            <li key={line.productId}>
              {line.qty} × {product?.name ?? "Producto"} {moneyFine(line.qty * line.price)}
            </li>
          );
        })}
      </ul>
      {order.discountPct > 0 ? (
        <p>
          Descuento {order.discountPct}% −{moneyFine(totals.off)}
        </p>
      ) : null}
      <p>Total {moneyFine(totals.total)}</p>
    </article>
  );
}
