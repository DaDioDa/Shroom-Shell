import L from "leaflet";
import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { useRegionEditorLayer, type RegionEditorState } from "./regionEditorLayer.js";
import { useSweepBoxLayer, type SweepBoxEditorState } from "./sweepBoxLayer.js";
import { parseCoordinate, sightingMarker, sweepAreaSquare, type Region, type StoredSighting, type SweepAreaColor, type Waypoint } from "@shell/shared";

/** Postcard Check 的結果標記。 */
export interface CheckMark {
  lat: number;
  lng: number;
  kind: "found" | "missing" | "unfinished";
  tooltip: string;
}

/** 歷史分頁：Batch 當時走過的點。 */
export interface HistoryPoint {
  lat: number;
  lng: number;
  label: string;
}

/** 地圖上的 Sweep Area：以 (lat,lng) 為中心、邊長 2R 公尺的正方形。 */
export interface SweepArea {
  lat: number;
  lng: number;
  radius: number;
  color: SweepAreaColor | "preview";
  tooltip?: string;
  /** 點方格時回報給 onAreaClick 的識別（Discovery 的 Grid Cell 用）。 */
  id?: number;
}

const AREA_COLORS: Record<SweepAreaColor | "preview", string> = { green: "#2f9e44", red: "#e03131", gray: "#868e96", preview: "#1971c2" };

export function WaypointMap({
  waypoints,
  onMapClick,
  onMarkerEdit,
  sightings = [],
  areas = [],
  checkMarks = [],
  historyPoints = [],
  region = null,
  editor = null,
  boxEditor = null,
  centerRef,
  onAreaClick,
  now = Date.now(),
}: {
  waypoints: Waypoint[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerEdit?: (w: Waypoint) => void;
  sightings?: StoredSighting[];
  areas?: SweepArea[];
  checkMarks?: CheckMark[];
  historyPoints?: HistoryPoint[];
  /** Discovery 的 Region 外框。 */
  region?: Region | null;
  /** Region 編輯器（8 個把手、本體平移、格子預覽）；null＝不顯示（鎖定中或沒有 Region）。 */
  editor?: RegionEditorState | null;
  /** 無人巨菇新增模式：Waypoint 的 2R 框可拖移、可縮放；null＝不顯示。 */
  boxEditor?: SweepBoxEditorState | null;
  /** 讓外面問得到目前的地圖中央（「放一個 Region」用）。 */
  centerRef?: MutableRefObject<(() => { lat: number; lng: number }) | null>;
  /** 點 Sweep 方格（有 id 的才可點）。 */
  onAreaClick?: (id: number) => void;
  /** 判斷 Sighting 是否過期用的現在時間。 */
  now?: number;
}) {
  const [mapInst, setMapInst] = useState<L.Map | null>(null);
  useRegionEditorLayer(mapInst, editor);
  useSweepBoxLayer(mapInst, boxEditor);
  // 只在換清單時把地圖縮放到清單範圍；同一份清單新增、移動、改半徑不跳動。
  const fittedList = useRef<number | null>(null);
  const areaClickRef = useRef(onAreaClick);
  areaClickRef.current = onAreaClick;
  const regionLayer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef({ onMapClick, onMarkerEdit });
  clickRef.current = { onMapClick, onMarkerEdit };
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const sightingLayer = useRef<L.LayerGroup | null>(null);
  const areaLayer = useRef<L.LayerGroup | null>(null);
  const checkLayer = useRef<L.LayerGroup | null>(null);
  const historyLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const m = L.map(el.current!).setView([25.033964, 121.564468], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => clickRef.current.onMapClick?.(e.latlng.lat, e.latlng.lng));
    areaLayer.current = L.layerGroup().addTo(m);
    regionLayer.current = L.layerGroup().addTo(m);
    historyLayer.current = L.layerGroup().addTo(m);
    checkLayer.current = L.layerGroup().addTo(m);
    layer.current = L.layerGroup().addTo(m);
    sightingLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    setMapInst(m);
    if (centerRef) centerRef.current = () => m.getCenter();
    return () => {
      if (centerRef) centerRef.current = null;
      setMapInst(null);
      m.remove();
    };
  }, []);

  useEffect(() => {
    const g = layer.current!;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    for (const w of waypoints) {
      const marker = L.circleMarker([w.lat, w.lng], { radius: 8 }).addTo(g);
      // 點標記展開畫面內的編輯表單。
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        clickRef.current.onMarkerEdit?.(w);
      });
      marker.bindTooltip(w.label || `${w.lat}, ${w.lng}`, { permanent: true, direction: "top" });
      pts.push([w.lat, w.lng]);
    }
    const listId = waypoints[0]?.listId ?? null;
    if (pts.length && listId !== fittedList.current) map.current!.fitBounds(L.latLngBounds(pts), { maxZoom: 16, padding: [40, 40] });
    fittedList.current = listId;
  }, [waypoints]);

  useEffect(() => {
    const g = sightingLayer.current!;
    g.clearLayers();
    for (const s of sightings) {
      const m = sightingMarker(s, now);
      const style = m.expired
        ? { color: "#868e96", fillColor: "#ced4da", fillOpacity: 0.5, dashArray: "4 3" }
        : { color: "#d9480f", fillColor: "#ff922b", fillOpacity: 0.9 };
      L.circleMarker([s.lat, s.lng], { radius: 10, ...style })
        .bindTooltip(m.tooltip)
        .addTo(g);
    }
  }, [sightings, now]);

  useEffect(() => {
    const g = historyLayer.current!;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    for (const p of historyPoints) {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: "#495057", fillColor: "#fff", fillOpacity: 1, weight: 2, dashArray: "2 2" })
        .bindTooltip(p.label)
        .addTo(g);
      pts.push([p.lat, p.lng]);
    }
    if (pts.length) map.current!.fitBounds(L.latLngBounds(pts), { maxZoom: 16, padding: [40, 40] });
  }, [historyPoints]);

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
      if (a.id !== undefined) {
        const id = a.id;
        rect.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          areaClickRef.current?.(id);
        });
      }
    }
  }, [areas]);

  useEffect(() => {
    const g = regionLayer.current!;
    g.clearLayers();
    if (region) L.rectangle([[region.south, region.west], [region.north, region.east]], { color: "#1971c2", weight: 2, fillOpacity: 0.08, dashArray: "6 4" }).addTo(g);
  }, [region]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      <CoordinateSearch map={mapInst} />
    </div>
  );
}

