import { useId } from 'react';
import { BeforeAfterReadings, DatePicker, Select, type ReadingRowView } from '@/components';
import type { AlertUpdateConfig } from '@/features/alerts/kinds';
import { sourceLabel, type VerificationSource } from '@/features/alerts/update';

const SOURCES: readonly VerificationSource[] = ['sensor', 'gauge', 'both'];

export type UpdateReadingsSectionProps = {
  cfg: AlertUpdateConfig;
  rows: ReadingRowView[];
  source: VerificationSource;
  /** Giờ nhà máy "yyyy-mm-ddTHH:mm". */
  recordedAt: string;
  /** Nguồn có đồng hồ cơ / máy đo → sửa tay cột "Sau". */
  editable: boolean;
  /** Thông số chính đang mất tín hiệu. */
  primaryLost: boolean;
  onAfterChange: (id: string, value: number | null) => void;
  onSourceChange: (s: VerificationSource) => void;
  onRecordedAtChange: (t: string) => void;
};

/** Khối "Thông số trước và sau xử lý": bảng trước/sau, nguồn xác minh (nếu loại có), thời gian ghi nhận, ghi chú cách đọc. */
export function UpdateReadingsSection({
  cfg,
  rows,
  source,
  recordedAt,
  editable,
  primaryLost,
  onAfterChange,
  onSourceChange,
  onRecordedAtChange,
}: UpdateReadingsSectionProps) {
  const uid = useId();
  const sourceOptions = cfg.sources ? SOURCES.map((s) => ({ value: s, label: sourceLabel(cfg, s) })) : null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="text-lg font-semibold text-fg-secondary">
        Thông số trước và sau xử lý
      </h3>
      <BeforeAfterReadings
        label="Thông số trước và sau xử lý"
        rows={rows}
        onAfterChange={(id, val) => onAfterChange(id, val ?? null)}
        footer={
          <div className="grid gap-4 sm:grid-cols-2">
            {sourceOptions && (
              <div className="flex flex-col gap-1.5">
                <span id={`${uid}-src`} className="text-sm text-fg-secondary">
                  Nguồn xác minh
                </span>
                <Select
                  variant="field"
                  label="Nguồn xác minh"
                  labelledBy={`${uid}-src`}
                  options={sourceOptions}
                  value={source}
                  onChange={(s) => s && onSourceChange(s)}
                />
              </div>
            )}
            <DatePicker type="datetime-local" label="Thời gian ghi nhận" value={recordedAt} onChange={onRecordedAtChange} />
          </div>
        }
      />
      <p className="text-sm text-fg-secondary">
        "Trước" = số lúc cảnh báo. "Sau" = số trực tiếp
        {cfg.sources
          ? editable
            ? `; sửa tay theo ${sourceLabel(cfg, 'gauge').toLowerCase()}`
            : ` (chọn nguồn có "${sourceLabel(cfg, 'gauge')}" để nhập tay)`
          : ''}
        .
        {primaryLost &&
          (cfg.sources
            ? ` ${cfg.quantity[0]!.toUpperCase()}${cfg.quantity.slice(1)} đang mất tín hiệu – nhập số đo bằng ${sourceLabel(cfg, 'gauge').toLowerCase()}.`
            : ' Đầu báo mất tín hiệu – kiểm tra tại chỗ trước khi đóng.')}
      </p>
    </section>
  );
}
