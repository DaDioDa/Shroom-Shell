import L from "leaflet";
import { useEffect, useRef } from "react";
import { isSightingExpired, sweepAreaSquare, type Region, type StoredSighting, type SweepAreaColor, type Waypoint } from "@shell/shared";

/** Postcard Check 的結果標記。 */
export interface CheckMark {
  lat: number;
  lng: number;
  kind: "found" | "missing" | "unfinished";
  tooltip: string;
}

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
  checkMarks = [],
  region = null,
  drawing = false,
  onRegionDrawn,
  now = Date.now(),
}: {
  waypoints: Waypoint[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (w: Waypoint) => void;
  sightings?: StoredSighting[];
  areas?: SweepArea[];
  checkMarks?: CheckMark[];
  /** Discovery 的 Region 外框。 */
  region?: Region | null;
  /** true＝拖曳畫矩形（此時不能拖地圖）。 */
  drawing?: boolean;
  onRegionDrawn?: (r: Region) => void;
  /** 判斷 Sighting 是否過期用的現在時間。 */
  now?: number;
}) {
  const drawnRef = useRef(onRegionDrawn);
  drawnRef.current = onRegionDrawn;
  const regionLayer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef({ onMapClick, onMarkerClick });
  clickRef.current = { onMapClick, onMarkerClick };
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const sightingLayer = useRef<L.LayerGroup | null>(null);
  const areaLayer = useRef<L.LayerGroup | null>(null);
  const checkLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const m = L.map(el.current!).setView([25.033964, 121.564468], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => clickRef.current.onMapClick?.(e.latlng.lat, e.latlng.lng));
    areaLayer.current = L.layerGroup().addTo(m);
    regionLayer.current = L.layerGroup().addTo(m);
    checkLayer.current = L.layerGroup().addTo(m);
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
  }, [sightings, now]);

  useEffect(() => {
    const g = checkLayer.current!;
    g.clearLayers();
    const colors = { found: "#2f9e44", missing: "#e03131", unfinished: "#868e96" } as const;
    const shape = { found: "✔", missing: "✖", unfinished: "？" } as const;
    for (const c of checkMarks) {
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({ className: "", html: `<div style="background:${colors[c.kind]};color:#fff;border-radius:50%;width:22px;height:22px;line-height:22px;text-align:center;font-weight:bold">${shape[c.kind]}</div>`, iconSize: [22, 22] }),
      })
        .bindTooltip(c.tooltip)
        .addTo(g);
    }
  }, [checkMarks]);

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

  useEffect(() => {
    const g = regionLayer.current!;
    g.clearLayers();
    if (region) L.rectangle([[region.south, region.west], [region.north, region.east]], { color: "#1971c2", weight: 2, fillOpacity: 0.08, dashArray: "6 4" }).addTo(g);
  }, [region]);

  // 畫矩形：按下、拖曳、放開。
  useEffect(() => {
    const m = map.current!;
    if (!drawing) return;
    m.dragging.disable();
    m.getContainer().style.cursor = "crosshair";
    let start: L.LatLng | null = null;
    let box: L.Rectangle | null = null;
    const down = (e: L.LeafletMouseEvent) => {
      start = e.latlng;
      box = L.rectangle(L.latLngBounds(start, start), { color: "#1971c2", weight: 2 }).addTo(regionLayer.current!);
    };
    const move = (e: L.LeafletMouseEvent) => {
      if (start && box) box.setBounds(L.latLngBounds(start, e.latlng));
    };
    const up = (e: L.LeafletMouseEvent) => {
      if (!start) return;
      const b = L.latLngBounds(start, e.latlng);
      start = null;
      box?.remove();
      box = null;
      if (b.getNorth() !== b.getSouth() && b.getEast() !== b.getWest()) {
        drawnRef.current?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
      }
    };
    m.on("mousedown", down).on("mousemove", move).on("mouseup", up);
    return () => {
      m.off("mousedown", down).off("mousemove", move).off("mouseup", up);
      m.dragging.enable();
      m.getContainer().style.cursor = "";
      box?.remove();
    };
  }, [drawing]);

  return <div ref={el} className="map" />;
}
