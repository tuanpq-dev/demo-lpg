/** Bảng thuộc tính một object: định danh, vị trí/xoay/cỡ, cao độ, đường đi (path). */
import { Button, Checkbox, DuplicateIcon, FormField, NumberField, Select, TrashIcon, Vec3Field } from '@/components';
import { ASSET_SPECS } from '@/features/scene/assets/specs';
import { GROUND_EPS, mayFloat, worldBaseY } from '@/features/scene/ground';
import { ELEVATION_STEP, snapTo } from '@/features/scene-editor/ops';
import type { SceneObject, Vec3 } from '@/features/scene/types';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import { AssetGlyph } from '../AssetGlyph';
import type { EditorActions } from '../useEditorActions';
import { BindingsEditor, MarkerEditor } from './ObjectBindings';
import { CommitTextField, DEG, Section, type Update } from './PropertyFields';

export function ObjectProperties({ obj, actions }: { obj: SceneObject; actions: EditorActions }) {
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
        <CommitTextField label="id" value={obj.id} hint="Đổi id cập nhật cả view và ống trỏ tới" onCommit={(v) => actions.rename(obj.id, v.trim())} />
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-fg-muted">Gắn trên ống – vị trí và hướng theo đường ống (W: kéo dọc ống).</p>
              <Button variant="ghost" size="sm" onClick={() => actions.detachFromPipe(obj.id)}>
                Tháo khỏi ống
              </Button>
            </div>
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
            {spec.inline && pipes.length > 0 && (
              <FormField label="Gắn lên ống" hint="Đặt tại điểm trên ống gần vị trí hiện tại nhất; xoay theo hướng ống">
                {({ id, labelId }) => (
                  <Select
                    variant="field"
                    id={id}
                    labelledBy={labelId}
                    label="Gắn lên ống"
                    placeholder="Chọn ống…"
                    options={pipes.map((p) => ({ value: p.id, label: p.id }))}
                    value={null}
                    onChange={(v) => v && actions.attachToPipe(obj.id, v)}
                  />
                )}
              </FormField>
            )}
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
                <Button variant="ghost" size="sm" onClick={() => update((o) => ({ ...o, rotation: [0, o.rotation?.[1] ?? 0, 0] }))}>
                  Bỏ nghiêng
                </Button>
              </div>
            )}
            <Vec3Field label="Scale" step={0.1} value={obj.scale ?? [1, 1, 1]} onChange={(scale) => update((o) => ({ ...o, scale }))} />
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

/** Đường bao hàng rào: danh sách điểm (x, z) cục bộ + khép kín. */
function PathEditor({ obj, update }: { obj: SceneObject; update: Update }) {
  const path = obj.path ?? [];
  const closed = path.length > 2 && path[0]![0] === path.at(-1)![0] && path[0]![2] === path.at(-1)![2];
  const pts = closed ? path.slice(0, -1) : path;
  const save = (next: Vec3[], close = closed) => update((o) => ({ ...o, path: close && next.length > 2 ? [...next, [...next[0]!] as Vec3] : next }));
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
