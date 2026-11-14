import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Waypoint } from "@shell/shared";

export function WaypointMap({ waypoints }: { waypoints: Waypoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const m = L.map(el.current!).setView([25.033964, 121.564468], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
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
      marker.bindTooltip(w.label || `${w.lat}, ${w.lng}`, { permanent: true, direction: "top" });
      pts.push([w.lat, w.lng]);
    }
    if (pts.length) map.current!.fitBounds(L.latLngBounds(pts), { maxZoom: 16, padding: [40, 40] });
  }, [waypoints]);

  return <div ref={el} className="map" />;
}
