import { clientById, clientMapPoint, type ClientStop } from "@/lib/med/catalog";
import type { Order } from "@/lib/med/store";
import { isToday } from "@/lib/ruta/format";

export type DayStop = {
  client: ClientStop;
  pending: number;
  point: ReturnType<typeof clientMapPoint>;
};

export function driverDayStops(orders: Order[], clients: ClientStop[], driverId: string): DayStop[] {
  const byClient = new Map<string, DayStop>();
  for (const order of orders) {
    if (order.driverId !== driverId || !isToday(order.createdAt)) continue;
    const client = clients.find((item) => item.id === order.clientId) ?? clientById(order.clientId);
    if (!client) continue;
    const current = byClient.get(client.id) ?? { client, pending: 0, point: clientMapPoint(client) };
    if (order.delivery === "pending") current.pending += 1;
    byClient.set(client.id, current);
  }
  return [...byClient.values()].sort((a, b) => a.client.store.localeCompare(b.client.store, "es"));
}
