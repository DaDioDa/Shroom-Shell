import L from "leaflet";
import { useEffect, useRef } from "react";
import { moveBox, radiusFromCorner, sweepAreaSquare, sweepBoxCorners, type BoxCorner, type LatLng } from "@shell/shared";

/** 一個可編輯的 2R 框：以 Waypoint 為中心。 */
export interface SweepBox {
  id: number;
  lat: number;
  lng: number;
  radius: number;
}

export interface SweepBoxEditorState {
  boxes: SweepBox[];
  /** 放開滑鼠才回報一次：拖本體＝移動，拖角＝改半徑。 */
  onCommit: (id: number, patch: { lat: number; lng: number } | { radius: number }) => void;
  /** 在框裡單擊（沒拖動）＝照常在地圖上新增。 */
  onClick: (lat: number, lng: number) => void;
}

const COLOR = "#1971C2";
const CORNERS: BoxCorner[] = ["nw", "ne", "se", "sw"];
/** 滑鼠移動少於這個像素就當成單擊。 */
const CLICK_TOLERANCE_PX = 4;

const bounds = (c: LatLng, r: number): L.LatLngBoundsExpression => {
  const b = sweepAreaSquare(c, r);
  return [[b.south, b.west], [b.north, b.east]];
};
const sizeIcon = (r: number) => L.divIcon({ className: "", html: `<span class="region-size box">R ${r} m</span>`, iconSize: [0, 0] });

/**
 * 無人巨菇「在地圖上新增」模式：每個 Waypoint 的 2R 框可拖本體移動、拖四角縮放。
 * 拖曳中只更新地圖上的框與把手，放開才 onCommit；框清單變了（存檔後）才重建。
 */
export function useSweepBoxLayer(map: L.Map | null, state: SweepBoxEditorState | null) {
  const cur = useRef(state);
  cur.current = state;
  const key = state ? JSON.stringify(state.boxes) : null;

  useEffect(() => {
    if (!map || !cur.current) return;
    const layers: L.Layer[] = [];
    const add = <T extends L.Layer>(l: T) => (layers.push(l.addTo(map)), l);

    for (const box of cur.current.boxes) {
      let center: LatLng = { lat: box.lat, lng: box.lng };
      let radius = box.radius;
      const frame = add(L.rectangle(bounds(center, radius), { color: COLOR, weight: 2, dashArray: "6 4", fillOpacity: 0.08 }));
      frame.bringToBack(); // Waypoint 標記留在上面，點標記仍是編輯

      const label = add(L.marker([sweepAreaSquare(center, radius).north, center.lng], { interactive: false, icon: sizeIcon(radius) }));
      const handles = {} as Record<BoxCorner, L.Marker>;
      const redraw = (except?: BoxCorner) => {
        frame.setBounds(bounds(center, radius));
        label.setLatLng([sweepAreaSquare(center, radius).north, center.lng]);
        label.setIcon(sizeIcon(radius));
        const pos = sweepBoxCorners(center, radius);
        for (const k of CORNERS) if (k !== except) handles[k].setLatLng([pos[k].lat, pos[k].lng]);
      };

      // 拖本體移動；沒拖動就當單擊（照常新增）。
      (frame.getElement() as HTMLElement | undefined)?.style.setProperty("cursor", "move");
      frame.on("click", (e: L.LeafletMouseEvent) => L.DomEvent.stopPropagation(e));
      frame.on("mousedown", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stop(e);
        const start = e.latlng;
        const startPx = e.containerPoint;
        const base = center;
        let moved = false;
        map.dragging.disable();
        const move = (ev: L.LeafletMouseEvent) => {
          if (!moved && ev.containerPoint.distanceTo(startPx) < CLICK_TOLERANCE_PX) return;
          moved = true;
          center = moveBox(base, start, ev.latlng);
          redraw();
        };
        const up = () => {
          map.off("mousemove", move);
          document.removeEventListener("mouseup", up);
          map.dragging.enable();
          if (moved) cur.current?.onCommit(box.id, { lat: center.lat, lng: center.lng });
          else cur.current?.onClick(start.lat, start.lng);
        };
        map.on("mousemove", move);
        document.addEventListener("mouseup", up);
      });

      // 四角縮放：維持以 Waypoint 為中心的正方形。
      const pos = sweepBoxCorners(center, radius);
      for (const k of CORNERS) {
        const m = add(L.marker([pos[k].lat, pos[k].lng], { draggable: true, autoPanOnFocus: false, icon: L.divIcon({ className: `region-handle box ${k}`, iconSize: [12, 12] }), zIndexOffset: 1000 }));
        m.on("drag", (ev) => {
          radius = radiusFromCorner(center, (ev as L.LeafletMouseEvent).latlng);
          redraw(k);
        });
        m.on("dragend", () => {
          redraw();
          if (radius !== box.radius) cur.current?.onCommit(box.id, { radius });
        });
        handles[k] = m;
      }
    }
    return () => {
      for (const l of layers) l.remove();
    };
  }, [map, key]);
}
