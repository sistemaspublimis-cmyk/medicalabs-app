import { ZONE } from "@/lib/med/locate";

/** Busca la calle en el callejero libre. Sirve cuando este teléfono no da GPS. */
export async function placeFromAddress(address: string, zone: string): Promise<{ lat: number; lng: number } | null> {
  const query = [address.trim(), zone.trim(), "México"].filter(Boolean).join(", ");
  if (query.length < 8) return null;
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lat", String(ZONE.lat));
  url.searchParams.set("lon", String(ZONE.lng));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      features?: { geometry?: { coordinates?: number[] } }[];
    };
    const coords = json.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
