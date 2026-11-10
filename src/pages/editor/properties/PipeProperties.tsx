/** Bảng thuộc tính ống (pipe). */
import { Button, PipeIcon, FormField, NumberField, PlusIcon, Select, TrashIcon, Vec3Field } from '@/components';
import { SENSOR_TAGS } from '@/data/scene';
import { allPorts, DEFAULT_PIPE_RADIUS, objectsById, portWorld, roundVec } from '@/features/scene/pipes';
import type { Pipe, Vec3 } from '@/features/scene/types';
import { useSceneDoc } from '@/features/scene-editor/store';
import type { EditorActions } from '../useEditorActions';
import { CommitTextField, Section } from './PropertyFields';

/** Thuộc tính ống: id, bán kính, tag lưu lượng, cổng đầu/cuối, điểm gập, đảo chiều, xoá. */
export function PipeProperties({ pipe, actions }: { pipe: Pipe; actions: EditorActions }) {
  const scene = useSceneDoc((s) => s.scene);
  const update = (fn: (p: Pipe) => Pipe) => actions.updatePipe(pipe.id, fn);
  const byId = objectsById(scene);
  const portOptions = allPorts(scene.objects).map((p) => ({ value: p.ref, label: p.ref }));
  const attached = scene.objects.filter((o) => o.attach?.pipe === pipe.id).map((o) => o.id);
  const tagOptions = SENSOR_TAGS.map((t) => ({ value: t, label: t }));
  const pathLen = pipe.points.length + (pipe.from ? 1 : 0) + (pipe.to ? 1 : 0);

  /** Đổi cổng một đầu; bỏ nối → đầu thành điểm tự do tại cổng cũ (hình ống giữ nguyên). */
  const setEnd = (end: 'from' | 'to', ref: string | null) =>
    update((p) => {
      const old = p[end];
      if (ref) return { ...p, [end]: ref };
      const at = portWorld(byId, old);
      const points = at ? (end === 'from' ? [roundVec(at), ...p.points] : [...p.points, roundVec(at)]) : p.points;
      return { ...p, [end]: undefined, points };
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-surface-muted text-fg-muted">
          <PipeIcon />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-fg">Ống {pipe.id}</p>
          <p className="text-xs text-fg-muted">
            {pathLen} điểm trên đường đi{attached.length ? ` · gắn: ${attached.join(', ')}` : ''}
          </p>
        </div>
      </div>

      <Section title="Định danh">
        <CommitTextField
          label="id"
          value={pipe.id}
          hint="Đổi id cập nhật cả object gắn trên ống"
          onCommit={(v) => actions.rename(pipe.id, v.trim())}
        />
        <NumberField
          label="Bán kính"
          unit="m"
          step={0.02}
          min={0.03}
          max={1.5}
          value={pipe.radius}
          placeholder={`${DEFAULT_PIPE_RADIUS} (mặc định)`}
          onChange={(radius) => update((p) => ({ ...p, radius }))}
          onClear={() => update((p) => ({ ...p, radius: undefined }))}
        />
        <FormField label="Tag lưu lượng (flowTag)" hint="Tốc độ vệt sáng chạy theo giá trị tag">
          {({ id, labelId }) => (
            <Select
              variant="field"
              id={id}
              labelledBy={labelId}
              label="Tag lưu lượng"
              allLabel="— không —"
              options={tagOptions}
              value={pipe.flowTag ?? null}
              onChange={(v) => update((p) => ({ ...p, flowTag: v ?? undefined }))}
            />
          )}
        </FormField>
      </Section>

      <Section title="Nối cổng">
        {(['from', 'to'] as const).map((end) => (
          <FormField key={end} label={end === 'from' ? 'Đầu (from)' : 'Cuối (to)'} hint="Bỏ nối → đầu ống thành điểm tự do tại cổng cũ">
            {({ id, labelId }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                label={end}
                allLabel="— không nối —"
                options={portOptions}
                value={pipe[end] ?? null}
                onChange={(v) => setEnd(end, v)}
              />
            )}
          </FormField>
        ))}
      </Section>

      <Section
        title={`Điểm gập (${pipe.points.length})`}
        aside={
          <Button
            variant="ghost"
            size="sm"
            icon={<PlusIcon />}
            onClick={() =>
              update((p) => {
                const last = p.points.at(-1) ?? portWorld(byId, p.from) ?? [0, 1.2, 0];
                return { ...p, points: [...p.points, [last[0] + 1, last[1], last[2]] as Vec3] };
              })
            }
          >
            Thêm
          </Button>
        }
      >
        {pipe.points.map((pt, i) => (
          <div key={i} className="flex items-end gap-1.5">
            <Vec3Field
              className="min-w-0 flex-1"
              label={`Điểm ${i}`}
              step={0.5}
              value={pt}
              onChange={(v) => update((p) => ({ ...p, points: p.points.map((q, k) => (k === i ? v : q)) }))}
            />
            <Button
              variant="icon"
              size="sm"
              aria-label={`Xoá điểm ${i}`}
              disabled={pathLen <= 2}
              onClick={() => update((p) => ({ ...p, points: p.points.filter((_, k) => k !== i) }))}
              icon={<TrashIcon />}
            />
          </div>
        ))}
        <p className="text-xs text-fg-muted">Trên canvas: kéo chấm để dời (giữ Y), click vào đoạn để thêm điểm, chọn chấm + Delete để xoá.</p>
      </Section>

      <div className="flex flex-wrap gap-2 border-t border-line/30 pt-3">
        <Button variant="ghost" size="sm" onClick={() => actions.reversePipe(pipe.id)}>
          Đảo chiều
        </Button>
        <Button variant="ghost" size="sm" icon={<TrashIcon />} onClick={actions.deleteSelection}>
          Xoá ống
        </Button>
      </div>
    </div>
  );
}
