/** Thuộc tính cảnh: tên, camera mặc định, view, nền. */
import { Button, NumberField, PlusIcon, Select, TrashIcon, Vec3Field } from '@/components';
import { FIELD_META } from '@/features/scene/fields';
import { useSceneDoc } from '@/features/scene-editor/store';
import { cn } from '@/lib/cn';
import { CommitTextField, Section } from './PropertyFields';
import { ThresholdsFields } from './ObjectBindings';

export function SceneProperties({ onUseCurrentCamera }: { onUseCurrentCamera: () => void }) {
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
        {Object.keys(thresholds).length === 0 && (
          <p className="text-sm text-fg-muted">Chưa có – object chỉ đổi trạng thái theo ngưỡng riêng của binding.</p>
        )}
        {Object.entries(thresholds).map(([field, t]) => (
          <div key={field} className={cn('flex flex-col gap-1.5 rounded-md border border-line/30 p-2')}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-fg-secondary">
                {FIELD_META[field]?.label ?? field}
                {FIELD_META[field]?.unit ? ` (${FIELD_META[field].unit})` : ''}
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