/** 地圖上方的座標搜尋列：輸入「緯度, 經度」或 Google Maps 連結，地圖飛過去並放一個大頭針。 */
function CoordinateSearch({ map }: { map: L.Map | null }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pinned, setPinned] = useState(false);
  const pin = useRef<L.CircleMarker | null>(null);

  const clearPin = () => {
    pin.current?.remove();
    pin.current = null;
    setPinned(false);
  };
  useEffect(() => () => {
    pin.current?.remove();
    pin.current = null;
  }, [map]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!map) return;
    const r = parseCoordinate(text);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setError("");
    clearPin();
    pin.current = L.circleMarker([r.lat, r.lng], { radius: 9, color: "#c92a2a", fillColor: "#fa5252", fillOpacity: 0.9, weight: 3 })
      .bindTooltip(`${r.lat}, ${r.lng}`, { permanent: true, direction: "top" })
      .addTo(map);
    setPinned(true);
    map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 16));
  };

  const reset = () => {
    setText("");
    setError("");
    clearPin();
  };

  return (
    <div className="map-search">
      <form onSubmit={submit}>
        <input
          value={text}
          placeholder="輸入座標，例如 -15.5885, -67.2519"
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") reset();
          }}
        />
        {(text || pinned) && (
          <button type="button" title="清除" onClick={reset}>
            ✕
          </button>
        )}
        <button type="submit" title="移到這個座標">
          前往
        </button>
      </form>
      {error && <div className="errors">{error}</div>}
    </div>
  );
}
