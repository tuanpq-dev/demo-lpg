import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, DatePicker, FilterBar, Icon, PageHeader, StatusDot, type FilterDef } from '@/components';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { useCan } from '@/app/auth';
import { useTableFilters } from '@/app/useTableFilters';
import { useDailyReport } from '@/data/dailyReport';
import {
  DAILY_DETAIL_PARAMS,
  DAILY_GROUPS,
  ROW_RESULTS,
  canRecordCheckpoint,
  ROW_RESULT_LABEL,
  checkpointStates,
  completionOf,
  deriveDailyCards,
  formatUpdatedAt,
  matchReadingRow,
  periodLabel,
  reportCode,
  signatureOf,
  weekdayVi,
  type DailyCard,
  type DailyGroupId,
  type DailyReadingRow,
  type ReportRecord,
  type RowResult,
} from '@/features/reports';
import { plantDayKey } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import NotFoundPage from '../errors/NotFoundPage';
import { CheckpointRecordModal } from './daily/CheckpointRecordModal';
import { CheckpointTimeline } from './daily/CheckpointTimeline';
import { DailyReadingsTable, FIELD_NOTE } from './daily/DailyReadingsTable';
import { CompletionBadge, SignatureBadge } from './shared/ReportBadges';
import { ReportStatCards, type ReportStatCard } from './shared/ReportStatCards';

const LIST_PATH = '/reports';
const BREADCRUMB_LIST = [
  { label: 'Báo cáo', to: LIST_PATH },
  { label: 'Báo cáo vận hành định kỳ', to: LIST_PATH },
] as const;

/** Icon thẻ theo trạng thái (asset Figma 117:4367; tam giác/chấm than đổi màu khi có vấn đề). */
function cardIcon(c: DailyCard) {
  switch (c.id) {
    case 'progress':
      return <Icon name="reportProgress" />;
    case 'confirmed':
      return <Icon name={c.tone === 'success' ? 'reportConfirmed' : 'reportMissing'} />;
    case 'abnormal':
      return <Icon name={c.tone === 'success' ? 'reportAbnormalNone' : 'danger'} />;
    case 'missing':
      return <Icon name={c.tone === 'success' ? 'reportConfirmed' : 'reportMissing'} />;
    case 'signature':
      return <Icon name="reportSignature" />;
  }
}

const filterDefs: FilterDef[] = [
  { id: 'group', label: 'Nhóm thiết bị', allLabel: 'Tất cả', options: DAILY_GROUPS.map((g) => ({ value: g.id, label: g.label })) },
  { id: 'result', label: 'Kết quả', allLabel: 'Tất cả', options: ROW_RESULTS.map((r) => ({ value: r, label: ROW_RESULT_LABEL[r] })) },
];

const match = (r: DailyReadingRow, v: Parameters<typeof matchReadingRow>[1]) => matchReadingRow(r, v);
const getId = (r: DailyReadingRow) => r.id;

/**
 * Chi tiết báo cáo ngày (`/reports/daily/:code`, Figma A88YJ2BRhICDDdeu2rtRg1 – 117:4250): 5 thẻ tóm tắt · dải 6 mốc ·
 * bảng số liệu theo nhóm thiết bị có lọc (URL `q`, `group`, `result`). Ô "Ngày báo cáo" chuyển sang báo cáo ngày khác.
 * Mã lạ / ngày chưa có báo cáo → "Không tìm thấy báo cáo".
 */
export default function DailyReportDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const now = useNow(60_000);
  const state = useDailyReport(code);

  const header = () => <PageHeader breadcrumb={[...BREADCRUMB_LIST, { label: code.toUpperCase() }]} title="Chi tiết báo cáo ngày" />;

  if (state.status === 'not-found') {
    return (
      <NotFoundPage
        title="Không tìm thấy báo cáo"
        breadcrumb={[...BREADCRUMB_LIST, { label: code.toUpperCase() }]}
        message={
          <>
            Không có báo cáo ngày mã <code className="font-mono text-fg">{code}</code>. Báo cáo ngày chỉ có từ 01/01 năm nay tới hôm nay.
          </>
        }
        actions={<Button onClick={() => void navigate(LIST_PATH)}>Về danh sách báo cáo</Button>}
      />
    );
  }

  if (state.status !== 'success') {
    return pageFallback(state, { header: header(), errorTitle: 'Không tải được báo cáo', skeleton: [133, 120, 560] });
  }

  const goToDay = (day: string) => {
    if (day) void navigate(`/reports/daily/${reportCode('daily', day)}${search}`);
  };

  return <DailyReportView report={state.report} readings={state.readings} now={now} onDayChange={goToDay} />;
}

