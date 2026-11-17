import L from "leaflet";
import { useEffect, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode } from "react";
import { useRegionEditorLayer, type RegionEditorState } from "./regionEditorLayer.js";
import { useSweepBoxLayer, type SweepBoxEditorState } from "./sweepBoxLayer.js";
import { parseCoordinate, sightingMarker, sweepAreaSquare, type Region, type StoredSighting, type SweepAreaColor, type Waypoint } from "@shell/shared";
import { icons } from "./ui.js";

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

/** 答案色與 2R 預覽色，和 design/system/theme.ts 的 verdict、preview 相同。 */
const AREA_COLORS: Record<SweepAreaColor | "preview", string> = { green: "#2F9E44", red: "#E03131", gray: "#868E96", preview: "#1971C2" };
const INK = "#23302A";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Waypoint 標記：主題色水滴，寫清單裡的編號；尖端就是座標。pending＝還沒存的新點（白底虛線＋加號）。 */
const PIN_PATH = "M0 0 C-4 -8 -14 -12 -14 -24 A14 14 0 1 1 14 -24 C14 -12 4 -8 0 0Z";
const pinIcon = (n: number, draggable: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="pin" style="cursor:${draggable ? "move" : "pointer"}"><svg width="32" height="42" viewBox="-16 -40 32 42"><path d="${PIN_PATH}" style="fill:var(--primary);stroke:#fff;stroke-width:2.5"/><text x="0" y="-19" text-anchor="middle" style="font:800 ${n >= 100 ? 10 : 13}px Nunito, sans-serif;fill:#fff">${n}</text></svg></div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 40],
  });
const PENDING_PIN = L.divIcon({
  className: "",
  html: `<div class="pin" style="cursor:move"><svg width="32" height="42" viewBox="-16 -40 32 42"><path d="${PIN_PATH}" style="fill:#fff;stroke:var(--primary);stroke-width:2.5;stroke-dasharray:5 3"/><path d="M0 -30 V-18 M-6 -24 H6" style="stroke:var(--primary);stroke-width:2.6;stroke-linecap:round"/></svg></div>`,
  iconSize: [32, 42],
  iconAnchor: [16, 40],
});
/** iconSize 設 null：Leaflet 不設寬高，交給 CSS（標籤長度不固定）。 */
const AUTO = null as unknown as L.PointExpression;
const MUSHROOM = `<svg width="20" height="20" viewBox="-10 -10 20 20"><path d="M-9 1 C-9 -6 -4 -9 0 -9 S9 -6 9 1 Z" fill="#C2410C"/><circle cx="-3" cy="-4" r="1.6" fill="#fff"/><circle cx="3.5" cy="-3" r="1.3" fill="#fff"/><rect x="-3" y="1" width="6" height="6" rx="1.5" fill="#E9DCC0"/></svg>`;
const sightingIcon = (label: string, expired: boolean) =>
  L.divIcon({ className: "", html: `<div class="spin ${expired ? "expired" : ""}"><span class="box">${MUSHROOM}</span><span class="label">${esc(label)}</span></div>`, iconSize: AUTO, iconAnchor: [15, 15] });
const historyIcon = (label: string) => L.divIcon({ className: "", html: `<div class="hdot"><span class="dot"></span><span class="label">${esc(label)}</span></div>`, iconSize: AUTO, iconAnchor: [7, 7] });
const CHECK_SVG = { found: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', missing: '<path d="M6 6l12 12M18 6L6 18"/>', unfinished: '<path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.6V14"/><circle cx="12" cy="18.5" r=".8" fill="currentColor"/>' } as const;
/** 美片菇結果：掛在 Waypoint 水滴右上角的答案圓章；沒有水滴（歷史）時置中在座標上。 */
const checkIcon = (kind: CheckMark["kind"], onPin: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="cmark ${kind}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${CHECK_SVG[kind]}</svg></div>`,
    iconSize: [19, 19],
    iconAnchor: onPin ? [-3.5, 46.5] : [9.5, 9.5],
  });

