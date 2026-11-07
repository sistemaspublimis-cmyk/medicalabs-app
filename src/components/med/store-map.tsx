import { useEffect, useRef, useState } from "react";
import type { LayerGroup, LeafletMouseEvent, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { ZONE } from "@/lib/med/locate";

export type StorePath = {
  id: string;
  points: [number, number][];
  color?: string;
};

export type StoreArea = {
  id: string;
  name: string;
  kind: "zona" | "ruta";
  points: [number, number][];
  draft?: boolean;
  color?: string;
  caption?: string;
};

export type StoreMarker = {
  id: string;
  title: string;
  lines: string[];
  lat: number;
  lng: number;
  tone: "store" | "gps" | "driver" | "presale" | "pending" | "passed" | "done" | "crew";
  color?: string;
  href?: string;
  mapsUrl: string;
  photo?: string;
  actionHref?: string;
  actionLabel?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function safePhoto(photo: string | undefined): string {
  if (!photo) return "";
  if (!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(photo)) return "";
  return photo;
}

type LeafletNs = typeof import("leaflet");

function markerIcon(L: LeafletNs, marker: StoreMarker, selected: boolean) {
  const selectedClass = selected ? " is-selected" : "";
  const color = marker.color && /^#[0-9a-fA-F]{6}$/.test(marker.color) ? ` style="--pin:${marker.color}"` : "";
  return L.divIcon({
    className: "med-pin",
    html: `<span class="med-pin-label med-pin-${marker.tone}${selectedClass}"${color}>${escapeHtml(marker.title)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function safeAction(href: string | undefined): string {
  if (!href || !/^#historial-[A-Za-z0-9-]+$/.test(href)) return "";
  return href;
}

function areaColor(area: StoreArea): string {
  if (area.color && /^#[0-9a-fA-F]{6}$/.test(area.color)) return area.color;
  return area.kind === "zona" ? "#3dcb74" : "#c45c26";
}

function popupHtml(marker: StoreMarker): string {
  const lines = marker.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const photo = safePhoto(marker.photo);
  const image = photo ? `<img src="${photo}" alt="Fachada de ${escapeHtml(marker.title)}" />` : "";
  const shop = marker.href ? `<a href="${escapeHtml(marker.href)}">Ver tienda</a>` : "";
  const actionHref = safeAction(marker.actionHref);
  const action = actionHref && marker.actionLabel ? `<a href="${escapeHtml(actionHref)}">${escapeHtml(marker.actionLabel)}</a>` : "";
  return `<div class="med-popup">${image}<p class="med-popup-title">${escapeHtml(marker.title)}</p>${lines}<p class="med-popup-links"><a href="${escapeHtml(marker.mapsUrl)}" target="_blank" rel="noreferrer">Abrir en Google Maps</a>${shop}${action}</p></div>`;
}

export function StoreMap({
  markers,
  paths = [],
  areas = [],
  drawing = false,
  onMapClick,
  selectedId,
  onSelect,
  openSelected = false,
  className = "h-96 w-full",
  fit = "fit",
  homeTick = 0,
}: {
  markers: StoreMarker[];
  paths?: StorePath[];
  areas?: StoreArea[];
  drawing?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  openSelected?: boolean;
  className?: string;
  /** zone: se queda en Coacalco. fit: encuadra tiendas y zonas. */
  fit?: "fit" | "zone";
  homeTick?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [localHome, setLocalHome] = useState(0);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletNs | null>(null);
  const overlayRef = useRef<LayerGroup | null>(null);
  const pathsRefLayer = useRef<LayerGroup | null>(null);
  const byId = useRef<Map<string, LeafletMarker>>(new Map());
  const selectedRef = useRef(selectedId);
  const fitRef = useRef(fit);
  selectedRef.current = selectedId;
  fitRef.current = fit;
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  const markersRef = useRef(markers);
  const pathsRef = useRef(paths);
  const areasRef = useRef(areas);
  const drawingRef = useRef(drawing);
  onSelectRef.current = onSelect;
  onMapClickRef.current = onMapClick;
  markersRef.current = markers;
  pathsRef.current = paths;
  areasRef.current = areas;
  drawingRef.current = drawing;
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    setFailed(false);
    void (async () => {
      try {
        await import("leaflet/dist/leaflet.css");
        const loaded = await import("leaflet");
        const L = (loaded.default ?? loaded) as LeafletNs;
        if (cancelled || !node.isConnected) return;
        const map = L.map(node, { scrollWheelZoom: false, zoomControl: true });
        mapRef.current = map;
        leafletRef.current = L;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        const syncZoom = () => node.classList.toggle("map-far", map.getZoom() < 14);
        map.on("zoomend", syncZoom);
        map.setView([ZONE.lat, ZONE.lng], 13);
        syncZoom();
        map.invalidateSize();
        if (!cancelled) setReady((value) => value + 1);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      byId.current = new Map();
      overlayRef.current = null;
      pathsRefLayer.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || ready === 0) return;
    pathsRefLayer.current?.remove();
    const pathGroup = L.layerGroup().addTo(map);
    pathsRefLayer.current = pathGroup;
    for (const path of paths) {
      if (path.points.length < 2) continue;
      L.polyline(path.points, { color: path.color || "#2f9fe0", weight: 5, opacity: 0.9 }).addTo(pathGroup);
    }
    const seen = new Set<string>();
    for (const item of markers) {
      seen.add(item.id);
      const pin = byId.current.get(item.id);
      if (!pin) {
        const created = L.marker([item.lat, item.lng], { icon: markerIcon(L, item, item.id === selectedRef.current), title: item.title })
          .addTo(map)
          .bindPopup(popupHtml(item), { maxWidth: 260, autoPan: true });
        created.on("click", () => onSelectRef.current?.(item.id));
        byId.current.set(item.id, created);
      } else {
        pin.setLatLng([item.lat, item.lng]);
        pin.setIcon(markerIcon(L, item, item.id === selectedRef.current));
        pin.setPopupContent(popupHtml(item));
      }
    }
    for (const [id, pin] of byId.current) {
      if (seen.has(id)) continue;
      pin.remove();
      byId.current.delete(id);
    }
  }, [markers, paths, ready]);

  const spotKey = [
    markers.map((item) => `${item.id}@${item.lat.toFixed(5)},${item.lng.toFixed(5)}`).join(";"),
    paths.map((path) => `${path.id}:${path.points.length}`).join(";"),
    areas
      .filter((area) => !area.draft)
      .map((area) => `${area.id}:${area.points.length}`)
      .join(";"),
  ].join("|");

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || ready === 0 || fitRef.current !== "fit") return;
    const spots: [number, number][] = [
      ...markersRef.current.map((item) => [item.lat, item.lng] as [number, number]),
      ...pathsRef.current.flatMap((path) => path.points),
      ...areasRef.current.flatMap((area) => (area.draft ? [] : area.points)),
    ];
    if (spots.length === 0) map.setView([ZONE.lat, ZONE.lng], 13);
    else if (spots.length === 1) map.setView(spots[0], 16);
    else map.fitBounds(L.latLngBounds(spots).pad(0.25), { maxZoom: 15 });
  }, [spotKey, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || ready === 0 || (!homeTick && !localHome)) return;
    map.setView([ZONE.lat, ZONE.lng], 13);
  }, [homeTick, localHome, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || ready === 0) return;
    overlayRef.current?.remove();
    const group = L.layerGroup().addTo(map);
    overlayRef.current = group;
    for (const area of areas) {
      const zona = area.kind === "zona";
      const color = areaColor(area);
      if (zona && area.points.length >= 3) {
        L.polygon(area.points, {
          color,
          weight: area.draft ? 3 : 2,
          fillColor: color,
          fillOpacity: area.draft ? 0.28 : 0.22,
          interactive: false,
        })
          .addTo(group)
          .bindTooltip(area.caption || area.name, { sticky: true });
      } else if (!zona && area.points.length >= 2) {
        L.polyline(area.points, { color, weight: 4, opacity: 0.95, dashArray: "8 6", interactive: false })
          .addTo(group)
          .bindTooltip(area.caption || area.name, { sticky: true });
      } else if (area.points.length >= 2) {
        L.polyline(area.points, { color: "#0d3b66", weight: 2, dashArray: "4 4", opacity: 0.8, interactive: false }).addTo(group);
      }
      if (!area.draft) continue;
      for (const point of area.points) {
        L.circleMarker(point, { radius: 6, color: "#0d3b66", fillColor: "#ffffff", fillOpacity: 1, weight: 2, interactive: false }).addTo(group);
      }
    }
    return () => {
      group.remove();
      if (overlayRef.current === group) overlayRef.current = null;
    };
  }, [areas, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const node = host.current;
    if (!map || !node || ready === 0 || !drawing) return;
    node.classList.add("is-drawing");
    const onClick = (event: LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      onMapClickRef.current?.(event.latlng.lat, event.latlng.lng);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      node.classList.remove("is-drawing");
    };
  }, [drawing, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || ready === 0) return;
    for (const item of markers) {
      const pin = byId.current.get(item.id);
      if (!pin) continue;
      pin.setIcon(markerIcon(L, item, item.id === selectedId));
      pin.setPopupContent(popupHtml(item));
    }
    if (!selectedId) return;
    const pin = byId.current.get(selectedId);
    if (!pin) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const zoom = Math.max(map.getZoom(), 16);
    if (openSelected) map.once("moveend", () => pin.openPopup());
    map.flyTo(pin.getLatLng(), zoom, { duration: reduce ? 0 : 0.45 });
  }, [openSelected, ready, selectedId]);

  return (
    <div className="relative isolate z-0">
      <div ref={host} className={className} />
      <button
        type="button"
        onClick={() => setLocalHome((value) => value + 1)}
        className="absolute right-2 bottom-2 z-[500] h-11 rounded-xl bg-card px-3 text-sm font-semibold text-title shadow"
      >
        Centrar
      </button>
      {failed ? (
        <p className="absolute inset-0 grid place-items-center bg-card px-4 text-center text-sm text-muted">No se pudo abrir el mapa.</p>
      ) : null}
    </div>
  );
}
