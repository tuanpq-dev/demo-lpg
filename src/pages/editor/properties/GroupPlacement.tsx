/** Căn / phân bố nhiều object đang chọn. */
import { Button, NumberField } from '@/components';
import { ELEVATION_STEP, snapTo } from '@/features/scene-editor/ops';
import type { SceneObject } from '@/features/scene/types';
import { useEditorUi } from '@/features/scene-editor/store';
import type { EditorActions } from '../useEditorActions';
import { Section } from './PropertyFields';

/** Nhiều object: căn hàng X/Z (cùng elevation, phân bố đều), elevation chung, đặt xuống sàn. */
export function GroupPlacement({ picked, actions }: { picked: SceneObject[]; actions: EditorActions }) {
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
          onChange={(v) =>
            actions.setElevation(
              snap ? snapTo(v, ELEVATION_STEP) : v,
              placed.map((o) => o.id),
            )
          }
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={same === 0}
          onClick={() =>
            actions.setElevation(
              0,
              placed.map((o) => o.id),
            )
          }
        >
          Đặt xuống sàn
        </Button>
      </div>
    </Section>
  );
}
