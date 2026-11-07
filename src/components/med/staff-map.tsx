import { useEffect } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type StaffArea = {
  id: string;
  name: string;
  kind: "zona" | "ruta";
  points: [number, number][];
};

function Recenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.setView([center.lat, center.lng], 14)}
      className="absolute right-2 bottom-2 z-[500] h-11 rounded-xl bg-card px-3 text-sm font-semibold text-title shadow"
    >
      Centrar
    </button>
  );
}

function Frame({ spots }: { spots: [number, number][] }) {
  const map = useMap();
  const signature = spots.map((spot) => `${spot[0].toFixed(5)},${spot[1].toFixed(5)}`).join(";");
  useEffect(() => {
    if (spots.length === 0) return;
    if (spots.length === 1) {
      map.setView(spots[0], 15);
      return;
    }
    map.fitBounds(spots, { padding: [28, 28], maxZoom: 15 });
    // The signature is the spot list. The array itself changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

export function StaffMap({
  points,
  center,
  path = [],
  areas = [],
}: {
  points: MapPoint[];
  center: { lat: number; lng: number };
  path?: [number, number][];
  areas?: StaffArea[];
}) {
  const spots: [number, number][] = [
    ...points.map((point) => [point.lat, point.lng] as [number, number]),
    ...path,
    ...areas.flatMap((area) => area.points),
    [center.lat, center.lng],
  ];
  return (
    <div className="relative">
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-80 w-full rounded-2xl border border-line"
      style={{ height: "20rem", width: "100%" }}
    >
      <Frame spots={spots} />
      <Recenter center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {areas.map((area) =>
        area.kind === "zona" ? (
          <Polygon key={area.id} positions={area.points} pathOptions={{ color: "#0d3b66", weight: 2, fillColor: "#3dcb74", fillOpacity: 0.18 }}>
            <Tooltip>{area.name}</Tooltip>
          </Polygon>
        ) : (
          <Polyline key={area.id} positions={area.points} pathOptions={{ color: "#c45c26", weight: 4, opacity: 0.95, dashArray: "8 6" }}>
            <Tooltip>{area.name}</Tooltip>
          </Polyline>
        ),
      )}
      {path.length > 1 ? <Polyline positions={path} pathOptions={{ color: "#2f9fe0", weight: 5, opacity: 0.9 }} /> : null}
      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={[point.lat, point.lng]}
          radius={12}
          pathOptions={{ color: "#0e5f96", fillColor: "#1a8ad4", fillOpacity: 0.92 }}
        >
          <Popup>{point.name}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
    </div>
  );
}
