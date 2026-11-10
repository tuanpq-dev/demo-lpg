/** Lớp HTML trên cảnh: danh sách thiết bị (bàn phím / trình đọc màn hình) và tooltip object. Tách từ SceneViewer.tsx. */
import { Html } from '@react-three/drei';
import { cn } from '@/lib/cn';
import { ASSETS } from './assets/registry';
import { SignalLostIcon } from '@/components/Icon';
import { objectReadings } from './fields';
import { labelAnchor, type ResolvedObject } from './geometry';
import type { LiveData, ObjectStatus, Thresholds } from './types';

const readingTone: Record<ObjectStatus, string> = {
  normal: 'text-fg',
  warning: 'text-warning',
  danger: 'text-danger-text',
  offline: 'text-neutral',
};

const STATUS_TEXT: Record<ObjectStatus, string> = {
  normal: 'bình thường',
  warning: 'cảnh báo',
  danger: 'sự cố',
  offline: 'mất tín hiệu',
};

/**
 * Văn bản thay thế cho canvas 3D (trình đọc màn hình + bàn phím): tóm tắt số thiết bị theo trạng thái và danh sách
 * thiết bị (tên, trạng thái, số đo). Ẩn với mắt thường; Tab vào thì hiện thành bảng nhỏ góc trên trái. Có `onPick` →
 * mỗi thiết bị là nút: Enter/Space = chọn thiết bị + đưa camera tới.
 */
export function DeviceList({
  sceneName,
  objects,
  statuses,
  liveData,
  thresholds,
  selected,
  onPick,
}: {
  sceneName: string;
  objects: ResolvedObject[];
  statuses: Map<string, ObjectStatus>;
  liveData?: LiveData;
  thresholds?: Record<string, Thresholds>;
  selected: ReadonlySet<string>;
  onPick?: (id: string) => void;
}) {
  const count = (s: ObjectStatus) => objects.filter((o) => statuses.get(o.id) === s).length;
  const summary = `${objects.length} thiết bị: ${count('danger')} sự cố, ${count('warning')} cảnh báo, ${count('offline')} mất tín hiệu.`;
  return (
    <section
      aria-label={`Thiết bị trong cảnh ${sceneName}`}
      data-scene-devices
      className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:left-3 focus-within:top-16 focus-within:z-30 focus-within:max-h-[60%] focus-within:w-72 focus-within:overflow-auto focus-within:rounded-lg focus-within:border focus-within:border-line/30 focus-within:bg-surface-raised/95 focus-within:p-2 focus-within:text-sm focus-within:shadow-card"
    >
      <p className="mb-1 text-fg-secondary">{summary}</p>
      <ul className="flex flex-col gap-0.5">
        {objects.map((o) => {
          const st = statuses.get(o.id) ?? 'normal';
          const readings = objectReadings(o, liveData, thresholds)
            .map((r) => `${r.label} ${r.text}`)
            .join(', ');
          const text = `${o.label ?? o.id} (${o.id}) – ${STATUS_TEXT[st]}${readings ? `. ${readings}` : ''}`;
          return (
            <li key={o.id}>
              {onPick ? (
                <button
                  type="button"
                  aria-pressed={selected.has(o.id)}
                  onClick={() => onPick(o.id)}
                  className={cn('w-full rounded-sm px-2 py-1 text-left hover:bg-surface-muted', readingTone[st])}
                >
                  {text}
                </button>
              ) : (
                <span className={readingTone[st]}>{text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Tooltip khi hover object không có marker: tên + loại + số liệu theo bindings. */
export function ObjectTooltip({ obj, liveData, thresholds }: { obj: ResolvedObject; liveData?: LiveData; thresholds?: Record<string, Thresholds> }) {
  const readings = objectReadings(obj, liveData, thresholds);
  return (
    <Html position={labelAnchor(obj)} zIndexRange={[21, 0]} pointerEvents="none">
      <div className="pointer-events-none -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-accent/50 bg-surface-raised px-2.5 py-1.5 text-sm text-fg shadow-glow-accent">
        <div className="font-semibold">{obj.label ?? obj.id}</div>
        <div className="text-xs text-fg-muted">
          {ASSETS[obj.asset].label} · {obj.id}
        </div>
        {readings.map((r) => (
          <div key={r.field} className="mt-0.5 flex justify-between gap-4">
            <span className="text-fg-muted">
              {r.label} <span className="text-2xs">({r.tag})</span>
            </span>
            <span className={cn('flex items-center gap-1 font-semibold', readingTone[r.status])}>
              {r.lost && <SignalLostIcon size={13} />}
              {r.text}
            </span>
          </div>
        ))}
      </div>
    </Html>
  );
}
