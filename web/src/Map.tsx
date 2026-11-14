import L from "leaflet";
import { useEffect, useRef } from "react";
import { sweepAreaSquare, type StoredSighting, type SweepAreaColor, type Waypoint } from "@shell/shared";

/** 地圖上的 Sweep Area：以 (lat,lng) 為中心、邊長 2R 公尺的正方形。 */
export interface SweepArea {
  lat: number;
  lng: number;
  radius: number;
  color: SweepAreaColor;
  tooltip?: string;
}

const AREA_COLORS: Record<SweepAreaColor, string> = { green: "#2f9e44", red: "#e03131", gray: "#868e96" };

export function WaypointMap({
  waypoints,
  onMapClick,
  onMarkerClick,
  sightings = [],
  areas = [],
}: {
  waypoints: Waypoint[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (w: Waypoint) => void;
  sightings?: StoredSighting[];
  areas?: SweepArea[];
}) {
  const clickRef = useRef({ onMapClick, onMarkerClick });
  clickRef.current = { onMapClick, onMarkerClick };
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const sightingLayer = useRef<L.LayerGroup | null>(null);
  const areaLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const m = L.map(el.current!).setView([25.033964, 121.564468], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => clickRef.current.onMapClick?.(e.latlng.lat, e.latlng.lng));
    areaLayer.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    sightingLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
    };
  }, []);

  useEffect(() => {
    const g = layer.current!;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    for (const w of waypoints) {
      const marker = L.circleMarker([w.lat, w.lng], { radius: 8 }).addTo(g);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        clickRef.current.onMarkerClick?.(w);
      });
      marker.bindTooltip(w.label || `${w.lat}, ${w.lng}`, { permanent: true, direction: "top" });
      pts.push([w.lat, w.lng]);
    }
    if (pts.length) map.current!.fitBounds(L.latLngBounds(pts), { maxZoom: 16, padding: [40, 40] });
  }, [waypoints]);

  useEffect(() => {
    const g = sightingLayer.current!;
    g.clearLayers();
    for (const s of sightings) {
      L.circleMarker([s.lat, s.lng], { radius: 10, color: "#d9480f", fillColor: "#ff922b", fillOpacity: 0.9 })
        .bindTooltip(`${s.target}｜${s.spot_name}`)
        .addTo(g);
    }
  }, [sightings]);

  useEffect(() => {
    const g = areaLayer.current!;
    g.clearLayers();
    for (const a of areas) {
      const b = sweepAreaSquare(a, a.radius);
      const color = AREA_COLORS[a.color];
      const rect = L.rectangle([[b.south, b.west], [b.north, b.east]], { color, fillColor: color, fillOpacity: 0.25, weight: 2 }).addTo(g);
      if (a.tooltip) rect.bindTooltip(a.tooltip);
    }
  }, [areas]);

  return <div ref={el} className="map" />;
}
