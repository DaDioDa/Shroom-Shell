import { useEffect, useState } from "react";
import { clampSlider, type SliderSpec } from "@shell/shared";

interface Props {
  label: string;
  spec: SliderSpec;
  value: number;
  unit?: string;
  /** 標籤右邊的補充說明。 */
  note?: string;
  disabled?: boolean;
  /** 想換掉數字框時用，例如 0 顯示「不略過」、連動時顯示「連動中 1000 m」。 */
  valueText?: (v: number) => string | null;
  onChange: (v: number) => void;
}

/** slider 加數字框；數字框打超出範圍的值，按 Enter 或離開時夾回範圍。 */
export function Slider({ label, spec, value, unit, note, disabled, valueText, onChange }: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = clampSlider(spec, text);
    // 打的不是數字時 clampSlider 回預設值；這時保留原值比較不意外
    const next = text.trim() === "" || !Number.isFinite(Number(text)) ? value : v;
    onChange(next);
    setText(String(next));
  };
  const shown = valueText?.(value);
  return (
    <div className="slider">
      <div className="top">
        <span className="field-label">{label}</span>
        {note && <span className="muted">{note}</span>}
      </div>
      <div className="bottom">
        <input type="range" aria-label={label} min={spec.min} max={spec.max} step={spec.step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
        {shown ? (
          <span className="numbox text">{shown}</span>
        ) : (
          <>
            <input
              className="input numbox num"
              type="number"
              aria-label={`${label}數值`}
              value={text}
              disabled={disabled}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
            {unit && <span className="muted">{unit}</span>}
          </>
        )}
      </div>
    </div>
  );
}
