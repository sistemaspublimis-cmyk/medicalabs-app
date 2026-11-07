import type { Product } from "@/lib/med/catalog";
import type { Order, Visit } from "@/lib/med/store";
import { isToday, orderTotals, todayKey } from "@/lib/ruta/format";

export type DaySpend = { day: string; amount: number; note: string };

export type RouteLow = {
  productId: string;
  name: string;
  unit: string;
  personId: string;
  personName: string;
  routeName: string;
  qty: number;
  minQty: number;
};

type Person = { id: string; name: string; routeName: string; kind: string };

export function lowOnRoute(
  catalog: Product[],
  loads: Record<string, Record<string, number>>,
  people: Person[],
): RouteLow[] {
  const rows: RouteLow[] = [];
  for (const person of people) {
    if (person.kind !== "presale") continue;
    const bag = loads[person.id];
    if (!bag) continue;
    for (const product of catalog) {
      if (!(product.id in bag)) continue;
      const qty = bag[product.id] ?? 0;
      const minQty = product.minQty ?? 8;
      if (minQty <= 0 || qty > minQty) continue;
      rows.push({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        personId: person.id,
        personName: person.name,
        routeName: person.routeName || "Sin ruta",
        qty,
        minQty,
      });
    }
  }
  rows.sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name, "es"));
  return rows;
}

export type DayFigures = {
  orders: number;
  gross: number;
  discount: number;
  net: number;
  cost: number;
  grossProfit: number;
  expense: number;
  result: number;
  collected: number;
  pendingAmount: number;
  pendingCount: number;
  deliveredCount: number;
  failedCount: number;
  failedAmount: number;
  pieces: number;
  ticket: number;
};

export function dayFigures(orders: Order[], catalog: Product[], expense: number, now = new Date()): DayFigures {
  const today = orders.filter((order) => isToday(order.createdAt, now));
  const counted = today.filter((order) => order.delivery !== "failed");
  const failed = today.filter((order) => order.delivery === "failed");
  const delivered = today.filter((order) => order.delivery === "delivered");
  const pending = today.filter((order) => order.delivery === "pending");
  let gross = 0;
  let discount = 0;
  let net = 0;
  let cost = 0;
  let pieces = 0;
  for (const order of counted) {
    const totals = orderTotals(order.lines, order.discountPct);
    gross += totals.sub;
    discount += totals.off;
    net += totals.total;
    for (const line of order.lines) {
      const product = catalog.find((item) => item.id === line.productId);
      cost += line.qty * (product?.cost ?? 0);
      pieces += line.qty;
    }
  }
  const collected = delivered.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const pendingAmount = pending.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const failedAmount = failed.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
  const spend = Math.max(0, Math.round(expense));
  return {
    orders: counted.length,
    gross,
    discount,
    net,
    cost,
    grossProfit: net - cost,
    expense: spend,
    result: net - cost - spend,
    collected,
    pendingAmount,
    pendingCount: pending.length,
    deliveredCount: delivered.length,
    failedCount: failed.length,
    failedAmount,
    pieces,
    ticket: counted.length === 0 ? 0 : Math.round(net / counted.length),
  };
}

export type SellerDay = {
  id: string;
  name: string;
  routeName: string;
  stops: number;
  visits: number;
  effective: number;
  missed: number;
  orders: number;
  sales: number;
  ticket: number;
};

export type DriverDay = {
  id: string;
  name: string;
  routeName: string;
  assigned: number;
  delivered: number;
  pending: number;
  failed: number;
  deliveredAmount: number;
};

export function sellerDays(
  orders: Order[],
  visits: Visit[],
  people: Person[],
  clients: { sellerId: string }[] = [],
  now = new Date(),
): SellerDay[] {
  return people
    .filter((person) => person.kind === "presale")
    .map((person) => {
      const mine = orders.filter(
        (order) => order.sellerId === person.id && isToday(order.createdAt, now) && order.delivery !== "failed",
      );
      const seen = visits.filter((visit) => visit.sellerId === person.id && isToday(visit.at, now));
      const effective = seen.filter((visit) => visit.note === "Pedido").length;
      const sales = mine.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0);
      return {
        id: person.id,
        name: person.name,
        routeName: person.routeName || "Sin ruta",
        stops: clients.filter((client) => client.sellerId === person.id).length,
        visits: seen.length,
        effective,
        missed: seen.length - effective,
        orders: mine.length,
        sales,
        ticket: mine.length === 0 ? 0 : Math.round(sales / mine.length),
      };
    });
}

export function driverDays(orders: Order[], people: Person[], now = new Date()): DriverDay[] {
  return people
    .filter((person) => person.kind === "driver")
    .map((person) => {
      const mine = orders.filter((order) => order.driverId === person.id && isToday(order.createdAt, now));
      const delivered = mine.filter((order) => order.delivery === "delivered");
      return {
        id: person.id,
        name: person.name,
        routeName: person.routeName || "Sin ruta",
        assigned: mine.length,
        delivered: delivered.length,
        pending: mine.filter((order) => order.delivery === "pending").length,
        failed: mine.filter((order) => order.delivery === "failed").length,
        deliveredAmount: delivered.reduce((sum, order) => sum + orderTotals(order.lines, order.discountPct).total, 0),
      };
    });
}

export type MovedProduct = { id: string; name: string; qty: number; amount: number };

export function movedToday(orders: Order[], catalog: Product[], now = new Date()): MovedProduct[] {
  const map = new Map<string, MovedProduct>();
  for (const order of orders) {
    if (!isToday(order.createdAt, now) || order.delivery === "failed") continue;
    for (const line of order.lines) {
      const product = catalog.find((item) => item.id === line.productId);
      const current = map.get(line.productId) ?? {
        id: line.productId,
        name: product?.name ?? line.productId,
        qty: 0,
        amount: 0,
      };
      current.qty += line.qty;
      current.amount += line.qty * line.price;
      map.set(line.productId, current);
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount || b.qty - a.qty);
}

export function spendForToday(spend: DaySpend | undefined, now = new Date()): number {
  if (!spend || spend.day !== todayKey(now)) return 0;
  return Math.max(0, Math.round(spend.amount));
}
