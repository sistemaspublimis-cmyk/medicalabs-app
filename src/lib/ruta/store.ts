import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ACTIVE_SELLER_ID,
  CLIENTS,
  morningLoad,
  PRODUCTS,
  SELLERS,
} from "@/lib/ruta/catalog";
import { isToday, type Line } from "@/lib/ruta/format";

export type Visit = {
  id: string;
  clientId: string;
  sellerId: string;
  at: string;
  note: string;
};

export type Order = {
  id: string;
  clientId: string;
  sellerId: string;
  createdAt: string;
  lines: Line[];
  discountPct: number;
  synced: boolean;
};

type Role = "seller" | "supervisor";

type Slice = {
  role: Role;
  visits: Visit[];
  orders: Order[];
  loads: Record<string, Record<string, number>>;
};

type Actions = {
  setRole: (role: Role) => void;
  checkIn: (clientId: string, note: string) => void;
  placeOrder: (input: { clientId: string; lines: Line[]; discountPct: number }) =>
    | { ok: true; order: Order }
    | { ok: false; error: string };
  setRemaining: (productId: string, qty: number) => void;
  syncMine: () => number;
  reset: () => void;
};

function atHour(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function line(productId: string, qty: number): Line {
  const product = PRODUCTS.find((item) => item.id === productId);
  return { productId, qty, price: product?.price ?? 0 };
}

function seed(): Slice {
  const loads: Record<string, Record<string, number>> = {};
  for (const seller of SELLERS) loads[seller.id] = morningLoad();

  const visits: Visit[] = [
    { id: "v-l1", clientId: "luis-1", sellerId: "luis", at: atHour(9, 5), note: "Pedido" },
    { id: "v-l2", clientId: "luis-2", sellerId: "luis", at: atHour(10, 32), note: "Pedido" },
    { id: "v-l3", clientId: "luis-3", sellerId: "luis", at: atHour(11, 15), note: "Cerrado" },
    { id: "v-m1", clientId: "marta-1", sellerId: "marta", at: atHour(8, 48), note: "Pedido" },
    { id: "v-m2", clientId: "marta-2", sellerId: "marta", at: atHour(9, 40), note: "Inventario lleno" },
    { id: "v-m3", clientId: "marta-3", sellerId: "marta", at: atHour(11, 5), note: "Pedido" },
    { id: "v-m4", clientId: "marta-4", sellerId: "marta", at: atHour(12, 10), note: "Sin dinero" },
  ];

  const orders: Order[] = [
    {
      id: "RC-L0910",
      clientId: "luis-1",
      sellerId: "luis",
      createdAt: atHour(9, 10),
      lines: [line("agua", 8), line("coca", 6), line("arroz", 10)],
      discountPct: 0,
      synced: true,
    },
    {
      id: "RC-L1040",
      clientId: "luis-2",
      sellerId: "luis",
      createdAt: atHour(10, 40),
      lines: [line("leche", 12), line("cafe", 4), line("papel", 6)],
      discountPct: 5,
      synced: true,
    },
    {
      id: "RC-M0850",
      clientId: "marta-1",
      sellerId: "marta",
      createdAt: atHour(8, 50),
      lines: [line("atun", 4), line("aceite", 10), line("detergente", 8)],
      discountPct: 0,
      synced: true,
    },
    {
      id: "RC-M1120",
      clientId: "marta-3",
      sellerId: "marta",
      createdAt: atHour(11, 20),
      lines: [line("coca", 10), line("galletas", 12), line("jabon", 6)],
      discountPct: 0,
      synced: false,
    },
  ];

  return { role: "seller", visits, orders, loads };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

export const useRuta = create<Slice & Actions>()(
  persist(
    (set, get) => ({
      ...seed(),
      setRole: (role) => set({ role }),
      checkIn: (clientId, note) => {
        const client = CLIENTS.find((item) => item.id === clientId);
        if (!client) return;
        const visit: Visit = {
          id: uid("V"),
          clientId,
          sellerId: ACTIVE_SELLER_ID,
          at: new Date().toISOString(),
          note,
        };
        const visits = get().visits.filter(
          (item) => !(item.clientId === clientId && item.sellerId === ACTIVE_SELLER_ID && isToday(item.at)),
        );
        set({ visits: [visit, ...visits] });
      },
      placeOrder: ({ clientId, lines, discountPct }) => {
        const picked = lines.filter((item) => item.qty > 0);
        if (picked.length === 0) return { ok: false, error: "Agrega al menos un producto." };
        const stock = get().loads[ACTIVE_SELLER_ID] ?? {};
        for (const item of picked) {
          if ((stock[item.productId] ?? 0) < item.qty) {
            const name = PRODUCTS.find((product) => product.id === item.productId)?.name ?? "Producto";
            return { ok: false, error: `No alcanza ${name} a bordo.` };
          }
        }
        const nextStock = { ...stock };
        for (const item of picked) nextStock[item.productId] = (nextStock[item.productId] ?? 0) - item.qty;
        const order: Order = {
          id: uid("RC"),
          clientId,
          sellerId: ACTIVE_SELLER_ID,
          createdAt: new Date().toISOString(),
          lines: picked,
          discountPct,
          synced: false,
        };
        const already = get().visits.some(
          (item) => item.clientId === clientId && item.sellerId === ACTIVE_SELLER_ID && isToday(item.at),
        );
        const visit: Visit = {
          id: uid("V"),
          clientId,
          sellerId: ACTIVE_SELLER_ID,
          at: order.createdAt,
          note: "Pedido",
        };
        set({
          orders: [order, ...get().orders],
          loads: { ...get().loads, [ACTIVE_SELLER_ID]: nextStock },
          visits: already ? get().visits : [visit, ...get().visits],
        });
        return { ok: true, order };
      },
      setRemaining: (productId, qty) => {
        const current = get().loads[ACTIVE_SELLER_ID] ?? morningLoad();
        set({
          loads: {
            ...get().loads,
            [ACTIVE_SELLER_ID]: { ...current, [productId]: Math.max(0, qty) },
          },
        });
      },
      syncMine: () => {
        let count = 0;
        const orders = get().orders.map((order) => {
          if (order.sellerId === ACTIVE_SELLER_ID && isToday(order.createdAt) && !order.synced) {
            count += 1;
            return { ...order, synced: true };
          }
          return order;
        });
        if (count > 0) set({ orders });
        return count;
      },
      reset: () => set(seed()),
    }),
    {
      name: "rutacampo-v1",
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        role: state.role,
        visits: state.visits,
        orders: state.orders,
        loads: state.loads,
      }),
    },
  ),
);

export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.resolve(useRuta.persist.rehydrate()).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
