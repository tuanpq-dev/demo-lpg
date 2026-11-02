import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader } from '@/components';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { useCan } from '@/app/auth';
import { findDailyReport, reportDetailPath } from '@/data/dailyReport';
import { useReports } from '@/data/reports';
import {
  DAILY_CHECKPOINTS,
  canInspectorSign,
  deriveAwaitingByStep,
  deriveMonthProgress,
  deriveReportKpis,
  deriveTodayActions,
  deriveUpcomingDeadlines,
  type ReportTab,
} from '@/features/reports';
import { announce } from '@/lib/announce';
import { plantDayKey } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import { ReportKpiRow } from './shared/ReportKpiRow';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportTableSection } from './shared/ReportTableSection';
import { useReportTable } from './shared/useReportTable';
import { ReportSignModal } from './sign/ReportSignModal';

const DEFAULT_TAB: ReportTab = 'daily';

const checkpointList = `${DAILY_CHECKPOINTS.slice(0, -1).join(', ')} và ${DAILY_CHECKPOINTS[DAILY_CHECKPOINTS.length - 1]}`;

/**
 * Báo cáo vận hành định kỳ (ảnh thiết kế màn Báo cáo) – ghép từ các khối dùng chung `./shared`:
 * KPI · 4 thẻ tóm tắt · tab loại báo cáo + bảng. Tab mở sẵn: Báo cáo ngày.
 */
export default function ReportsPage() {
  const { status, data, error, refetch } = useReports();
  const rows = useMemo(() => data ?? [], [data]);
  // "Hôm nay"/mốc tới hạn theo giờ nhà máy – cập nhật mỗi phút.
  const now = useNow(60_000);
  const table = useReportTable(rows, now, DEFAULT_TAB);
  const tableRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // TODO(backend): chỉ đúng Người kiểm tra của báo cáo được ký (hiện: mọi vai trò có report:sign).
  const canSignRole = useCan('report:sign');

  // ---- Ký xác nhận (?sign=<mã>): chỉ báo cáo ngày đang chờ Người kiểm tra; mã lạ / đã qua bước → không mở.
  const signCode = table.search.get('sign');
  const signReport = canSignRole && signCode ? findDailyReport(rows, signCode) : undefined;
  const signOpen = signReport && canInspectorSign(signReport, now) ? signReport : undefined;
  const closeSign = () => table.setExtra({ sign: null });

  const kpis = useMemo(() => deriveReportKpis(rows, now), [rows, now]);
  const awaitingByStep = useMemo(() => deriveAwaitingByStep(rows, now), [rows, now]);
  const monthProgress = useMemo(() => deriveMonthProgress(rows, now), [rows, now]);
  const upcoming = useMemo(() => deriveUpcomingDeadlines(now), [now]);
  const actions = useMemo(() => deriveTodayActions(rows, now), [rows, now]);

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

  if (status === 'error') {
    return (
      <Page pageHeader={header}>
        <Card title="Không tải được danh sách báo cáo" headerVariant="plain" tone="danger">
          <p className="mb-4 text-base text-fg-secondary">{error.message}</p>
          <Button onClick={refetch} className="self-start">
            Thử lại
          </Button>
        </Card>
      </Page>
    );
  }

  if (status === 'loading') {
    return (
      <Page pageHeader={header}>
        <Placeholder label="Đang tải…" height={100} />
        <Placeholder label="Đang tải…" height={262} />
        <Placeholder label="Đang tải…" height={560} />
      </Page>
    );
  }

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
          const report = item && rows.find((r) => r.id === item.reportId);
          if (!report) return;
          filterOnly({ q: report.code });
          showTable(`Đang hiển thị báo cáo ${report.code}.`);
        }}
      />
      <ReportTableSection
        ref={tableRef}
        table={table}
        rows={rows}
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
          onBackToEdit={() => navigate(reportDetailPath(signOpen)!)}
          nowParam={table.search.get('now')}
        />
      )}
    </Page>
  );
}
