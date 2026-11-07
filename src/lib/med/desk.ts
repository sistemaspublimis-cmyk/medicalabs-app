import { fixInsideArea } from "@/lib/med/near";
import type { WorkArea } from "@/lib/med/store";

export const ZONE_COLORS = ["#1a8ad4", "#3dcb74", "#c45c26", "#5b3a8c", "#d4a017", "#0e7c66", "#c43b5a", "#0d3b66"] as const;

export function cleanHex(value: unknown): string | null {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) return null;
  return value.toLowerCase();
}

export function areaColor(area: { color?: string }, index: number): string {
  return cleanHex(area.color) ?? ZONE_COLORS[index % ZONE_COLORS.length];
}

export function hace(iso: string, now = Date.now()): string {
  const elapsed = now - Date.parse(iso);
  if (!Number.isFinite(elapsed)) return "";
  if (elapsed < 45_000) return "hace un momento";
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return minutes === 1 ? "hace 1 minuto" : `hace ${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "hace 1 hora" : `hace ${hours} horas`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export function isFresh(iso: string, minutes: number, now = Date.now()): boolean {
  const elapsed = now - Date.parse(iso);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= minutes * 60_000;
}

export function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function assignedZones(areas: WorkArea[], personId: string): WorkArea[] {
  return areas.filter((area) => area.kind === "zona" && area.personId === personId);
}

export function zoneNames(areas: WorkArea[], personId: string): string {
  const names = assignedZones(areas, personId).map((area) => area.name);
  return names.length > 0 ? names.join(", ") : "Sin zona";
}

export function whereLabel(areas: WorkArea[], point: { lat: number; lng: number } | null, personId: string): string {
  if (!point) return "Sin lectura";
  const own = assignedZones(areas, personId);
  const here = areas.filter((area) => area.kind === "zona" && fixInsideArea(area, point));
  const mine = here.find((area) => area.personId === personId);
  if (mine) return mine.name;
  if (own.length > 0) return here[0] ? `Fuera de su zona · ahora en ${here[0].name}` : "Fuera de su zona";
  return here[0]?.name ?? "Sin zona";
}

export function leftZone(areas: WorkArea[], point: { lat: number; lng: number } | null, personId: string): boolean {
  const own = assignedZones(areas, personId);
  if (!point || own.length === 0) return false;
  return !own.some((area) => fixInsideArea(area, point));
}