export function WaypointMap({
  waypoints,
  onMapClick,
  onMarkerEdit,
  draggable = false,
  onWaypointMove,
  pending = null,
  onPendingMove,
  sightings = [],
  areas = [],
  selectedAreaId,
  checkMarks = [],
  historyPoints = [],
  region = null,
  editor = null,
  boxEditor = null,
  centerRef,
  onAreaClick,
  anchor = null,
  now = Date.now(),
  children,
}: {
  waypoints: Waypoint[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerEdit?: (w: Waypoint) => void;
  /** true＝Waypoint 標記可拖曳，放開時 onWaypointMove 回報新位置。 */
  draggable?: boolean;
  onWaypointMove?: (w: Waypoint, lat: number, lng: number) => void;
  /** 還沒存檔的新增點（美片菇在填 Spot Name 時）：畫成可拖曳的虛線水滴。 */
  pending?: { lat: number; lng: number } | null;
  onPendingMove?: (lat: number, lng: number) => void;
  sightings?: StoredSighting[];
  areas?: SweepArea[];
  /** 點過的那一格加深色外框。 */
  selectedAreaId?: number | null;
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
  /** 浮在地圖上、跟著某個座標走的卡片（例如點格子後的原因卡）；卡片左緣對齊這個座標。 */
  anchor?: { lat: number; lng: number; content: ReactNode } | null;
  /** 判斷 Sighting 是否過期用的現在時間。 */
  now?: number;
  /** 疊在地圖上的其他浮動控制（顯示全部 Sighting、操作提示、Batch 抽屜）。 */
  children?: ReactNode;
}) {
  const [mapInst, setMapInst] = useState<L.Map | null>(null);
  useRegionEditorLayer(mapInst, editor);
  useSweepBoxLayer(mapInst, boxEditor);
  // 只在換清單時把地圖縮放到清單範圍；同一份清單新增、移動、改半徑不跳動。
  const fittedList = useRef<number | null>(null);
  const areaClickRef = useRef(onAreaClick);
  areaClickRef.current = onAreaClick;
  const regionLayer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef({ onMapClick, onMarkerEdit, onWaypointMove, onPendingMove });
  clickRef.current = { onMapClick, onMarkerEdit, onWaypointMove, onPendingMove };
  const pendingLayer = useRef<L.LayerGroup | null>(null);
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
    layer.current = L.layerGroup().addTo(m);
    checkLayer.current = L.layerGroup().addTo(m);
    sightingLayer.current = L.layerGroup().addTo(m);
    pendingLayer.current = L.layerGroup().addTo(m);
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
    waypoints.forEach((w, i) => {
      const tooltip = esc(w.label || `${w.lat}, ${w.lng}`);
      // 拖曳模式：放開才回報一次新位置；單擊（沒拖）仍是開編輯表單。
      const marker = L.marker([w.lat, w.lng], { icon: pinIcon(i + 1, draggable), draggable, autoPanOnFocus: false }).addTo(g);
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        clickRef.current.onMarkerEdit?.(w);
      });
      if (draggable)
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          clickRef.current.onWaypointMove?.(w, p.lat, p.lng);
        });
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -40] });
      pts.push([w.lat, w.lng]);
    });
    const listId = waypoints[0]?.listId ?? null;
    if (pts.length && listId !== fittedList.current) map.current!.fitBounds(L.latLngBounds(pts), { maxZoom: 16, padding: [40, 40] });
    fittedList.current = listId;
  }, [waypoints, draggable]);

  useEffect(() => {
    const g = pendingLayer.current!;
    g.clearLayers();
    if (!pending) return;
    const marker = L.marker([pending.lat, pending.lng], { icon: PENDING_PIN, draggable: true, zIndexOffset: 1000 }).addTo(g);
    marker.bindTooltip("新增中：填好 Spot Name 後儲存（可拖曳調整）", { permanent: true, direction: "top", offset: [0, -40] });
    marker.on("click", (e) => L.DomEvent.stopPropagation(e));
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      clickRef.current.onPendingMove?.(p.lat, p.lng);
    });
  }, [pending?.lat, pending?.lng]);

  useEffect(() => {
    const g = sightingLayer.current!;
    g.clearLayers();
    for (const s of sightings) {
      const m = sightingMarker(s, now);
      L.marker([s.lat, s.lng], { icon: sightingIcon(s.target, m.expired), zIndexOffset: 500 })
        .bindTooltip(esc(m.tooltip), { direction: "top", offset: [0, -16] })
        .addTo(g);
    }
  }, [sightings, now]);

  useEffect(() => {
    const g = historyLayer.current!;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    for (const p of historyPoints) {
      L.marker([p.lat, p.lng], { icon: historyIcon(p.label), interactive: false }).addTo(g);
      pts.push([p.lat, p.lng]);
    }
    if (pts.length) map.current!.fitBounds(L.latLngBounds(pts), { maxZoom: 16, padding: [40, 40] });
  }, [historyPoints]);

  const onPin = waypoints.length > 0;
  useEffect(() => {
    const g = checkLayer.current!;
    g.clearLayers();
    for (const c of checkMarks) {
      L.marker([c.lat, c.lng], { icon: checkIcon(c.kind, onPin), zIndexOffset: 800 })
        .bindTooltip(esc(c.tooltip))
        .addTo(g);
    }
  }, [checkMarks, onPin]);

  useEffect(() => {
    const g = areaLayer.current!;
    g.clearLayers();
    for (const a of areas) {
      const b = sweepAreaSquare(a, a.radius);
      const color = AREA_COLORS[a.color];
      const style = a.color === "preview" ? { color, fillColor: color, fillOpacity: 0.06, weight: 2, dashArray: "8 6" } : { color, fillColor: color, fillOpacity: 0.22, weight: 2.5 };
      const rect = L.rectangle([[b.south, b.west], [b.north, b.east]], style).addTo(g);
      if (a.tooltip) rect.bindTooltip(esc(a.tooltip));
      if (a.id !== undefined) {
        const id = a.id;
        rect.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          areaClickRef.current?.(id);
        });
      }
    }
    const sel = areas.find((a) => a.id !== undefined && a.id === selectedAreaId);
    if (sel) {
      const b = sweepAreaSquare(sel, sel.radius);
      L.rectangle([[b.south, b.west], [b.north, b.east]], { color: INK, weight: 4, fill: false, interactive: false }).addTo(g);
    }
  }, [areas, selectedAreaId]);

  useEffect(() => {
    const g = regionLayer.current!;
    g.clearLayers();
    if (region) L.rectangle([[region.south, region.west], [region.north, region.east]], { color: INK, weight: 2, opacity: 0.6, fill: false, dashArray: "2 6", interactive: false }).addTo(g);
  }, [region]);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" />
      <CoordinateSearch map={mapInst} />
      {anchor && <MapAnchor map={mapInst} lat={anchor.lat} lng={anchor.lng}>{anchor.content}</MapAnchor>}
      {children}
    </div>
  );
}

