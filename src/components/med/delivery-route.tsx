import { useEffect, useMemo, useState } from "react";
import { PinLegend } from "@/components/med/ui";
import { StoreMap, type StoreMarker } from "@/components/med/store-map";
import { driverDayStops } from "@/lib/med/day-stops";
import { googleAddressLink, googleLink } from "@/lib/med/locate";
import { useMed } from "@/lib/med/store";

export function DeliveryRoute({ driverId, list = true }: { driverId: string; list?: boolean }) {
  const orders = useMed((state) => state.orders);
  const clients = useMed((state) => state.clients);
  const mapFocusId = useMed((state) => state.mapFocusId);
  const setMapFocus = useMed((state) => state.setMapFocus);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!mapFocusId) return;
    setFocus(mapFocusId);
    setMapFocus(null);
  }, [mapFocusId, setMapFocus]);
  const stops = useMemo(() => driverDayStops(orders, clients, driverId), [clients, driverId, orders]);
  const markers = useMemo<StoreMarker[]>(
    () =>
      stops.flatMap((stop) => {
        if (!stop.point) return [];
        return [
          {
            id: stop.client.id,
            title: stop.client.store,
            lines: [stop.client.address, stop.client.zone, stop.pending > 0 ? "Pendiente" : "Entregado"].filter(Boolean),
            lat: stop.point.lat,
            lng: stop.point.lng,
            tone: stop.pending > 0 ? "passed" : "done",
            href: `/cliente/${stop.client.id}`,
            mapsUrl: googleLink(stop.point.lat, stop.point.lng),
          },
        ];
      }),
    [stops],
  );
  const selectedId = focus && markers.some((item) => item.id === focus) ? focus : null;

  if (stops.length === 0) {
    return <p className="mt-4 text-sm text-muted">Hoy no hay entregas en esta unidad.</p>;
  }

  return (
    <section className="mt-4">
      <h2 className="text-lg font-extrabold text-section">Puntos de hoy</h2>
      <p className="mt-1 text-sm text-muted">
        {markers.length} {markers.length === 1 ? "tienda con punto" : "tiendas con punto"} de {stops.length}{" "}
        {stops.length === 1 ? "entrega" : "entregas"}.
      </p>
      {markers.length > 0 ? (
        <div className="relative z-0 mt-3 overflow-hidden rounded-2xl border border-line bg-card">
          <StoreMap markers={markers} selectedId={selectedId} onSelect={setFocus} className="h-80 w-full" />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Estas entregas todavía no tienen punto. Abajo está la dirección.</p>
      )}
      {markers.length > 0 ? <PinLegend mode="entrega" /> : null}
      {list ? (
        <ul className="mt-3 flex flex-col gap-2">
          {stops.map((stop) => {
            const active = stop.client.id === selectedId;
            const maps = stop.point
              ? googleLink(stop.point.lat, stop.point.lng)
              : googleAddressLink(stop.client.address, stop.client.zone);
            return (
              <li key={stop.client.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFocus(stop.client.id)}
                  className={"w-full rounded-2xl border px-4 py-3 text-left " + (active ? "border-blue bg-blue-soft" : "border-line bg-card")}
                >
                  <span className="block font-semibold text-blue-deep">{stop.client.store}</span>
                  <span className="mt-1 block text-sm font-semibold text-ink">{stop.client.address || "Sin dirección"}</span>
                  <span className="block text-sm text-muted">{stop.client.zone}</span>
                  <span className="mt-1 block text-sm font-semibold text-blue">
                    {stop.point ? (stop.point.kind === "gps" ? "Punto de la puerta" : "Punto de la ruta") : "Sin punto en el mapa"}
                    {stop.pending > 0 ? " · Por entregar" : " · Entregado"}
                  </span>
                </button>
                <a href={maps} target="_blank" rel="noreferrer" className="mt-1 inline-flex h-11 items-center text-sm font-semibold text-blue">
                  Cómo llegar
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
