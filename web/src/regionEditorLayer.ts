import L from "leaflet";
import { useEffect, useRef } from "react";
import {
  dragCorner, dragEdge, gridStats, regionCenter, regionCorners, regionEdges, regionSizeM, shiftRegion, sweepAreaSquare,
  type Corner, type Edge, type LatLng, type Region,
} from "@shell/shared";

export interface RegionEditorState {
  region: Region;
  spacingM: number;
  radiusM: number;
  /** 超過 10 km：框與標籤變紅（仍可拖）。 */
  bad: boolean;
  onChange: (r: Region) => void;
}

type HandleKey = Corner | Edge;
/** 外框與把手：主色；太大時紅色。格子預覽：和 2R 預覽同一個藍色。（design/pages/00 的「Region：編輯中」） */
const OK = "#12874F";
const BAD = "#C92A2A";
const CELL = "#1971C2";
const km = (m: number) => (m / 1000).toFixed(1);

const handlePositions = (r: Region): Record<HandleKey, LatLng> => ({ ...regionCorners(r), ...regionEdges(r) });

/**
 * Region 編輯器的地圖圖層：外框＋寬高標籤、8 個把手、拖本體平移、格子預覽（canvas）。
 * 傳 null 就全部移除（沒有 Region，或 Discovery 排隊、執行中鎖定）。
 * 拖曳中把手不重建：最新的 callback 放 ref，拖曳中的把手不重設位置。
 */
export function useRegionEditorLayer(map: L.Map | null, state: RegionEditorState | null) {
  const cur = useRef(state);
  cur.current = state;
  const active = state !== null;
  const rect = useRef<L.Rectangle | null>(null);
  const label = useRef<L.Marker | null>(null);
  const markers = useRef<Partial<Record<HandleKey, L.Marker>>>({});
  const dragging = useRef<HandleKey | null>(null);
  const preview = useRef<L.LayerGroup | null>(null);
  const renderer = useRef<L.Canvas | null>(null);

  // 建立／移除圖層：只在有沒有 Region 切換時做，不隨 Region 改變重建。
  useEffect(() => {
    if (!map || !active) return;
    const r0 = cur.current!.region;
    renderer.current = L.canvas({ padding: 0.5 });
    preview.current = L.layerGroup().addTo(map);
    const frame = L.rectangle([[r0.south, r0.west], [r0.north, r0.east]], { color: OK, weight: 3, fillColor: CELL, fillOpacity: 0.04 }).addTo(map);
    rect.current = frame;
    label.current = L.marker([r0.north, regionCenter(r0).lng], { interactive: false, icon: L.divIcon({ className: "", html: "", iconSize: [0, 0] }) }).addTo(map);

    // 拖本體平移
    (frame.getElement() as HTMLElement | undefined)?.style.setProperty("cursor", "move");
    frame.on("mousedown", (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e);
      const start = e.latlng;
      const base = cur.current!.region;
      map.dragging.disable();
      const move = (ev: L.LeafletMouseEvent) => cur.current?.onChange(shiftRegion(base, ev.latlng.lat - start.lat, ev.latlng.lng - start.lng));
      const up = () => {
        map.off("mousemove", move);
        document.removeEventListener("mouseup", up);
        map.dragging.enable();
      };
      map.on("mousemove", move);
      document.addEventListener("mouseup", up);
    });

    // 8 個把手
    const pos = handlePositions(r0);
    for (const k of Object.keys(pos) as HandleKey[]) {
      const m = L.marker(pos[k], { draggable: true, icon: L.divIcon({ className: `region-handle ${k}`, iconSize: [14, 14] }), zIndexOffset: 1000 }).addTo(map);
      let base: Region | null = null;
      m.on("dragstart", () => {
        base = cur.current!.region;
        dragging.current = k;
      });
      m.on("drag", (e) => {
        const s = cur.current;
        if (!s || !base) return;
        const p = (e as L.LeafletMouseEvent).latlng;
        s.onChange(k.length === 2 ? dragCorner(base, k as Corner, p, s.spacingM) : dragEdge(base, k as Edge, p, s.spacingM));
      });
      m.on("dragend", () => {
        dragging.current = null;
        if (cur.current) m.setLatLng(handlePositions(cur.current.region)[k]); // 對齊後把手吸到新位置
      });
      markers.current[k] = m;
    }
    return () => {
      frame.remove();
      label.current?.remove();
      preview.current?.remove();
      for (const m of Object.values(markers.current) as L.Marker[]) m.remove();
      rect.current = label.current = preview.current = null;
      markers.current = {};
    };
  }, [map, active]);

  // Region 改變：更新外框、標籤、把手位置（拖曳中的那個除外）與格子預覽。
  useEffect(() => {
    if (!map || !state || !rect.current || !label.current || !preview.current) return;
    const { region: r, spacingM, radiusM, bad } = state;
    const color = bad ? BAD : OK;
    rect.current.setBounds([[r.south, r.west], [r.north, r.east]]);
    rect.current.setStyle({ color });
    const { w, h } = regionSizeM(r);
    label.current.setLatLng([r.north, regionCenter(r).lng]);
    label.current.setIcon(L.divIcon({ className: "", html: `<span class="region-size${bad ? " bad" : ""}">${km(w)} km × ${km(h)} km</span>`, iconSize: [0, 0] }));
    const pos = handlePositions(r);
    for (const k of Object.keys(markers.current) as HandleKey[]) {
      const m = markers.current[k]!;
      if (k !== dragging.current) m.setLatLng(pos[k]);
      m.getElement()?.classList.toggle("bad", !!bad);
    }

    const g = preview.current;
    g.clearLayers();
    const opts = { renderer: renderer.current!, interactive: false };
    const pts = gridStats(r, spacingM, radiusM).points;
    const cell = bad ? BAD : CELL;
    // 點太多（Region 很大、間距很小）時只畫路線，避免卡住。
    const detail = pts.length <= 2500;
    for (const p of detail ? pts : []) {
      const b = sweepAreaSquare(p, radiusM);
      L.rectangle([[b.south, b.west], [b.north, b.east]], { ...opts, color: cell, weight: 1.2, opacity: 0.7, dashArray: "6 5", fillOpacity: 0.05 }).addTo(g);
      L.circleMarker([p.lat, p.lng], { ...opts, radius: 2.5, color: cell, weight: 1, fillOpacity: 0.9 }).addTo(g);
    }
    if (pts.length > 1) L.polyline(pts.map((p) => [p.lat, p.lng] as [number, number]), { ...opts, color: "#f08c00", weight: 2, opacity: 0.8 }).addTo(g);
    if (pts.length > 0) L.marker([pts[0]!.lat, pts[0]!.lng], { interactive: false, icon: L.divIcon({ className: "", html: '<span class="region-start">起點</span>', iconSize: [0, 0] }) }).addTo(g);
  }, [map, state?.region, state?.spacingM, state?.radiusM, state?.bad, active]); // eslint-disable-line react-hooks/exhaustive-deps
}
