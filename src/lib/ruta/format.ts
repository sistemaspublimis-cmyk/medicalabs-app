import { clientById, productById, type Product } from "@/lib/med/catalog";

export type Line = { productId: string; qty: number; price: number };

export type Totals = { sub: number; off: number; total: number };

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isToday(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return todayKey(date) === todayKey(now);
}

export function money(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function priceLabel(value: number): string {
  return value > 0 ? money(value) : "Precio por confirmar";
}

export function moneyFine(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const cents = Math.abs(rounded - Math.round(rounded)) >= 0.005;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function nowLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function orderStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function orderTotals(lines: Line[], discountPct: number): Totals {
  const sub = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const off = Math.round((sub * discountPct) / 100);
  return { sub, off, total: sub - off };
}

export function receiptText(input: {
  id: string;
  store: string;
  seller: string;
  driver?: string;
  address?: string;
  createdAt: string;
  lines: Line[];
  discountPct: number;
  products: Product[];
  delivery?: string;
  sync?: string;
}): string {
  const totals = orderTotals(input.lines, input.discountPct);
  const rows = input.lines
    .map((line) => {
      const product = input.products.find((item) => item.id === line.productId);
      const name = product?.name ?? line.productId;
      return `${line.qty} × ${name}  ${moneyFine(line.qty * line.price)}`;
    })
    .join("\n");
  return [
    "Medicalabs",
    "Distribución farmacéutica",
    "Nota de pedido. No es factura.",
    "",
    input.id,
    `Hora del pedido  ${orderStamp(input.createdAt)}`,
    input.store,
    input.address ?? "",
    `Preventa  ${input.seller}`,
    input.driver ? `Reparto  ${input.driver}` : "",
    input.delivery ? `Entrega  ${input.delivery}` : "",
    input.sync ?? "",
    "",
    rows,
    input.discountPct > 0 ? `Descuento ${input.discountPct}%  −${moneyFine(totals.off)}` : "",
    `Total  ${moneyFine(totals.total)}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function lineSummary(lines: Line[], products: Product[]): string {
  if (lines.length === 0) return "Sin partidas";
  return lines
    .map((item) => {
      const name = products.find((product) => product.id === item.productId)?.name ?? "Producto";
      return `${item.qty} ${name}`;
    })
    .join(" · ");
}

export function productName(id: string): string {
  return productById(id)?.name ?? id;
}

export function storeName(id: string, clients?: { id: string; store: string }[]): string {
  return clients?.find((client) => client.id === id)?.store ?? clientById(id)?.store ?? "Cliente";
}
