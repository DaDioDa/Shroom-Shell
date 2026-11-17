import { useEffect, useRef, useState } from "react";
import { CONFIRM_WINDOW_MS, pressConfirm, type Armed } from "@shell/shared";
import { icons } from "./ui.js";

/**
 * 二次確認的刪除鈕：第一次按變成紅底「確定刪除？」，再按一次才執行；點別處或過幾秒就取消。
 * icon：平常是垃圾桶圖示（Waypoint 列、歷史卡片），否則是「刪除」文字鈕。
 */
export function ConfirmButton({ id, label = "刪除", icon, disabled, title, onConfirm }: { id: string; label?: string; icon?: boolean; disabled?: boolean; title?: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState<Armed | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), CONFIRM_WINDOW_MS);
    const away = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setArmed(null);
    };
    document.addEventListener("pointerdown", away);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", away);
    };
  }, [armed]);
  const press = () => {
    const r = pressConfirm(armed, id, Date.now());
    setArmed(r.armed);
    if (r.confirmed) onConfirm();
  };
  const cls = armed ? "btn small danger solid" : icon ? "btn icon" : "btn small danger";
  return (
    <button ref={ref} type="button" disabled={disabled} title={title ?? label} aria-label={label} className={cls} onClick={press}>
      {armed ? "確定刪除？" : icon ? icons.trash : label}
    </button>
  );
}
