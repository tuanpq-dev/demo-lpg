import { Button, ProgressBar } from '@/components';
import { DAILY_SHIFT_HOURS, periodLabel, type ReportRecord } from '@/features/reports';
import { cn } from '@/lib/cn';
import { boxClass } from './fields/recordParts';
import type { CheckpointRecordForm } from './useCheckpointRecordForm';
import { RECORD_NAV, type RecordNavId } from './useSectionNav';

/** Dải thông tin dưới tiêu đề: mã báo cáo, ngày, ca, mốc, người kiểm tra. */
export function RecordHeaderInfo({ report: r, checkpoint }: { report: ReportRecord; checkpoint: string }) {
  return (
    <dl className={cn(boxClass, 'flex flex-wrap items-center gap-x-6 gap-y-2 bg-bg-app/40 px-4 py-3 text-sm')}>
      {[
        ['Mã BC:', r.code],
        ['Ngày:', periodLabel(r.period, r.periodKey)],
        ['Ca:', `${r.shift ?? 'Ca 1'} (${DAILY_SHIFT_HOURS})`],
        ['Mốc:', checkpoint],
        ['Người kiểm tra:', r.inspector],
      ].map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="font-semibold text-fg-secondary">{k}</dt>
          <dd className={cn('tabular-nums', k === 'Mốc:' ? 'font-bold text-primary' : 'text-fg')}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Thanh tab điều hướng nhanh (mục đang xem = `aria-current="location"`). */
export function RecordNav({ active, onGo }: { active: RecordNavId; onGo: (id: RecordNavId) => void }) {
  return (
    <nav aria-label="Mục của biểu mẫu ghi nhận" className="shrink-0 overflow-x-auto border-b border-line/30 px-5">
      <ul className="flex min-w-max gap-6">
        {RECORD_NAV.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              aria-current={active === n.id ? 'location' : undefined}
              onClick={() => onGo(n.id)}
              className={cn(
                '-mb-px h-12 border-b-2 px-1 text-md font-semibold transition-colors',
                active === n.id ? 'border-primary text-primary' : 'border-transparent text-fg-secondary hover:text-fg',
              )}
            >
              {n.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Đầu chân modal: câu hỏi bỏ thay đổi (đang hỏi) hoặc thanh tiến độ nhóm thiết bị. */
export function RecordFooterStart({ f, checkpoint }: { f: CheckpointRecordForm; checkpoint: string }) {
  const { confirming, hasDraft } = f.modal;
  return confirming ? (
    <p role="alert" className="text-base text-fg">
      {hasDraft ? 'Bỏ các thay đổi và xóa bản nháp đã lưu?' : 'Bỏ các thay đổi chưa lưu?'}
    </p>
  ) : (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0">
        <ProgressBar value={f.progress} label={`Tiến độ kiểm tra nhóm thiết bị mốc ${checkpoint}`} tone="primary" size="md" />
      </div>
      <span className="whitespace-nowrap text-sm text-fg-secondary">Hoàn thành {f.progress}%</span>
    </div>
  );
}

/** Nút chân modal: Tiếp tục nhập / Bỏ thay đổi (đang hỏi) hoặc Hủy · Lưu bản nháp · Lưu và tiếp tục sau · Xác nhận mốc. */
export function RecordFooter({ f, checkpoint, blockersId }: { f: CheckpointRecordForm; checkpoint: string; blockersId: string }) {
  const { modal } = f;
  return modal.confirming ? (
    <>
      <Button ref={modal.keepEditingRef} variant="subtle" onClick={modal.keepEditing}>
        Tiếp tục nhập
      </Button>
      <Button variant="primary" onClick={modal.discard}>
        {modal.hasDraft ? 'Bỏ thay đổi và xóa nháp' : 'Bỏ thay đổi'}
      </Button>
    </>
  ) : (
    <>
      <Button variant="plain" onClick={modal.requestClose}>
        Hủy
      </Button>
      <Button variant="ghost" onClick={() => f.saveDraft(false)}>
        Lưu bản nháp
      </Button>
      <Button variant="ghost" onClick={() => f.saveDraft(true)}>
        Lưu và tiếp tục sau
      </Button>
      <Button type="submit" variant="primary" aria-disabled={!f.ready || modal.submitting || undefined} aria-describedby={f.ready ? undefined : blockersId}>
        Xác nhận mốc {checkpoint}
      </Button>
    </>
  );
}
