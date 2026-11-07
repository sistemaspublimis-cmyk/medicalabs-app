import type { WorkspaceRole } from "@/lib/med/catalog";

export type DemoAccount = {
  email: string;
  password: string;
  role: WorkspaceRole;
  name: string;
  sub: string;
};

/** Cuentas fijas de la demostración. El correo decide el inicio; no hay cambio de puesto en el menú. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "dueño@gmail.com",
    password: "ESmermelada2",
    role: "owner",
    name: "Dueño",
    sub: "Dirección",
  },
  {
    email: "preventa@gmail.com",
    password: "Preventa2",
    role: "presale",
    name: "Ana Ríos",
    sub: "Prev Coacalco",
  },
  {
    email: "repartidor@gmail.com",
    password: "Reparto2",
    role: "driver",
    name: "Marta Salas",
    sub: "Reparto norte",
  },
  {
    email: "gerente@gmail.com",
    password: "Gerente2",
    role: "manager",
    name: "Gerente",
    sub: "Gerencia",
  },
  {
    email: "almacen@gmail.com",
    password: "Almacen2",
    role: "warehouse",
    name: "Almacén",
    sub: "Bodega",
  },
];

function fold(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchAccount(email: string, password: string): DemoAccount | null {
  const key = fold(email);
  if (!key || password.length === 0) return null;
  const account = DEMO_ACCOUNTS.find((item) => fold(item.email) === key);
  if (!account || account.password !== password) return null;
  return account;
}

export function accountByEmail(email: string | null | undefined): DemoAccount | null {
  if (!email) return null;
  const key = fold(email);
  return DEMO_ACCOUNTS.find((item) => fold(item.email) === key) ?? null;
}