function DailyReportView({
  report: r,
  readings,
  now,
  onDayChange,
}: {
  report: ReportRecord;
  readings: DailyReadingRow[];
  now: Date;
  onDayChange: (day: string) => void;
}) {
  const checkpoints = useMemo(() => checkpointStates(r, now), [r, now]);
  const cards: ReportStatCard[] = useMemo(() => deriveDailyCards(r, readings, now).map((c) => ({ ...c, icon: cardIcon(c) })), [r, readings, now]);
  const table = useTableFilters({ rows: readings, getId, params: DAILY_DETAIL_PARAMS, match, pageSize: 1000 });
  const f = table.values;
  const today = plantDayKey(now);

  // ---- Ghi nhận mốc (?record=<mốc>): chỉ mốc đã tới hạn chưa có dữ liệu; mốc lạ / đã ghi / thiếu quyền → không mở.
  const canRecord = useCan('report:record');
  const recordKey = table.search.get('record');
  const recordOpen = canRecord && recordKey && canRecordCheckpoint(r, recordKey, now) ? recordKey : null;
  const openRecord = canRecord ? (key: string) => table.setExtra({ record: key }) : undefined;
  const firstMissing = checkpoints.find((c) => c.state === 'missing');

  const header = (
    <PageHeader
      breadcrumb={[...BREADCRUMB_LIST, { label: r.code }]}
      title="Chi tiết báo cáo ngày"
      description={
        <>
          {r.code} · {weekdayVi(r.periodKey)}, {periodLabel(r.period, r.periodKey)}
          {r.shift && ` · ${r.shift}`} · Người kiểm tra: {r.inspector} · Người duyệt: {r.approver ?? 'Chưa chỉ định'} · Cập nhật{' '}
          {formatUpdatedAt(r.updatedAt)}
        </>
      }
      actions={
        <>
          {openRecord && firstMissing && (
            <Button variant="primary" onClick={() => openRecord(firstMissing.key)}>
              Ghi nhận mốc {firstMissing.label}
            </Button>
          )}
          <CompletionBadge status={completionOf(r, now)} />
          <SignatureBadge status={signatureOf(r, now)} />
        </>
      }
    />
  );

  return (
    <Page pageHeader={header}>
      <ReportStatCards cards={cards} label={`Tóm tắt báo cáo ${r.code}`} />
      <CheckpointTimeline items={checkpoints} onRecord={openRecord} />

      <Card padding="none" radius="lg" title="Số liệu kiểm tra theo mốc" headerEnd={<Legend />}>
        <FilterBar
          layout="inline"
          search={f.q ?? ''}
          onSearchChange={(q) => table.setValues({ q })}
          searchPlaceholder="Hạng mục, thiết bị..."
          leading={
            <DatePicker
              hideLabel
              label="Ngày báo cáo"
              value={r.periodKey}
              min={`${today.slice(0, 4)}-01-01`}
              max={today}
              onChange={onDayChange}
              className="w-[150px]"
            />
          }
          filters={filterDefs}
          values={{ group: f.group, result: f.result }}
          onValuesChange={(v) => table.setValues({ group: (v.group as DailyGroupId | null) ?? null, result: (v.result as RowResult | null) ?? null })}
          onClear={() => table.reset()}
          clearDisabled={!table.isFiltered()}
        />
        <DailyReadingsTable rows={table.filtered} checkpoints={checkpoints} label={`Số liệu kiểm tra ${r.code}`} />
      </Card>
      {recordOpen && (
        <CheckpointRecordModal key={`${r.id}@${recordOpen}`} report={r} checkpoint={recordOpen} onClose={() => table.setExtra({ record: null })} />
      )}
    </Page>
  );
}

/** Chú giải ký hiệu ô giờ (icon trong ô là trang trí – nghĩa nằm ở đây). */
function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
      <li className="inline-flex items-center gap-1.5">
        <Icon name="reportReadingAuto" box={12} />
        Số đo tự động (SCADA)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <StatusDot status="verify" size="sm" />
        Đọc tại chỗ – {FIELD_NOTE}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true">—</span>
        Chưa có dữ liệu
      </li>
    </ul>
  );
}
