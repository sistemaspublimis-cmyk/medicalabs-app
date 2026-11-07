import { fieldPersonId, useMed, type DriverFix } from "@/lib/med/store";

/** Lectura al entrar y luego con la app abierta. 9 minutos es el tiempo de “en línea”. */
export const DEFAULT_PING_MINUTES = 9;

export function clampPing(value: unknown): number {
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(minutes)) return DEFAULT_PING_MINUTES;
  return Math.min(30, Math.max(3, Math.round(minutes)));
}

export function pingMs(minutes: number): number {
  return clampPing(minutes) * 60 * 1000;
}

export function pingLabel(minutes: number): string {
  const count = clampPing(minutes);
  return count === 1 ? "cada minuto" : `cada ${count} minutos`;
}

/** Centro de la sucursal. No es una ubicación de repartidor. */
export const ZONE = { lat: 19.6333, lng: -99.0931, label: "Coacalco" };

let pending = false;

type FixReading = { lat: number; lng: number; accuracy: number | null };

function isDenied(error: unknown): boolean {
  if (typeof error === "object" && error && "code" in error && (error as { code: number }).code === 1) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /denied|permission/i.test(message);
}

async function readNativeFix(): Promise<FixReading | null> {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const { Geolocation } = await import("@capacitor/geolocation");
  const current = await Geolocation.checkPermissions();
  if (current.location !== "granted" && current.coarseLocation !== "granted") {
    const asked = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    if (asked.location !== "granted" && asked.coarseLocation !== "granted") {
      throw Object.assign(new Error("denied"), { code: 1 });
    }
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
  };
}

function readBrowserFix(): Promise<FixReading> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("sin gps"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
    );
  });
}

function readBrowserFixFresh(): Promise<FixReading> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("sin gps"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  });
}

/** Lectura de la puerta al registrar una tienda. En Android usa el GPS del sistema. */
export async function readStoreFix(): Promise<{ lat: number; lng: number; accuracy: number | null; at: string }> {
  const fix = (await readNativeFix()) ?? (await readBrowserFixFresh());
  return { ...fix, at: new Date().toISOString() };
}

function sharingNow(): boolean {
  const state = useMed.getState();
  const personId = fieldPersonId(state.role);
  return personId != null && state.unitConsent?.[personId] === "granted" && state.locationConsent === "granted";
}

/** Lee el GPS de la preventa o del repartidor que tiene la sesión, si ya aceptó. */
export function requestFieldFix(): void {
  const { setLocate, locateStatus } = useMed.getState();
  if (!sharingNow()) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  if (pending || locateStatus === "asking") return;
  pending = true;
  setLocate("asking", "");
  void (async () => {
    try {
      const fix = (await readNativeFix()) ?? (await readBrowserFix());
      pending = false;
      const state = useMed.getState();
      if (!sharingNow()) {
        state.setLocate("idle", "");
        return;
      }
      const point: DriverFix = { at: new Date().toISOString(), ...fix };
      state.recordLocation(point);
    } catch (error) {
      pending = false;
      if (!fieldPersonId(useMed.getState().role)) return;
      if (isDenied(error)) {
        useMed.getState().setLocate("denied", "");
        return;
      }
      useMed.getState().setLocate("unavailable", "");
    }
  })();
}

export function formatFixTime(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAccuracy(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return "";
  return `± ${Math.round(meters)} m`;
}

export function googleEmbed(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}&z=16&hl=es&output=embed`;
}

export function googleLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function googleAddressLink(address: string, zone: string): string {
  const query = [address, zone, "Coacalco"].filter((part) => part.trim()).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
