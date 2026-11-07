import { todayKey } from "@/lib/ruta/format";

/** Parada de una semana. La semana es el lunes, en formato AAAA-MM-DD. */
export type WeekStop = {
  week: string;
  clientId: string;
  driverId: string;
};

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function addDays(key: string, days: number): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

/** Lunes de la semana de esa fecha. */
export function mondayOf(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + delta);
  return todayKey(copy);
}

export function onDay(iso: string, key: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return todayKey(date) === key;
}

export function inWeek(iso: string, monday: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return mondayOf(date) === monday;
}

export function shortDay(key: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(dateFromKey(key));
}

export function weekSpan(monday: string): string {
  const end = addDays(monday, 6);
  const startLabel = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(dateFromKey(monday));
  const endLabel = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(dateFromKey(end));
  return `${startLabel} – ${endLabel}`;
}

export function weekPlanned(week: string, plans: WeekStop[]): boolean {
  return plans.some((row) => row.week === week);
}

export function materializeWeek(week: string, clients: { id: string; driverId: string }[], plans: WeekStop[]): WeekStop[] {
  const existing = plans.filter((row) => row.week === week);
  if (existing.length > 0) {
    return existing.map((row) => ({ week, clientId: row.clientId, driverId: row.driverId }));
  }
  return clients.map((client) => ({ week, clientId: client.id, driverId: client.driverId }));
}

export function driverIdFor(week: string, clientId: string, standing: string, plans: WeekStop[]): string {
  const row = plans.find((item) => item.week === week && item.clientId === clientId);
  return row?.driverId || standing;
}

export function stopsForDriver<T extends { id: string; driverId: string }>(
  week: string,
  driverId: string,
  clients: T[],
  plans: WeekStop[],
): T[] {
  if (!weekPlanned(week, plans)) return clients.filter((client) => client.driverId === driverId);
  const ids = new Set(plans.filter((row) => row.week === week && row.driverId === driverId).map((row) => row.clientId));
  return clients.filter((client) => ids.has(client.id));
}
