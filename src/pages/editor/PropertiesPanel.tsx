import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Checkbox,
  Combobox,
  DuplicateIcon,
  FormField,
  NumberField,
  PlusIcon,
  Select,
  TextField,
  TrashIcon,
  Vec3Field,
  type ComboOption,
} from '@/components';
import { SENSOR_TAGS } from '@/data/scene';
import { ASSET_SPECS } from '@/features/scene/assets/specs';
import { FIELD_META } from '@/features/scene/fields';
import { GROUND_EPS, mayFloat, worldBaseY } from '@/features/scene/ground';
import { ELEVATION_STEP, snapTo } from '@/features/scene-editor/ops';
import type { Binding, SceneObject, SceneObjectMarker, Thresholds, Vec3 } from '@/features/scene/types';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import { cn } from '@/lib/cn';
import { AssetGlyph } from './AssetGlyph';
import type { EditorActions } from './useEditorActions';

const DEG = 180 / Math.PI;

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-line/30 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** TextField chốt khi rời ô/Enter (1 lần sửa = 1 bước undo); `onCommit` trả lỗi → giữ chữ + báo lỗi. */
function CommitTextField({
  label,
  value,
  onCommit,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => string | undefined | void;
  hint?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string>();
  useEffect(() => {
    setText(value);
    setError(undefined);
  }, [value]);
  const commit = () => {
    if (text === value) return setError(undefined);
    setError(onCommit(text) || undefined);
  };
  return (
    <TextField
      label={label}
      value={text}
      onChange={setText}
      error={error}
      hint={hint}
      placeholder={placeholder}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setText(value);
      }}
    />
  );
}

export type PropertiesPanelProps = {
  actions: EditorActions;
  /** Lấy góc nhìn hiện tại của canvas làm camera mặc định của cảnh. */
  onUseCurrentCamera: () => void;
};

/** Cột phải: thuộc tính object đang chọn (1 · nhiều) hoặc thuộc tính cảnh khi không chọn gì. */
export function PropertiesPanel({ actions, onUseCurrentCamera }: PropertiesPanelProps) {
  const objects = useSceneDoc((s) => s.scene.objects);
  const selection = useEditorUi((s) => s.selection);
  const picked = objects.filter((o) => selection.includes(o.id));

  if (picked.length === 1) return <ObjectProperties key={picked[0]!.id} obj={picked[0]!} actions={actions} />;
  if (picked.length > 1)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base font-semibold text-fg">{picked.length} object đang chọn</p>
        <p className="text-sm text-fg-muted">{picked.map((o) => o.id).join(', ')}</p>
        <p className="text-sm text-fg-muted">
          Di chuyển (W): kéo một object trong nhóm – cả nhóm trượt trên sàn. Xoay/scale: gizmo quanh trọng tâm.
        </p>
        <GroupPlacement picked={picked} actions={actions} />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" icon={<DuplicateIcon />} onClick={actions.duplicateSelection}>
            Nhân bản
          </Button>
          <Button variant="ghost" size="sm" icon={<TrashIcon />} onClick={actions.deleteSelection}>
            Xoá
          </Button>
        </div>
      </div>
    );
  return <SceneProperties onUseCurrentCamera={onUseCurrentCamera} />;
}

// ---------------------------------------------------------------------------
// Một object

