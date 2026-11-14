import { useState } from "react";
import { validateWaypointForm, type ListFeature } from "@shell/shared";

export interface WaypointFormInitial {
  label: string;
  radius: number | null;
  spotName: string | null;
}

/** 畫面內的 Waypoint 表單：欄位依功能決定，一次儲存，錯誤顯示在欄位旁。新增（美片菇要 Spot Name）與編輯共用。 */
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
  /** 回傳 patch；丟出的錯誤（例如後端 400 的原因）會顯示在表單旁。 */
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
      <h4>{title}</h4>
      <label>
        標籤 <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      {postcard ? (
        <label>
          Spot Name（必填） <input value={spotName} onChange={(e) => setSpotName(e.target.value)} />
          {errors.spotName && <span className="errors"> {errors.spotName}</span>}
        </label>
      ) : (
        <label>
          半徑（公尺，留空＝未設定） <input value={radiusText} inputMode="decimal" onChange={(e) => setRadiusText(e.target.value)} />
          {errors.radius && <span className="errors"> {errors.radius}</span>}
        </label>
      )}
      {errors.form && <div className="errors">{errors.form}</div>}
      <button type="submit" disabled={saving}>儲存</button> <button type="button" onClick={onCancel}>取消</button>
    </form>
  );
}
