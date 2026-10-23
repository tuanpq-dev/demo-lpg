import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '../Card';
import { Icon, HistoryIcon } from '../Icon';
import { ProgressBar } from '../ProgressBar';

export type MaintenanceSummaryCardProps = {
  title?: string;
  /** Lần bảo trì tiếp theo: ngày + ghi chú hạn ("Quá hạn 2 ngày"…). Không có → "Chưa lên lịch". */
  next?: { date: string; note?: string; overdue?: boolean };
  /** Lần bảo trì gần nhất. Không có → "Chưa có". */
  last?: { date: string; note?: string };
  /** Thanh "Tình trạng hồ sơ": % + nhãn trạng thái ("ĐẦY ĐỦ"); `hint` = ghi chú (số tạm…) cho tooltip. */
  records?: { value: number; status: string; hint?: string };
  /** Link cuối thẻ (vd "Xem trong Bảo trì"). */
  footer?: ReactNode;
  className?: string;
};

function Row({ icon, label, value, note, noteTone }: { icon: ReactNode; label: string; value: string; note?: string; noteTone?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md border border-line/30 bg-surface-muted/20 text-fg-muted">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-2xs uppercase tracking-caps text-fg-secondary">{label}</span>
        <span className="text-base font-semibold text-fg">{value}</span>
        {note && <span className={cn('text-xs', noteTone ?? 'text-fg-secondary')}>{note}</span>}
      </div>
    </div>
  );
}

/**
 * Thẻ tóm tắt bảo trì của một thiết bị (cột phải trang chi tiết tài sản, ảnh "Bồn LPG V-101" – chưa có node Figma):
 * lần tiếp theo · gần nhất · thanh tình trạng hồ sơ. Ngày đã định dạng sẵn (trang tính bằng hàm có `now`).
 */
export function MaintenanceSummaryCard({ title = 'Bảo trì', next, last, records, footer, className }: MaintenanceSummaryCardProps) {
  return (
    <Card title={title} headerVariant="plain" className={className} bodyClassName="gap-3">
      <Row
        icon={<Icon name="calendar" box={16} />}
        label="Lần bảo trì tiếp theo"
        value={next?.date ?? 'Chưa lên lịch'}
        note={next?.note}
        noteTone={next?.overdue ? 'text-danger' : undefined}
      />
      <Row icon={<HistoryIcon size={16} />} label="Bảo trì gần nhất" value={last?.date ?? 'Chưa có'} note={last?.note} />
      {records && (
        <div className="flex flex-col gap-1.5" title={records.hint}>
          <div className="flex items-center justify-between text-2xs">
            <span className="text-fg-secondary">Tình trạng hồ sơ</span>
            <span className="font-semibold uppercase tracking-caps text-success">{records.status}</span>
          </div>
          <ProgressBar value={records.value} tone="success" size="sm" label={`Tình trạng hồ sơ ${records.value}%`} />
          {records.hint && <span className="sr-only">{records.hint}</span>}
        </div>
      )}
      {footer}
    </Card>
  );
}