function ObjectProperties({ obj, actions }: { obj: SceneObject; actions: EditorActions }) {
  const spec = ASSET_SPECS[obj.asset];
  const pipes = useSceneDoc((s) => s.scene.pipes);
  const update = (fn: (o: SceneObject) => SceneObject) => actions.updateObject(obj.id, fn);
  const schema = Object.entries(spec.paramsSchema);
  const equipment = spec.category === 'equipment';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-surface-muted text-fg-muted">
          <AssetGlyph asset={obj.asset} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-fg">{spec.label}</p>
          <p className="text-xs text-fg-muted">
            {obj.asset} · {equipment ? 'thiết bị' : 'bối cảnh'}
          </p>
        </div>
      </div>

      <Section title="Định danh">
        <CommitTextField
          label="id"
          value={obj.id}
          hint="Đổi id cập nhật cả view và ống trỏ tới"
          onCommit={(v) => actions.rename(obj.id, v.trim())}
        />
        <CommitTextField
          label="Nhãn"
          value={obj.label ?? ''}
          placeholder={obj.id}
          onCommit={(v) => update((o) => ({ ...o, label: v.trim() || undefined }))}
        />
      </Section>

      <Section title="Vị trí">
        {obj.attach ? (
          <>
            <p className="text-sm text-fg-muted">Gắn trên ống – vị trí và hướng theo đường ống.</p>
            <FormField label="Ống">
              {({ id, labelId }) => (
                <Select
                  variant="field"
                  id={id}
                  labelledBy={labelId}
                  label="Ống"
                  options={pipes.map((p) => ({ value: p.id, label: p.id }))}
                  value={obj.attach!.pipe}
                  onChange={(v) => v && update((o) => ({ ...o, attach: { ...o.attach!, pipe: v } }))}
                />
              )}
            </FormField>
            <NumberField
              label="Vị trí trên ống (t, 0–1)"
              value={obj.attach.t}
              step={0.01}
              min={0}
              max={1}
              onChange={(t) => update((o) => ({ ...o, attach: { ...o.attach!, t } }))}
            />
          </>
        ) : (
          <>
            <Vec3Field
              label="Vị trí trên sàn"
              unit="m"
              step={0.5}
              only={[0, 2]}
              value={obj.position ?? [0, 0, 0]}
              onChange={(p) => update((o) => ({ ...o, position: [p[0], o.elevation ?? 0, p[2]] }))}
            />
            <ElevationField obj={obj} actions={actions} />
            <NumberField
              label="Góc xoay quanh Y"
              unit="°"
              step={15}
              precision={1}
              value={+((obj.rotation?.[1] ?? 0) * DEG).toFixed(1)}
              onChange={(deg) =>
                update((o) => {
                  const r = o.rotation ?? [0, 0, 0];
                  return { ...o, rotation: [r[0], +(deg / DEG).toFixed(4), r[2]] };
                })
              }
            />
            {(obj.rotation?.[0] || obj.rotation?.[2]) && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-warning/10 px-2 py-1.5 text-sm text-warning">
                <span>Có nghiêng X/Z (từ JSON) – đáy lệch khỏi sàn.</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update((o) => ({ ...o, rotation: [0, o.rotation?.[1] ?? 0, 0] }))}
                >
                  Bỏ nghiêng
                </Button>
              </div>
            )}
            <Vec3Field
              label="Scale"
              step={0.1}
              value={obj.scale ?? [1, 1, 1]}
              onChange={(scale) => update((o) => ({ ...o, scale }))}
            />
          </>
        )}
      </Section>

      {schema.length > 0 && (
        <Section title="Tham số">
          {schema.map(([name, def]) => (
            <NumberField
              key={name}
              label={def.label}
              unit={def.unit}
              value={obj.params?.[name]}
              placeholder={`${def.default} (mặc định)`}
              min={def.min}
              max={def.max}
              integer={def.integer}
              step={def.integer ? 1 : 0.5}
              hint={def.min !== undefined || def.max !== undefined ? `${def.min ?? '−∞'} – ${def.max ?? '∞'}` : undefined}
              onChange={(v) => update((o) => ({ ...o, params: { ...o.params, [name]: v } }))}
              onClear={() =>
                update((o) => {
                  const { [name]: _drop, ...rest } = o.params ?? {};
                  void _drop;
                  return { ...o, params: rest };
                })
              }
            />
          ))}
        </Section>
      )}

      {obj.asset === 'fence' && <PathEditor obj={obj} update={update} />}

      {equipment && <BindingsEditor obj={obj} update={update} />}

      <MarkerEditor obj={obj} update={update} />

      <div className="flex flex-wrap gap-2 border-t border-line/30 pt-3">
        <Button variant="ghost" size="sm" icon={<DuplicateIcon />} onClick={actions.duplicateSelection}>
          Nhân bản
        </Button>
        <Button variant="ghost" size="sm" icon={<TrashIcon />} onClick={actions.deleteSelection}>
          Xoá
        </Button>
      </div>
    </div>
  );
}

type Update = (fn: (o: SceneObject) => SceneObject) => void;

