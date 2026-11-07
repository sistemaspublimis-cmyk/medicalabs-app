import type { WorkspaceRole } from "@/lib/med/catalog";
import { isToday } from "@/lib/ruta/format";

const NAMED: Record<string, string> = {
  ana: "#1a8ad4",
  luis: "#0e7a45",
  marta: "#c45c26",
  hugo: "#7a3e9d",
  gerente: "#0e7490",
};

const EXTRA = ["#be185d", "#a16207", "#1d4ed8", "#0f766e", "#9f1239", "#334155"];

/** Color fijo de cada persona en el mapa. Las de siempre no se repiten. */
export function personColor(id: string): string {
  if (NAMED[id]) return NAMED[id];
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return EXTRA[hash % EXTRA.length];
}

export type ClientMark = "falta" | "paso" | "pedido";

type VisitRow = { clientId: string; sellerId: string; at: string };
type OrderRow = { clientId: string; sellerId: string; driverId: string; createdAt: string; delivery: string };

/** Gris: falta pasar. Azul: ya pasó y no pidió. Verde: ya hubo pedido o entrega. */
export function clientMark(input: {
  clientId: string;
  role: WorkspaceRole;
  personId: string | null;
  visits: VisitRow[];
  orders: OrderRow[];
}): ClientMark {
  if (input.role === "driver") {
    const mine = input.orders.filter(
      (order) => order.clientId === input.clientId && order.driverId === input.personId && isToday(order.createdAt),
    );
    if (mine.some((order) => order.delivery === "delivered")) return "pedido";
    if (mine.some((order) => order.delivery === "pending")) return "paso";
    return "falta";
  }
  const seller = input.role === "presale" ? input.personId : null;
  const sold = input.orders.some(
    (order) =>
      order.clientId === input.clientId &&
      isToday(order.createdAt) &&
      order.delivery !== "failed" &&
      (!seller || order.sellerId === seller),
  );
  if (sold) return "pedido";
  const passed = input.visits.some(
    (visit) => visit.clientId === input.clientId && isToday(visit.at) && (!seller || visit.sellerId === seller),
  );
  if (passed) return "paso";
  return "falta";
}

export function markTone(mark: ClientMark): "pending" | "passed" | "done" {
  if (mark === "pedido") return "done";
  if (mark === "paso") return "passed";
  return "pending";
}

export function markLabel(mark: ClientMark, role: WorkspaceRole): string {
  if (role === "driver") {
    if (mark === "pedido") return "Entregado";
    if (mark === "paso") return "Pendiente";
    return "Sin entrega hoy";
  }
  if (mark === "pedido") return "Con pedido";
  if (mark === "paso") return "Pasó, sin pedido";
  return "Falta pasar";
}
