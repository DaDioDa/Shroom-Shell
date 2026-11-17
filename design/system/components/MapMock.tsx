import type { ReactNode } from "react";
import { osm, preview, verdict, type Verdict } from "../theme.js";

export const MAP_W = 940;
export const MAP_H = 800;

export interface MapWaypoint {
  n: number;
  x: number;
  y: number;
  /** 有結果就畫實線方格；沒有就畫 2R 預覽虛線框。 */
  result?: Verdict;
  /** 2R 正方形的半邊長（px）；不給用預設半徑的大小。 */
  half?: number;
}

/** 2R 正方形：有答案是實線填色，沒有答案是藍色虛線預覽。 */
export function SweepSquare({ x, y, half = 72, result }: { x: number; y: number; half?: number; result?: Verdict }) {
  const r = result ? verdict[result] : null;
  return r ? (
    <rect x={x - half} y={y - half} width={half * 2} height={half * 2} fill={r.fill} fillOpacity=".22" stroke={r.fill} strokeWidth="2.5" />
  ) : (
    <rect x={x - half} y={y - half} width={half * 2} height={half * 2} fill={preview.stroke} fillOpacity=".06" stroke={preview.stroke} strokeWidth="2" strokeDasharray="8 6" />
  );
}

/** Waypoint 標記：主題色水滴，寫清單裡的編號；尖端就是座標。 */
export function MapPin({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 C-4 -8 -14 -12 -14 -24 A14 14 0 1 1 14 -24 C14 -12 4 -8 0 0Z" fill="var(--marker)" stroke="#fff" strokeWidth="2.5" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.3))" }} />
      <text x="0" y="-19" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="var(--font-brand)">
        {n}
      </text>
    </g>
  );
}

/** Sighting 標記：白底圓角方塊裡一顆蘑菇，旁邊標 Target 名稱。過期的半透明。 */
export function SightingPin({ x, y, label, expired }: { x: number; y: number; label: string; expired?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={expired ? 0.5 : 1}>
      <rect x="-15" y="-15" width="30" height="30" rx="9" fill="#fff" stroke="var(--primary)" strokeWidth="2" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,.25))" }} />
      <path d="M-9 1 C-9 -6 -4 -9 0 -9 S9 -6 9 1 Z" fill="#C2410C" />
      <circle cx="-3" cy="-4" r="1.6" fill="#fff" />
      <circle cx="3.5" cy="-3" r="1.3" fill="#fff" />
      <rect x="-3" y="1" width="6" height="6" rx="1.5" fill="#E9DCC0" />
      <rect x="20" y="-12" width={label.length * 12 + 16} height="24" rx="12" fill="#fff" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.2))" }} />
      <text x="28" y="5" fontSize="12" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-body)">
        {label}
      </text>
    </g>
  );
}

/** 新增模式的 2R 框：藍色虛線預覽加四角把手（拖框移動、拖角改半徑）。 */
export function EditBox({ x, y, half = 72 }: { x: number; y: number; half?: number }) {
  const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  return (
    <g>
      <SweepSquare x={x} y={y} half={half} />
      {c.map(([dx, dy]) => (
        <rect key={`${dx}${dy}`} x={x + dx * half - 6} y={y + dy * half - 6} width="12" height="12" rx="3" fill="#fff" stroke={preview.stroke} strokeWidth="2.5" />
      ))}
    </g>
  );
}

/** 還沒存的新點（美片菇新增時先標在地圖上，可拖）：白底虛線水滴。 */
export function PendingPin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 C-4 -8 -14 -12 -14 -24 A14 14 0 1 1 14 -24 C14 -12 4 -8 0 0Z" fill="#fff" stroke="var(--marker)" strokeWidth="2.5" strokeDasharray="5 3" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.3))" }} />
      <path d="M0 -30 V-18 M-6 -24 H6" stroke="var(--marker)" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  );
}

const MARK: Record<Verdict, ReactNode> = {
  yes: <path d="M-4 0.5 L-1.2 3.3 L4.2 -2.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  no: <path d="M-3.3 -3.3 L3.3 3.3 M3.3 -3.3 L-3.3 3.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />,
  unknown: (
    <text y="4.2" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="var(--font-brand)">
      ?
    </text>
  ),
};

/** 美片菇的結果：Waypoint 水滴右上角掛一顆答案圓章（找到／沒找到／沒讀完），有圖示不只靠顏色。 */
export function CheckPin({ x, y, n, v }: { x: number; y: number; n: number; v: Verdict }) {
  return (
    <g>
      <MapPin x={x} y={y} n={n} />
      <g transform={`translate(${x + 13} ${y - 37})`}>
        <circle r="9.5" fill={verdict[v].fill} stroke="#fff" strokeWidth="2" />
        {MARK[v]}
      </g>
    </g>
  );
}

/** 歷史 Batch 當時走過的點：深色空心圓＋標籤，和清單的 Waypoint 水滴分得開。 */
export function HistoryDot({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="7" fill="#fff" stroke="var(--ink)" strokeWidth="3.5" />
      <rect x="12" y="-10" width={label.length * 11 + 12} height="20" rx="10" fill="rgba(255,255,255,.92)" />
      <text x="18" y="4" fontSize="11" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-body)">
        {label}
      </text>
    </g>
  );
}

/**
 * 探索區域的 Region：cols × rows 個格子。
 * editing：主色外框＋8 個把手，格子是藍色虛線預覽；否則每格依 results 填答案色，selected 那格加深色外框。
 */