const fmtGap = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} m`;

/** Ô Elevation (độ cao đáy, snap 0.25 m khi bật snap) + "Đặt xuống sàn" + khoảng cách đáy–sàn thực tế. */
function ElevationField({ obj, actions }: { obj: SceneObject; actions: EditorActions }) {
  const snap = useEditorUi((s) => s.snap);
  const elevation = obj.elevation ?? 0;
  const base = worldBaseY(obj, elevation);
  const hint =
    base < -GROUND_EPS
      ? `Lún dưới sàn ${fmtGap(base)}`
      : elevation > GROUND_EPS && !mayFloat(obj)
        ? `Đáy cách sàn ${fmtGap(base)} – lơ lửng (chỉ van/đồng hồ lắp trên ống mới nên nâng)`
        : `Đáy cách sàn ${fmtGap(base)}`;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <NumberField
        className="w-full"
        label="Elevation (độ cao đáy)"
        unit="m"
        step={ELEVATION_STEP}
        value={elevation}
        hint={hint}
        onChange={(v) => actions.setElevation(snap ? snapTo(v, ELEVATION_STEP) : v, [obj.id])}
        onClear={() => actions.setElevation(0, [obj.id])}
      />
      <Button variant="ghost" size="sm" disabled={elevation === 0} onClick={() => actions.setElevation(0, [obj.id])}>
        Đặt xuống sàn
      </Button>
    </div>
  );
}

/** Nhiều object: căn hàng X/Z (cùng elevation, phân bố đều), elevation chung, đặt xuống sàn. */
function GroupPlacement({ picked, actions }: { picked: SceneObject[]; actions: EditorActions }) {
  const snap = useEditorUi((s) => s.snap);
  const placed = picked.filter((o) => !o.attach && o.position);
  const levels = new Set(placed.map((o) => o.elevation ?? 0));
  const same = levels.size === 1 ? [...levels][0] : undefined;
  return (
    <Section title="Căn chỉnh">
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" disabled={placed.length < 2} onClick={() => actions.align('x')}>
          Căn hàng theo X
        </Button>
        <Button variant="ghost" size="sm" disabled={placed.length < 2} onClick={() => actions.align('z')}>
          Căn hàng theo Z
        </Button>
      </div>
      <p className="text-xs text-fg-muted">Theo object chọn đầu tiên ({placed[0]?.id ?? '—'}): cùng toạ độ trục kia và elevation, tâm cách đều.</p>
      <div className="flex items-end gap-2">
        <NumberField
          className="min-w-0 flex-1"
          label="Elevation (cả nhóm)"
          unit="m"
          step={ELEVATION_STEP}
          value={same}
          placeholder="khác nhau"
          onChange={(v) => actions.setElevation(snap ? snapTo(v, ELEVATION_STEP) : v, placed.map((o) => o.id))}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={same === 0}
          onClick={() => actions.setElevation(0, placed.map((o) => o.id))}
        >
          Đặt xuống sàn
        </Button>
      </div>
    </Section>
  );
}

/** Đường bao hàng rào: danh sách điểm (x, z) cục bộ + khép kín. */
function PathEditor({ obj, update }: { obj: SceneObject; update: Update }) {
  const path = obj.path ?? [];
  const closed = path.length > 2 && path[0]![0] === path.at(-1)![0] && path[0]![2] === path.at(-1)![2];
  const pts = closed ? path.slice(0, -1) : path;
  const save = (next: Vec3[], close = closed) =>
    update((o) => ({ ...o, path: close && next.length > 2 ? [...next, [...next[0]!] as Vec3] : next }));
  return (
    <Section
      title={`Đường bao (${pts.length} điểm)`}
      aside={
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            const last = pts.at(-1) ?? [0, 0, 0];
            save([...pts, [last[0] + 2, 0, last[2]]]);
          }}
        >
          + Điểm
        </Button>
      }
    >
      <Checkbox showLabel label="Khép kín (nối điểm cuối về điểm đầu)" checked={closed} onChange={(c) => save(pts, c)} />
      <ol className="flex flex-col gap-1.5">
        {pts.map((p, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="w-5 text-xs text-fg-muted">{i + 1}</span>
            {([0, 2] as const).map((axis) => (
              <NumberField
                key={axis}
                label={`Điểm ${i + 1} ${axis === 0 ? 'X' : 'Z'}`}
                hideLabel
                size="sm"
                prefix={axis === 0 ? 'X' : 'Z'}
                step={0.5}
                value={p[axis]}
                className="flex-1"
                onChange={(v) => save(pts.map((q, k) => (k === i ? (q.map((c, a) => (a === axis ? v : c)) as Vec3) : q)))}
              />
            ))}
            <Button
              variant="icon"
              size="sm"
              aria-label={`Xoá điểm ${i + 1}`}
              disabled={pts.length <= 2}
              onClick={() => save(pts.filter((_, k) => k !== i))}
              icon={<TrashIcon />}
            />
          </li>
        ))}
      </ol>
    </Section>
  );
}

const THRESHOLD_KEYS: { key: keyof Thresholds; label: string }[] = [
  { key: 'warn', label: 'Cảnh báo ≥' },
  { key: 'danger', label: 'Nguy hiểm ≥' },
  { key: 'lowWarn', label: 'Cảnh báo ≤' },
  { key: 'lowDanger', label: 'Nguy hiểm ≤' },
];

/** 4 ô ngưỡng (trống = không đặt). */
function ThresholdsFields({ label, value, onChange }: { label: string; value: Thresholds; onChange: (t: Thresholds) => void }) {
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
function BindingsEditor({ obj, update }: { obj: SceneObject; update: Update }) {
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
function MarkerEditor({ obj, update }: { obj: SceneObject; update: Update }) {
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

// ---------------------------------------------------------------------------
// Cảnh (không chọn gì)

function SceneProperties({ onUseCurrentCamera }: { onUseCurrentCamera: () => void }) {
  const scene = useSceneDoc((s) => s.scene);
  const setScene = useSceneDoc((s) => s.setScene);
  const thresholds = scene.thresholds ?? {};
  const missing = Object.keys(FIELD_META).filter((f) => !FIELD_META[f]!.states && !(f in thresholds));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">Chưa chọn object – đang sửa thuộc tính của cảnh.</p>
      <Section title="Cảnh">
        <CommitTextField
          label="id cảnh"
          value={scene.id}
          hint="Dùng ở /overview?scene=…; đổi id rồi Lưu = lưu thành cảnh mới"
          onCommit={(v) => {
            const id = v.trim();
            if (!/^[a-z0-9-]+$/.test(id)) return 'Chỉ chữ thường không dấu, số và "-"';
            setScene((s) => ({ ...s, id }));
          }}
        />
        <CommitTextField label="Tên cảnh" value={scene.name} onCommit={(v) => setScene((s) => ({ ...s, name: v.trim() || s.name }))} />
        <p className="text-sm text-fg-muted">
          Version {scene.version} · {scene.objects.length} object · {scene.pipes.length} ống
        </p>
      </Section>
      <Section title="Camera mặc định (Toàn cảnh)">
        <Button variant="ghost" size="sm" onClick={onUseCurrentCamera}>
          Đặt góc nhìn hiện tại làm mặc định
        </Button>
        {scene.camera ? (
          <>
            <Vec3Field
              label="Vị trí camera"
              step={1}
              precision={2}
              value={scene.camera.position}
              onChange={(position) => setScene((s) => ({ ...s, camera: { ...s.camera!, position } }))}
            />
            <Vec3Field
              label="Điểm nhìn"
              step={0.5}
              precision={2}
              value={scene.camera.target}
              onChange={(target) => setScene((s) => ({ ...s, camera: { ...s.camera!, target } }))}
            />
            <NumberField
              label="Zoom (px/m ở khung 1146px)"
              step={1}
              min={1}
              precision={2}
              value={scene.camera.zoom}
              onChange={(zoom) => setScene((s) => ({ ...s, camera: { ...s.camera!, zoom } }))}
            />
          </>
        ) : (
          <p className="text-sm text-fg-muted">Chưa đặt – “Toàn cảnh” ở Viewer tự khung vừa mọi object.</p>
        )}
        {scene.camera && (
          <Button
            variant="link"
            size="sm"
            onClick={() =>
              setScene(({ camera: _c, ...rest }) => {
                void _c;
                return rest;
              })
            }
          >
            Bỏ camera mặc định (tự khung vừa)
          </Button>
        )}
      </Section>
      <Section
        title="Ngưỡng theo trường"
        aside={
          missing.length > 0 && (
            <Select
              variant="button"
              label="Thêm"
              placeholder="+ Trường"
              icon={<PlusIcon />}
              options={missing.map((f) => ({ value: f, label: FIELD_META[f]!.label }))}
              value={null}
              onChange={(f) => f && setScene((s) => ({ ...s, thresholds: { ...s.thresholds, [f]: {} } }))}
              align="end"
            />
          )
        }
      >
        {Object.keys(thresholds).length === 0 && <p className="text-sm text-fg-muted">Chưa có – object chỉ đổi trạng thái theo ngưỡng riêng của binding.</p>}
        {Object.entries(thresholds).map(([field, t]) => (
          <div key={field} className={cn('flex flex-col gap-1.5 rounded-md border border-line/30 p-2')}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-fg-secondary">
                {FIELD_META[field]?.label ?? field}
                {FIELD_META[field]?.unit ? ` (${FIELD_META[field]!.unit})` : ''}
              </span>
              <Button
                variant="icon"
                size="sm"
                aria-label={`Bỏ ngưỡng ${field}`}
                icon={<TrashIcon />}
                onClick={() =>
                  setScene((s) => {
                    const { [field]: _drop, ...rest } = s.thresholds ?? {};
                    void _drop;
                    return { ...s, thresholds: rest };
                  })
                }
              />
            </div>
            <ThresholdsFields
              label={field}
              value={t}
              onChange={(next) => setScene((s) => ({ ...s, thresholds: { ...s.thresholds, [field]: next } }))}
            />
          </div>
        ))}
      </Section>
    </div>
  );
}
