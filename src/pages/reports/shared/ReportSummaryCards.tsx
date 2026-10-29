import { ActionItemList, Card, MetricListCard, ScheduleList, type ScheduleItem } from '@/components';
import {
  SIGNATURE_STEPS,
  SIGNATURE_STEP_LABEL,
  weekdayVi,
  type MonthProgress,
  type ReportActionItem,
  type SignatureStep,
  type UpcomingDeadline,
} from '@/features/reports';
import { formatDayVi } from '@/lib/plantTime';

export type ReportSummaryCardsProps = {
  awaitingByStep: Record<SignatureStep, number>;
  monthProgress: MonthProgress;
  upcoming: readonly UpcomingDeadline[];
  actions: readonly ReportActionItem[];
  /** "Xem tất cả" của thẻ Chờ xác nhận. */
  onShowAwaiting: () => void;
  /** "Xử lý ngay" – id việc (ReportActionItem.id). */
  onAction: (id: string) => void;
};

const toScheduleItem = (d: UpcomingDeadline): ScheduleItem => ({
  id: d.id,
  date: d.day,
  weekday: weekdayVi(d.day),
  day: d.day.slice(8, 10),
  title: d.title,
  meta: `Hạn chót: ${d.time}`,
  dateLabel: `${weekdayVi(d.day) === 'CN' ? 'Chủ nhật' : `Thứ ${weekdayVi(d.day).slice(1)}`}, ${formatDayVi(d.day)}`,
});

/**
 * Hàng 4 thẻ dưới KPI (ảnh màn Báo cáo): Chờ xác nhận · Tiến độ tháng · Lịch báo cáo sắp tới · Cần xử lý hôm nay.
 * Dùng chung cho mọi màn báo cáo định kỳ – dữ liệu truyền vào đã suy dẫn (`derive*` ở features/reports).
 */
export function ReportSummaryCards({ awaitingByStep, monthProgress, upcoming, actions, onShowAwaiting, onAction }: ReportSummaryCardsProps) {
  const awaitingTotal = SIGNATURE_STEPS.reduce((s, k) => s + awaitingByStep[k], 0);
  const mp = monthProgress;
  return (
    <section aria-label="Tóm tắt báo cáo" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricListCard
        title="Chờ xác nhận"
        count={{ value: awaitingTotal, tone: 'warning', label: 'báo cáo chờ xác nhận' }}
        rows={SIGNATURE_STEPS.map((s) => ({ id: s, label: SIGNATURE_STEP_LABEL[s], value: awaitingByStep[s] }))}
        action={{ label: 'Xem tất cả', onClick: onShowAwaiting }}
      />
      <MetricListCard
        title={`Tiến độ tháng ${mp.month}`}
        progress={{ label: 'Hoàn thành', value: mp.done, max: mp.total, valueText: `${mp.done}/${mp.total} ngày` }}
        rows={[
          { id: 'in-progress', label: 'Đang thực hiện', value: mp.inProgress },
          { id: 'missing', label: 'Thiếu dữ liệu', value: mp.missing, tone: mp.missing ? 'danger' : 'default' },
          { id: 'awaiting', label: 'Chờ chữ ký', value: mp.awaiting, tone: mp.awaiting ? 'warning' : 'default' },
        ]}
      />
      <Card title="Lịch báo cáo sắp tới" radius="lg" className="h-full">
        <ScheduleList items={upcoming.map(toScheduleItem)} />
      </Card>
      <Card title="Cần xử lý hôm nay" radius="lg" className="h-full">
        <ActionItemList items={actions} onAction={onAction} emptyState="Không có việc cần xử lý hôm nay." />
      </Card>
    </section>
  );
}
