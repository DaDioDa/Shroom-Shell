import { useState } from "react";
import { validateWaypointForm, type ListFeature } from "@shell/shared";
import { Field } from "./ui.js";

export interface WaypointFormInitial {
  label: string;
  radius: number | null;
  spotName: string | null;
}

/**
 * 畫面內的 Waypoint 表單：欄位依功能決定，一次儲存，錯誤顯示在欄位下。新增（美片菇要 Spot Name）與編輯共用。
 * 嵌在清單裡正在編輯的那一列下面；新增時接在清單最後。
 */
export function WaypointForm({
  feature,
  title,
  initial,
  onSubmit,
  onCancel,
}: {
  feature: ListFeature;
  title: string;
  initial: WaypointFormInitial;
  /** 回傳 patch；丟出的錯誤（例如後端 400 的原因）會顯示在表單裡。 */
  onSubmit: (patch: { label: string; radius?: number | null; spotName?: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [radiusText, setRadiusText] = useState(initial.radius?.toString() ?? "");
  const [spotName, setSpotName] = useState(initial.spotName ?? "");
  const [errors, setErrors] = useState<{ radius?: string; spotName?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);
  const postcard = feature === "postcard-check";

  const save = async () => {
    const r = validateWaypointForm(feature, { label, radiusText, spotName });
    if (!r.ok) return setErrors(r.errors);
    setErrors({});
    setSaving(true);
    try {
      await onSubmit(r.patch);
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : String(e) });
      setSaving(false);
    }
  };

  return (
    <form
      className="wpform"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="wpform-title">{title}</div>
      <Field label="標籤">
        <input className="input" value={label} placeholder="可留空，地圖與清單會顯示座標" autoFocus={!postcard} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      {postcard ? (
        <Field label="Spot Name" req err={errors.spotName}>
          <input className={`input ${errors.spotName ? "invalid" : ""}`} value={spotName} placeholder="遊戲裡這個地點的名稱" autoFocus onChange={(e) => setSpotName(e.target.value)} />
        </Field>
      ) : (
        <Field label="半徑" hint="公尺；留空＝用預設半徑" err={errors.radius}>
          <input className={`input ${errors.radius ? "invalid" : ""}`} value={radiusText} inputMode="decimal" placeholder="例如 300" onChange={(e) => setRadiusText(e.target.value)} />
        </Field>
      )}
      {errors.form && <span className="err">{errors.form}</span>}
      <div className="line">
        <button type="submit" className="btn small primary" disabled={saving}>
          儲存
        </button>
        <button type="button" className="btn small" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
