import type { Product } from "@/lib/med/catalog";
import { driverDays, movedToday, sellerDays, type DriverDay, type SellerDay } from "@/lib/med/cierre";
import type { Order, Visit } from "@/lib/med/store";
import { dateFromKey } from "@/lib/med/weeks";
import { money } from "@/lib/ruta/format";

type Person = { id: string; name: string; routeName: string; kind: string };
type Stop = { sellerId: string };

export type SellerCompare = SellerDay & { otherSales: number; otherOrders: number; otherVisits: number };
export type DriverCompare = DriverDay & { otherDelivered: number; otherPending: number; otherFailed: number; otherAmount: number };
export type ProductCompare = { id: string; name: string; qty: number; amount: number; otherQty: number; otherAmount: number };

export function sellerCompare(
  orders: Order[],
  visits: Visit[],
  people: Person[],
  clients: Stop[],
  day: string,
  other: string,
): SellerCompare[] {
  const left = sellerDays(orders, visits, people, clients, dateFromKey(day));
  const right = sellerDays(orders, visits, people, clients, dateFromKey(other));
  return left.map((row) => {
    const pair = right.find((item) => item.id === row.id);
    return {
      ...row,
      otherSales: pair?.sales ?? 0,
      otherOrders: pair?.orders ?? 0,
      otherVisits: pair?.visits ?? 0,
    };
  });
}

export function driverCompare(orders: Order[], people: Person[], day: string, other: string): DriverCompare[] {
  const left = driverDays(orders, people, dateFromKey(day));
  const right = driverDays(orders, people, dateFromKey(other));
  return left.map((row) => {
    const pair = right.find((item) => item.id === row.id);
    return {
      ...row,
      otherDelivered: pair?.delivered ?? 0,
      otherPending: pair?.pending ?? 0,
      otherFailed: pair?.failed ?? 0,
      otherAmount: pair?.deliveredAmount ?? 0,
    };
  });
}

export function productCompare(orders: Order[], catalog: Product[], day: string, other: string): ProductCompare[] {
  const left = movedToday(orders, catalog, dateFromKey(day));
  const right = movedToday(orders, catalog, dateFromKey(other));
  const ids = [...new Set([...left.map((item) => item.id), ...right.map((item) => item.id)])];
  return ids
    .map((id) => {
      const a = left.find((item) => item.id === id);
      const b = right.find((item) => item.id === id);
      return {
        id,
        name: a?.name ?? b?.name ?? id,
        qty: a?.qty ?? 0,
        amount: a?.amount ?? 0,
        otherQty: b?.qty ?? 0,
        otherAmount: b?.amount ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount || b.qty - a.qty || a.name.localeCompare(b.name, "es"));
}

export function driverStatus(row: { assigned: number; delivered: number; pending: number; failed: number }): string {
  if (row.assigned === 0) return "No hizo entregas";
  if (row.pending > 0) return `Le faltan ${row.pending} por entregar`;
  if (row.delivered === 0) return "No entregó";
  return "Al día";
}

export function changeText(current: number, previous: number, asMoney = false): string {
  const diff = current - previous;
  if (diff === 0) return "Igual";
  const body = asMoney ? money(Math.abs(diff)) : String(Math.abs(diff));
  return diff > 0 ? `+${body}` : `−${body}`;
}
