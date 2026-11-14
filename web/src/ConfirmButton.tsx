import { useEffect, useRef, useState } from "react";
import { CONFIRM_WINDOW_MS, pressConfirm, type Armed } from "@shell/shared";

/** 二次確認的刪除鈕：第一次按顯示「確定刪除？」，再按一次才執行；點別處或過幾秒就取消。 */
export function ConfirmButton({ id, label = "刪除", disabled, title, onConfirm }: { id: string; label?: string; disabled?: boolean; title?: string; onConfirm: () => void }) {
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
  return (
    <button ref={ref} disabled={disabled} title={title} className={armed ? "danger" : ""} onClick={press}>
      {armed ? "確定刪除？" : label}
    </button>
  );
}
