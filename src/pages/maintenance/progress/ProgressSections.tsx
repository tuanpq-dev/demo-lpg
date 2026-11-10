import { useId, type ReactNode } from 'react';
import {
  AlertOctagonIcon,
  Badge,
  Button,
  CheckCircleIcon,
  KpiCard,
  PauseCircleIcon,
  PlayCircleIcon,
  ProgressSlider,
  StatusOptionGroup,
  Textarea,
  type StatusOption,
} from '@/components';
import { dueHasTime, dueTimeLabel, type MaintenanceRecord } from '@/data/maintenance';
import { checklistProgress } from '@/features/maintenance/checklist';
import { isPastDue } from '@/features/maintenance/deadline';
import {
  TEXT_LABEL,
  WORK_STATE_OPTIONS,
  isNearOrPastDue,
  reportedProgressOf,
  requiresText,
  workStateDisabled,
  type WorkState,
} from '@/features/maintenance/progress';
import { daysFromToday } from '@/lib/plantTime';
import type { ProgressUpdateForm } from './useProgressUpdateForm';

const ICONS: Record<WorkState, ReactNode> = {
  working: <PlayCircleIcon size={20} />,
  paused: <PauseCircleIcon size={20} />,
  blocked: <AlertOctagonIcon size={20} />,
  completed: <CheckCircleIcon size={20} />,
};
const TONES = { working: 'primary', paused: 'warning', blocked: 'danger', completed: 'primary' } as const;

/** Dòng "Bản nháp – Đang mở bản nháp đã lưu lúc HH:mm." */
export function DraftNote({ savedAt }: { savedAt: string | undefined }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
      <Badge variant="tag" tone="neutral">
        Bản nháp
      </Badge>
      Đang mở bản nháp đã lưu
      {savedAt ? ` lúc ${new Date(savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })}` : ''}.
    </p>
  );
}

/** 5 ô thông tin: mã, thiết bị, nhân sự, tiến độ báo cáo, hạn chót (đỏ khi gần / quá hạn). */
export function ProgressInfoCards({ record: r, now }: { record: MaintenanceRecord; now: Date }) {
  const hasTime = dueHasTime(r);
  const dueRed = isNearOrPastDue(r.dueAt, now, hasTime);
  const overdue = isPastDue(r.dueAt, now, hasTime);
  const dueDay = daysFromToday(r.dueAt, now);
  const dueValue = `${dueTimeLabel(r)}${dueDay === 0 ? '' : ` ${r.dueAt.slice(8, 10)}/${r.dueAt.slice(5, 7)}`}`;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
      {[
        { label: 'Mã số', value: r.code },
        { label: 'Thiết bị', value: r.device },
        { label: 'Nhân sự', value: r.assignee ?? 'Chưa phân công' },
        { label: 'Tiến độ', value: `${reportedProgressOf(r)}%`, tone: 'primary' as const, hint: 'Tiến độ báo cáo gần nhất' },
        {
          label: 'Hạn chót',
          value: dueValue,
          tone: dueRed ? ('danger' as const) : ('neutral' as const),
          hint: overdue ? 'Đã quá hạn' : dueRed ? 'Gần hạn – còn dưới 2 giờ' : undefined,
        },
      ].map((c) => (
        <KpiCard key={c.label} size="sm" emphasis label={c.label} value={c.value} tone={c.tone} hint={c.hint} />
      ))}
    </div>
  );
}

/** "Trạng thái công việc": 4 ô (Hoàn thành khoá khi chưa bắt đầu thực hiện) + lỗi trạng thái. */
export function WorkStateSection({ f, status }: { f: ProgressUpdateForm; status: MaintenanceRecord['status'] }) {
  const headingId = useId();
  const options: StatusOption<WorkState>[] = WORK_STATE_OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    icon: ICONS[o.id],
    tone: TONES[o.id],
    disabled: workStateDisabled(status, o.id),
    disabledHint: workStateDisabled(status, o.id) ? 'bắt đầu thực hiện trước khi báo hoàn thành' : undefined,
  }));
  return (
    <section className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-semibold text-fg-secondary">
        Trạng thái công việc
      </h3>
      <StatusOptionGroup label="Trạng thái công việc" labelledBy={headingId} options={options} value={f.state} onChange={f.chooseState} />
      {f.errors.state && <p className="text-sm text-danger-text">{f.errors.state}</p>}
    </section>
  );
}

/** "Tiến độ hoàn thành": thanh trượt (bước 5) + dòng checklist (Mở checklist; cảnh báo khi báo hoàn thành mà checklist chưa xong). */
export function ProgressSection({ f, record: r, canOpenChecklist }: { f: ProgressUpdateForm; record: MaintenanceRecord; canOpenChecklist: boolean }) {
  const lineId = useId();
  const checklist = r.checklist?.length ? checklistProgress(r.checklist) : null;
  return (
    <section className="flex flex-col gap-2">
      <ProgressSlider label="Tiến độ hoàn thành" value={f.progress} onChange={f.setProgress} describedBy={lineId} />
      <p id={lineId} className="flex flex-wrap items-center gap-x-2 text-sm text-fg-secondary">
        {checklist ? (
          <>
            <span>
              Checklist {checklist.done}/{checklist.total}
            </span>
            {canOpenChecklist && (
              <>
                <span aria-hidden="true">·</span>
                <Button variant="link" onClick={f.openChecklist}>
                  Mở checklist
                </Button>
              </>
            )}
            {f.state === 'completed' && checklist.done < checklist.total && (
              <span className="basis-full text-warning">
                Checklist chưa xong hết – cần hoàn thành checklist (trừ mục Không áp dụng) mới gửi nghiệm thu được.
              </span>
            )}
          </>
        ) : (
          <span>Yêu cầu chưa có checklist – tiến độ do người thực hiện báo cáo.</span>
        )}
      </p>
    </section>
  );
}

/** "Nội dung đã thực hiện" – nhãn / bắt buộc / gợi ý theo trạng thái. */
export function ProgressTextField({ f }: { f: ProgressUpdateForm }) {
  return (
    <div ref={f.textWrapRef}>
      <Textarea
        labelVariant="section"
        label={TEXT_LABEL[f.state]}
        required={requiresText(f.state)}
        value={f.text}
        onChange={f.setText}
        placeholder="Mô tả chi tiết các bước đã hoàn thành..."
        rows={4}
        maxLength={1000}
        error={f.errors.text}
        hint={
          f.continueToSubmit
            ? 'Nội dung được điền sẵn vào "Tóm tắt công việc" ở bước gửi nghiệm thu.'
            : requiresText(f.state)
              ? 'Bắt buộc – được lưu vào lịch sử xử lý và ghi chú kỹ thuật.'
              : 'Không bắt buộc – nếu có, được lưu thành ghi chú kỹ thuật.'
        }
      />
    </div>
  );
}