/** 跟著地圖座標走的浮動卡片：地圖平移、縮放時重算位置。 */
function MapAnchor({ map, lat, lng, children }: { map: L.Map | null; lat: number; lng: number; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const update = () => setPos(map.latLngToContainerPoint([lat, lng]));
    update();
    map.on("move zoom viewreset resize", update);
    return () => void map.off("move zoom viewreset resize", update);
  }, [map, lat, lng]);
  if (!pos || !map) return null;
  // 卡片寬 270 px：太靠右就貼著地圖右緣，不要超出畫面。
  const maxLeft = map.getSize().x - 290;
  return (
    <div className="map-anchor" style={{ left: Math.max(8, Math.min(pos.x + 12, maxLeft)), top: pos.y }}>
      {children}
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
    pin.current = L.circleMarker([r.lat, r.lng], { radius: 9, color: "#C92A2A", fillColor: "#FA5252", fillOpacity: 0.9, weight: 3 })
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
          aria-label="座標"
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
          <button type="button" className="clear" title="清除" aria-label="清除" onClick={reset}>
            {icons.cross}
          </button>
        )}
        <button type="submit" className="go" title="移到這個座標" aria-label="移到這個座標">
          {icons.search}
        </button>
      </form>
      {error && <div className="errors">{error}</div>}
    </div>
  );
}
