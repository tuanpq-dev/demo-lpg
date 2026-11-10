/** Gắn tag dữ liệu trực tiếp + ngưỡng, và cấu hình marker của object. */
import { Checkbox, Combobox, FormField, NumberField, Select, type ComboOption } from '@/components';
import { SENSOR_TAGS } from '@/data/scene';
import { ASSET_SPECS } from '@/features/scene/assets/specs';
import { FIELD_META } from '@/features/scene/fields';
import type { Binding, SceneObject, SceneObjectMarker, Thresholds } from '@/features/scene/types';
import { CommitTextField, Section, type Update } from './PropertyFields';

const THRESHOLD_KEYS: { key: keyof Thresholds; label: string }[] = [
  { key: 'warn', label: 'Cảnh báo ≥' },
  { key: 'danger', label: 'Nguy hiểm ≥' },
  { key: 'lowWarn', label: 'Cảnh báo ≤' },
  { key: 'lowDanger', label: 'Nguy hiểm ≤' },
];

/** 4 ô ngưỡng (trống = không đặt). */
export function ThresholdsFields({ label, value, onChange }: { label: string; value: Thresholds; onChange: (t: Thresholds) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {THRESHOLD_KEYS.map(({ key, label: l }) => (
        <NumberField
          key={key}
          label={`${label} – ${l}`}
          hideLabel
          size="sm"
          prefix={key.startsWith('low') ? '≤' : '≥'}
          placeholder={l.replace(/ [≥≤]$/, '')}
          step={0.5}
          value={value[key]}
          onChange={(v) => onChange({ ...value, [key]: v })}
          onClear={() => {
            const { [key]: _drop, ...rest } = value;
            void _drop;
            onChange(rest);
          }}
        />
      ))}
    </div>
  );
}

const tagOf = (b?: Binding) => (b === undefined ? null : typeof b === 'string' ? b : b.tag);
const thresholdsOf = (b?: Binding): Thresholds => {
  if (!b || typeof b === 'string') return {};
  const { tag: _t, ...rest } = b;
  void _t;
  return rest;
};

/** Binding theo `dataFields` của asset: tag cảm biến (từ danh sách tag) + ngưỡng riêng tuỳ chọn. */
export function BindingsEditor({ obj, update }: { obj: SceneObject; update: Update }) {
  const fields = ASSET_SPECS[obj.asset].dataFields;
  const options: ComboOption[] = SENSOR_TAGS.map((t) => ({ value: t, label: t }));
  const set = (field: string, tag: string | null, thr: Thresholds) =>
    update((o) => {
      const bindings = { ...o.bindings };
      if (!tag) delete bindings[field];
      else bindings[field] = Object.keys(thr).length ? { tag, ...thr } : tag;
      const marker = o.marker?.field === field && !tag ? { ...o.marker, field: undefined } : o.marker;
      return { ...o, bindings, ...(marker ? { marker } : {}) };
    });
  return (
    <Section title="Bindings (tag cảm biến)">
      {fields.map((field) => {
        const b = obj.bindings?.[field];
        const tag = tagOf(b);
        const thr = thresholdsOf(b);
        const meta = FIELD_META[field];
        const own = typeof b === 'object';
        const opts = tag && !SENSOR_TAGS.includes(tag) ? [{ value: tag, label: tag, meta: 'không có trong danh sách' }, ...options] : options;
        return (
          <div key={field} className="flex flex-col gap-1.5 rounded-md border border-line/30 p-2">
            <FormField label={`${meta?.label ?? field}${meta?.unit ? ` (${meta.unit})` : ''} · ${field}`}>
              {({ id, labelId }) => (
                <Combobox
                  id={id}
                  labelledBy={labelId}
                  placeholder="Chọn tag…"
                  options={opts}
                  value={tag}
                  clearable
                  onChange={(v) => set(field, v, thr)}
                />
              )}
            </FormField>
            {tag && !meta?.states && (
              <Checkbox
                showLabel
                label="Ngưỡng riêng (ghi đè ngưỡng của cảnh)"
                checked={own}
                onChange={(c) => update((o) => ({ ...o, bindings: { ...o.bindings, [field]: c ? { tag } : tag } }))}
              />
            )}
            {tag && own && <ThresholdsFields label={field} value={thr} onChange={(t) => set(field, tag, t)} />}
          </div>
        );
      })}
    </Section>
  );
}

const MARKER_VARIANTS = [
  { value: 'callout', label: 'Callout (chốt dọc)' },
  { value: 'side', label: 'Side (đường nối ngang)' },
  { value: 'tag', label: 'Tag (nhãn chữ)' },
] as const;
const MARKER_TONES = [
  { value: 'accent', label: 'Accent (xanh)' },
  { value: 'success', label: 'Success (kèm chấm)' },
  { value: 'warning', label: 'Warning (vàng)' },
] as const;

/** Nhãn trên bản đồ (object.marker): bật/tắt, kiểu, tone, tiêu đề, trường giá trị. */
export function MarkerEditor({ obj, update }: { obj: SceneObject; update: Update }) {
  const m = obj.marker;
  const setM = (patch: Partial<SceneObjectMarker>) =>
    update((o) => {
      const next: SceneObjectMarker = { ...o.marker, ...patch };
      (Object.keys(next) as (keyof SceneObjectMarker)[]).forEach((k) => next[k] === undefined && delete next[k]);
      return { ...o, marker: next };
    });
  const fields = Object.keys(obj.bindings ?? {});
  return (
    <Section title="Nhãn trên bản đồ">
      <Checkbox
        showLabel
        label="Hiện nhãn"
        checked={!!m}
        onChange={(on) =>
          update((o) => {
            if (on) return { ...o, marker: {} };
            const { marker: _drop, ...rest } = o;
            void _drop;
            return rest;
          })
        }
      />
      {m && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Kiểu">
              {({ id, labelId }) => (
                <Select
                  variant="field"
                  id={id}
                  labelledBy={labelId}
                  label="Kiểu nhãn"
                  options={MARKER_VARIANTS}
                  value={m.variant ?? 'callout'}
                  onChange={(v) => setM({ variant: v === 'callout' ? undefined : (v ?? undefined) })}
                />
              )}
            </FormField>
            <FormField label="Tone">
              {({ id, labelId }) => (
                <Select
                  variant="field"
                  id={id}
                  labelledBy={labelId}
                  label="Tone nhãn"
                  options={MARKER_TONES}
                  value={m.tone ?? 'accent'}
                  onChange={(v) => setM({ tone: v === 'accent' ? undefined : (v ?? undefined) })}
                />
              )}
            </FormField>
          </div>
          <CommitTextField
            label="Tiêu đề"
            value={m.title ?? ''}
            placeholder={obj.label ?? obj.id}
            onCommit={(v) => setM({ title: v.trim() || undefined })}
          />
          <FormField label="Giá trị hiển thị" hint={fields.length ? undefined : 'Chưa có binding nào'}>
            {({ id, labelId }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                label="Trường giá trị"
                options={[{ value: '', label: '(binding đầu tiên)' }, ...fields.map((f) => ({ value: f, label: FIELD_META[f]?.label ?? f }))]}
                value={m.field ?? ''}
                onChange={(v) => setM({ field: v || undefined })}
              />
            )}
          </FormField>
        </>
      )}
    </Section>
  );
}
