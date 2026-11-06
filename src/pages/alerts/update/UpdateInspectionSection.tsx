import { useId } from 'react';
import { InspectionTable } from '@/components';
import {
  INSPECTION_STATUSES,
  INSPECTION_STATUS_LABEL,
  setInspectionStatus,
  type InspectionEntry,
  type InspectionStatus,
} from '@/features/alerts/inspection';
import { appNow } from '@/lib/demoNow';
import { plantTimeOfDay } from '@/lib/plantTime';

const STATUS_OPTIONS = INSPECTION_STATUSES.map((s) => ({ value: s, label: INSPECTION_STATUS_LABEL[s] }));
const EMPTY: InspectionEntry = { status: 'pending', note: '' };

export type UpdateInspectionSectionProps = {
  code: string;
  /** Hạng mục kiểm tra (= hướng dẫn của drawer, một nguồn). */
  steps: readonly { id: string; text: string }[];
  inspection: Record<string, InspectionEntry>;
  /** Lỗi ghi chú theo hạng mục. */
  errors: Record<string, string> | undefined;
  /** Người đang thao tác – tự điền "Người kiểm tra" khi đổi trạng thái hạng mục. */
  actor: string;
  onChange: (id: string, entry: InspectionEntry) => void;
};

/** Khối "Kết quả kiểm tra thiết bị": bảng hạng mục (trạng thái, người kiểm tra, thời gian, ghi chú). */
export function UpdateInspectionSection({ code, steps, inspection, errors, actor, onChange }: UpdateInspectionSectionProps) {
  const uid = useId();
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="text-lg font-semibold text-fg-secondary">
        Kết quả kiểm tra thiết bị
      </h3>
      <InspectionTable<InspectionStatus>
        caption={`Kết quả kiểm tra thiết bị ${code}`}
        statusOptions={STATUS_OPTIONS}
        rows={steps.map((s) => {
          const e = inspection[s.id] ?? EMPTY;
          return {
            id: s.id,
            text: s.text,
            status: e.status,
            by: e.by,
            time: e.at ? plantTimeOfDay(new Date(e.at)).slice(0, 5) : undefined,
            note: e.note,
            error: errors?.[s.id],
          };
        })}
        onStatusChange={(id, status) => onChange(id, setInspectionStatus(inspection[id] ?? EMPTY, status, { by: actor, at: appNow() }))}
        onNoteChange={(id, note) => onChange(id, { ...(inspection[id] ?? { status: 'pending' }), note })}
      />
    </section>
  );
}
