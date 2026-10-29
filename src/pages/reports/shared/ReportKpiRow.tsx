import { KpiCard, type KpiTone } from '@/components';
import type { ReportKpis } from '@/features/reports';

type KpiDef = { id: keyof ReportKpis; label: string; sub: string; tone: KpiTone };

/** 5 KPI có viền màu (ảnh màn Báo cáo). Mọi số từ `deriveReportKpis` (tổng = tổng 4 nhóm). */
const KPIS: readonly KpiDef[] = [
  { id: 'total', label: 'Tổng báo cáo', sub: 'Ngày, tháng, quý và năm', tone: 'neutral' },
  { id: 'in-progress', label: 'Đang thực hiện', sub: 'Còn thiếu mốc hoặc chưa hoàn tất', tone: 'primary' },
  { id: 'awaiting', label: 'Chờ xác nhận', sub: 'Chờ một hoặc nhiều chữ ký', tone: 'warning' },
  { id: 'signed', label: 'Đã ký đầy đủ', sub: 'Đã hoàn thành quy trình', tone: 'success' },
  { id: 'missing-data', label: 'Có dữ liệu thiếu', sub: 'Cần kiểm tra hoặc bổ sung', tone: 'danger' },
];

export function ReportKpiRow({ kpis, label = 'Thống kê báo cáo' }: { kpis: ReportKpis; label?: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {KPIS.map((k) => (
        <KpiCard key={k.id} variant="compact" dense outlined label={k.label} value={kpis[k.id]} tone={k.tone} sub={k.sub} subTone="muted" />
      ))}
    </section>
  );
}
