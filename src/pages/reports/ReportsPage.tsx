import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { useCan } from '@/app/auth';
import { reportDetailPath } from '@/data/dailyReport';
import { useDailyReportByCode, useReportSummary } from '@/data/reportApi';
import { DAILY_CHECKPOINTS, canInspectorSign, deriveUpcomingDeadlines, type ReportTab } from '@/features/reports';
import { announce } from '@/lib/announce';
import { plantDayKey } from '@/lib/plantTime';
import { useNow } from '@/hooks/useNow';
import { combineQueries } from '@/lib/queryState';
import { ReportKpiRow } from './shared/ReportKpiRow';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportTableSection } from './shared/ReportTableSection';
import { useReportTable } from './shared/useReportTable';
import { ReportSignModal } from './sign/ReportSignModal';

const DEFAULT_TAB: ReportTab = 'daily';

const checkpointList = `${DAILY_CHECKPOINTS.slice(0, -1).join(', ')} và ${DAILY_CHECKPOINTS[DAILY_CHECKPOINTS.length - 1]}`;

/**
 * Báo cáo vận hành định kỳ (ảnh thiết kế màn Báo cáo) – ghép từ các khối dùng chung `./shared`:
 * KPI · 4 thẻ tóm tắt · tab loại báo cáo + bảng. Tab mở sẵn: Báo cáo ngày. Lọc / phân trang / đếm / KPI ở MÁY CHỦ
 * (`data/reportApi.ts`): trang chỉ giữ một trang dòng + số liệu tóm tắt.
 */
export default function ReportsPage() {
  // "Hôm nay"/mốc tới hạn theo giờ nhà máy – cập nhật mỗi phút; truy vấn cũng tải lại ngầm mỗi phút.
  const now = useNow(60_000);
  const table = useReportTable(DEFAULT_TAB, now);
  const summary = useReportSummary(now);
  const { status, error, refetch } = combineQueries(table.list, summary);
  const tableRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // TODO(backend): chỉ đúng Người kiểm tra của báo cáo được ký (hiện: mọi vai trò có report:sign).
  const canSignRole = useCan('report:sign');

  // ---- Ký xác nhận (?sign=<mã>): chỉ báo cáo ngày đang chờ Người kiểm tra; mã lạ / đã qua bước → không mở.
  const signCode = table.search.get('sign');
  const signReport = useDailyReportByCode(canSignRole ? signCode : null).data;
  const signOpen = signReport && canInspectorSign(signReport, now) ? signReport : undefined;
  const closeSign = () => table.setExtra({ sign: null });

  const upcoming = useMemo(() => deriveUpcomingDeadlines(now), [now]);

  const year = plantDayKey(now).slice(0, 4);
  const tabNotes: Partial<Record<ReportTab, string>> = {
    all: `Tất cả báo cáo ngày, tháng, quý và năm ${year}.`,
    daily: `Báo cáo ngày bao gồm ${DAILY_CHECKPOINTS.length} mốc kiểm tra: ${checkpointList}.`,
    monthly: 'Báo cáo tháng tổng hợp các báo cáo ngày trong tháng – mỗi ngày đủ dữ liệu là một mốc.',
    quarterly: 'Báo cáo quý tổng hợp 3 báo cáo tháng trong quý.',
    yearly: 'Báo cáo năm tổng hợp 4 báo cáo quý trong năm.',
    signed: 'Biểu mẫu đã đủ chữ ký Người kiểm tra, Người duyệt và Ban TAP.',
  };

  /** Bỏ mọi bộ lọc (giữ số dòng mỗi trang) rồi áp `patch` – MỘT lần ghi URL (hai lần ghi liền nhau sẽ đè nhau). */
  const filterOnly = (patch: Parameters<typeof table.setValues>[0]) =>
    table.setValues({ tab: 'all', q: '', date: null, shift: null, completion: null, signature: null, inspector: null, approver: null, ...patch });

  const showTable = (message: string) => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    announce(message);
  };

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Báo cáo', to: '/reports' }, { label: 'Báo cáo vận hành định kỳ' }]}
      title="Báo cáo vận hành định kỳ"
      // Ảnh ghi "Theo dõi, phân công và quản lý tiến độ bảo trì…" (chép từ màn Bảo trì) → viết lại cho báo cáo; docs/questions.md.
      description="Theo dõi tiến độ, chữ ký và dữ liệu thiếu của báo cáo vận hành ngày, tháng, quý và năm trong hệ thống LPG"
    />
  );

  const result = table.list.data;
  const s = summary.data;
  if (status !== 'success' || !result || !s)
    return pageFallback(
      { status: status === 'error' ? 'error' : 'loading', error, refetch },
      { header, errorTitle: 'Không tải được danh sách báo cáo', skeleton: [100, 262, 560] },
    );
  const { kpis, awaitingByStep, monthProgress, actions } = s;

  return (
    <Page pageHeader={header}>
      <ReportKpiRow kpis={kpis} />
      <ReportSummaryCards
        awaitingByStep={awaitingByStep}
        monthProgress={monthProgress}
        upcoming={upcoming}
        actions={actions}
        onShowAwaiting={() => {
          filterOnly({ signature: 'awaiting' });
          showTable(`Đang lọc ${kpis.awaiting} báo cáo chờ xác nhận.`);
        }}
        onAction={(id) => {
          const item = actions.find((a) => a.id === id);
          if (!item) return;
          filterOnly({ q: item.reportCode });
          showTable(`Đang hiển thị báo cáo ${item.reportCode}.`);
        }}
      />
      <ReportTableSection
        ref={tableRef}
        table={table}
        result={result}
        now={now}
        tabNotes={tabNotes}
        label="Danh sách báo cáo vận hành"
        onSign={canSignRole ? (r) => table.setExtra({ sign: r.code }) : undefined}
        canSign={(r) => canInspectorSign(r, now)}
      />
      {signOpen && (
        <ReportSignModal
          key={signOpen.id}
          report={signOpen}
          onClose={closeSign}
          onBackToEdit={() => void navigate(reportDetailPath(signOpen)!)}
          nowParam={table.search.get('now')}
        />
      )}
    </Page>
  );
}