export function RegionGrid({ x, y, cols, rows, cell = 64, editing, results, selected, bad }: { x: number; y: number; cols: number; rows: number; cell?: number; editing?: boolean; results?: Verdict[]; selected?: number; bad?: boolean }) {
  const w = cols * cell, h = rows * cell;
  const cells = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push({ i, j, k: j * cols + i });
  const handles = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
  const edge = bad ? "var(--danger)" : "var(--primary)";
  return (
    <g>
      {editing ? (
        <>
          {/* 編輯中：淡藍底、藍色虛線分格、每格中心一點（bot 會去的位置）。 */}
          <rect x={x} y={y} width={w} height={h} fill={preview.stroke} fillOpacity=".08" />
          <g stroke={preview.stroke} strokeWidth="1.5" strokeDasharray="6 5">
            {Array.from({ length: cols - 1 }, (_, i) => <line key={`v${i}`} x1={x + (i + 1) * cell} y1={y} x2={x + (i + 1) * cell} y2={y + h} />)}
            {Array.from({ length: rows - 1 }, (_, j) => <line key={`h${j}`} x1={x} y1={y + (j + 1) * cell} x2={x + w} y2={y + (j + 1) * cell} />)}
          </g>
          {cells.map(({ i, j, k }) => <circle key={k} cx={x + i * cell + cell / 2} cy={y + j * cell + cell / 2} r="3" fill={preview.stroke} />)}
        </>
      ) : (
        cells.map(({ i, j, k }) => <SweepSquare key={k} x={x + i * cell + cell / 2} y={y + j * cell + cell / 2} half={cell / 2} result={results?.[k]} />)
      )}
      {editing && (
        <>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={edge} strokeWidth="3" />
          {handles.map(([hx, hy]) => (
            <circle key={`${hx}${hy}`} cx={x + hx * w} cy={y + hy * h} r="7" fill="#fff" stroke={edge} strokeWidth="3" />
          ))}
        </>
      )}
      {!editing && <rect x={x} y={y} width={w} height={h} fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="2 4" opacity=".6" />}
      {selected !== undefined && (
        <rect x={x + (selected % cols) * cell - 2} y={y + Math.floor(selected / cols) * cell - 2} width={cell + 4} height={cell + 4} fill="none" stroke="var(--ink)" strokeWidth="4" />
      )}
    </g>
  );
}

/** 一小塊空白底圖，用來單獨展示某個地圖圖層。 */
export function MapSnippet({ w = 220, h = 170, children }: { w?: number; h?: number; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block" }}>
      <rect width={w} height={h} fill={osm.land} />
      <line x1="0" y1={h * 0.72} x2={w} y2={h * 0.72} stroke={osm.roadEdge} strokeWidth="12" />
      <line x1="0" y1={h * 0.72} x2={w} y2={h * 0.72} stroke={osm.road} strokeWidth="9" />
      <line x1={w * 0.2} y1="0" x2={w * 0.2} y2={h} stroke={osm.roadEdge} strokeWidth="12" />
      <line x1={w * 0.2} y1="0" x2={w * 0.2} y2={h} stroke={osm.road} strokeWidth="9" />
      {children}
    </svg>
  );
}

/** OSM 風格的示意底圖（不是真的圖磚）＋ App 自己畫的圖層。 */
export function MapMock({ waypoints = [], sighting, children }: { waypoints?: MapWaypoint[]; sighting?: { x: number; y: number; label: string }; children?: ReactNode }) {
  const vx = [0, 120, 250, 380, 520, 650, 790, 940];
  const hy = [0, 110, 230, 350, 470, 600, 720, 800];
  const blocks = [];
  for (let i = 0; i < vx.length - 1; i++) {
    for (let j = 0; j < hy.length - 1; j++) {
      const x0 = vx[i] + 14, y0 = hy[j] + 14, w = vx[i + 1] - vx[i] - 28, h = hy[j + 1] - hy[j] - 28;
      if ((i * 7 + j * 3) % 5 === 0) continue;
      for (let k = 0; k < 3; k++) {
        const bw = w / 3 - 8;
        blocks.push(<rect key={`${i}-${j}-${k}`} x={x0 + k * (w / 3) + 2} y={y0 + ((i + j + k) % 2) * 10} width={bw} height={h - 20 - ((i + k) % 3) * 8} fill={osm.building} />);
      }
    }
  }
  return (
    <svg className="map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
      <rect width={MAP_W} height={MAP_H} fill={osm.land} />
      <path d="M520 470 H790 V720 H600 Q540 640 520 600 Z" fill={osm.park} />
      <path d="M0 640 C140 600 200 720 340 700 S520 780 600 800 H0 Z" fill={osm.water} />
      {blocks}
      <g stroke={osm.roadEdge} strokeWidth="14" fill="none">
        {vx.slice(1, -1).map((x) => <line key={x} x1={x} y1="0" x2={x} y2={MAP_H} />)}
        {hy.slice(1, -1).map((y) => <line key={y} x1="0" y1={y} x2={MAP_W} y2={y} />)}
      </g>
      <g stroke={osm.road} strokeWidth="11" fill="none">
        {vx.slice(1, -1).map((x) => <line key={x} x1={x} y1="0" x2={x} y2={MAP_H} />)}
        {hy.slice(1, -1).map((y) => <line key={y} x1="0" y1={y} x2={MAP_W} y2={y} />)}
      </g>
      <path d="M0 520 L940 140" stroke={osm.majorEdge} strokeWidth="20" />
      <path d="M0 520 L940 140" stroke={osm.major} strokeWidth="16" />
      {waypoints.map((w) => <SweepSquare key={`a${w.n}`} x={w.x} y={w.y} half={w.half} result={w.result} />)}
      {waypoints.map((w) => <MapPin key={`m${w.n}`} x={w.x} y={w.y} n={w.n} />)}
      {sighting && <SightingPin {...sighting} />}
      {children}
    </svg>
  );
}
