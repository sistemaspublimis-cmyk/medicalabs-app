import { clientMapPoint, type ClientStop } from "@/lib/med/catalog";
import type { WorkArea } from "@/lib/med/store";

export type LatLng = { lat: number; lng: number };

export function distanceMeters(from: LatLng, to: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * rad;
  const dLng = (to.lng - from.lng) * rad;
  const lat1 = from.lat * rad;
  const lat2 = to.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function sortByNear<T>(items: T[], origin: LatLng | null, pointOf: (item: T) => LatLng | null): T[] {
  if (!origin) return items;
  return [...items].sort((left, right) => {
    const a = pointOf(left);
    const b = pointOf(right);
    const da = a ? distanceMeters(origin, a) : Number.POSITIVE_INFINITY;
    const db = b ? distanceMeters(origin, b) : Number.POSITIVE_INFINITY;
    return da - db;
  });
}

function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a.lat > point.lat !== b.lat > point.lat;
    if (!crosses) continue;
    const lng = ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (point.lng < lng) inside = !inside;
  }
  return inside;
}

function segmentMeters(point: LatLng, start: LatLng, end: LatLng): number {
  const mean = ((start.lat + end.lat) / 2) * (Math.PI / 180);
  const kx = 111_320 * Math.cos(mean);
  const ky = 110_540;
  const ax = (start.lng - point.lng) * kx;
  const ay = (start.lat - point.lat) * ky;
  const bx = (end.lng - point.lng) * kx;
  const by = (end.lat - point.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.min(1, Math.max(0, -((ax * dx + ay * dy) / len)));
  return Math.hypot(ax + dx * t, ay + dy * t);
}

function nearPath(point: LatLng, path: LatLng[], meters: number): boolean {
  for (let index = 1; index < path.length; index += 1) {
    if (segmentMeters(point, path[index - 1], path[index]) <= meters) return true;
  }
  return false;
}

export function fixInsideArea(area: WorkArea, point: LatLng): boolean {
  if (area.points.length === 0) return false;
  if (area.kind === "zona") return pointInPolygon(point, area.points);
  return nearPath(point, area.points, 400);
}

export function clientInsideArea(area: WorkArea, client: ClientStop): boolean {
  const point = clientMapPoint(client);
  if (!point) return false;
  return fixInsideArea(area, point);
}

export function clientsForArea(area: WorkArea, clients: ClientStop[]): { client: ClientStop; inside: boolean }[] {
  return clients
    .flatMap((client) => {
      const inside = clientInsideArea(area, client);
      if (!inside && client.areaId !== area.id) return [];
      return [{ client, inside }];
    })
    .sort((left, right) => left.client.store.localeCompare(right.client.store, "es"));
}
