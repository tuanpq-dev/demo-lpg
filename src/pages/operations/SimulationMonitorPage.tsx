import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, Button, Card, EmergencyBanner, PageHeader, StopCircleIcon, buttonClass, type BreadcrumbItem } from '@/components';
import { SIMULATION_PATH, simulationConfigPath, simulationResultPath } from '@/app/assetRoutes';
import { useCan } from '@/app/auth';
import { Page } from '@/app/Page';
import { PageError, Placeholder } from '@/app/Placeholder';
import { SIMULATION_REFERENCE_TAGS, stopSimulation, useSimulation } from '@/data/simulation';
import { dataSyncState } from '@/features/simulation/config';
import { isActivePhase, monitorSnapshot, sessionOf, type SimulationSession } from '@/features/simulation/monitor';
import { RUN_RESULT_LABEL, suggestionConfidence, tagHealth, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/useNow';
import NotFoundPage from '../NotFoundPage';
import {
  MonitorHeaderMeta,
  MonitorKpis,
  MonitorStatusCard,
  MonitorSuggestionCard,
  MonitorTimelineCard,
  PhaseBadge,
  ReferenceSnapshotCard,
  SimAlertsCard,
  SimulationTrendCard,
} from './simulation/MonitorCards';

const TITLE = 'Theo dõi diễn biến mô phỏng';
const DESCRIPTION = 'Mô phỏng các tình huống bất thường trong hệ thống LPG để đánh giá phản ứng vận hành và gợi ý xử lý an toàn.';
const crumbs = (code: string, configTo?: string): BreadcrumbItem[] => [
  { label: 'Vận hành' },
  { label: 'AI mô phỏng sự cố', to: SIMULATION_PATH },
  { label: code, to: configTo },
  { label: 'Theo dõi mô phỏng' },
];

/** Route `/operations/ai-simulation/:scenarioId/monitor` – mã không phân biệt hoa thường; mã lạ → "Không tìm thấy kịch bản". */
export default function SimulationMonitorRoute() {
  const { scenarioId = '' } = useParams();
  return <SimulationMonitorPage key={scenarioId.toUpperCase()} scenarioId={scenarioId} />;
}

function SimulationMonitorPage({ scenarioId }: { scenarioId: string }) {
  const sim = useSimulation();
  const [params] = useSearchParams();
  // Đồng hồ lượt chạy theo giây (giờ ứng dụng – `?now=` dời được, vẫn chạy).
  const now = useNow(1000).getTime();
  const scenario = sim.scenarios?.find((s) => s.id.toUpperCase() === scenarioId.toUpperCase());
  const back = (
    <Link to={SIMULATION_PATH} className={buttonClass('ghost')}>
      <ArrowLeftIcon size={16} />
      Quay lại danh sách
    </Link>
  );
  const plainHeader = <PageHeader breadcrumb={crumbs(scenario?.code ?? scenarioId)} title={TITLE} description={DESCRIPTION} actions={back} />;

  if (sim.status === 'error') {
    return (
      <Page pageHeader={plainHeader}>
        <PageError title="Không tải được lượt mô phỏng" error={sim.error} onRetry={sim.refetch} />
      </Page>
    );
  }
  if (sim.status === 'loading') {
    return (
      <Page pageHeader={plainHeader}>
        <Placeholder label="Đang tải…" height={64} />
        <Placeholder label="Đang tải…" height={110} />
        <Placeholder label="Đang tải…" height={720} />
      </Page>
    );
  }
  if (!scenario) {
    return (
      <NotFoundPage
        title="Không tìm thấy kịch bản"
        breadcrumb={crumbs(scenarioId || '—')}
        message={`Không có kịch bản mô phỏng "${scenarioId}". Kịch bản đang có: ${sim.scenarios.map((s) => s.code).join(', ')}.`}
        actions={back}
      />
    );
  }
  // `?session=` (link "Quay lại theo dõi" từ màn kết quả) → đúng lượt đó; không có → lượt đang chạy / gần nhất.
  const wanted = params.get('session');
  const session = (wanted && sim.sessions.find((x) => x.id === wanted && x.scenarioId === scenario.id)) || sessionOf(scenario.id, sim.sessions, now);
  if (!session) {
    return (
      <Page pageHeader={<PageHeader breadcrumb={crumbs(scenario.code, simulationConfigPath(scenario.id))} title={TITLE} description={DESCRIPTION} actions={back} />}>
        <Card title="Chưa có lượt mô phỏng" headerVariant="plain" radius="lg">
          <p className="mb-4 text-base text-fg-secondary">
            Kịch bản {scenario.code} – {scenario.title} chưa có lượt mô phỏng nào. Bắt đầu chạy từ màn cấu hình kịch bản.
          </p>
          <Link to={simulationConfigPath(scenario.id)} className={cn(buttonClass('primary'), 'self-start')}>
            Cấu hình và chạy mô phỏng
          </Link>
        </Card>
      </Page>
    );
  }
  return <MonitorView scenario={scenario} session={session} scenarios={sim.scenarios} runs={sim.runs} live={sim.liveData} now={now} back={back} />;
}

type MonitorViewProps = {
  scenario: Scenario;
  session: SimulationSession;
  scenarios: readonly Scenario[];
  runs: readonly SimulationRun[];
  live: ReturnType<typeof useSimulation>['liveData'];
  now: number;
  back: ReactNode;
};

/**
 * Theo dõi diễn biến mô phỏng (ảnh người dùng gửi 03/11/2026 – `scratch/figma-ref/ai-sim-monitor/`; Figma không đọc được):
 * header (huy hiệu trạng thái · Mã / Mức độ / Kịch bản / Thời lượng · Dừng mô phỏng) → banner → 5 KPI → [biểu đồ diễn biến ·
 * cảnh báo mô phỏng | timeline · gợi ý AI | trạng thái mô phỏng · dữ liệu PLC/SCADA tham chiếu]. Mọi số suy từ lượt chạy
 * (`monitorSnapshot`) tại `now`; dữ liệu thật chỉ là ảnh chụp lúc bắt đầu + tình trạng 21 tag.
 */
function MonitorView({ scenario: s, session, scenarios, runs, live, now, back }: MonitorViewProps) {
  const canRun = useCan('simulation:run');
  const [stopping, setStopping] = useState(false);
  // Mất tín hiệu so `ts` với giờ THẬT (không theo ?now=) – CLAUDE.md "Dữ liệu trực tiếp".
  const realNow = Date.now();
  const snap = monitorSnapshot(s, s.setup.monitor, session, now);
  const active = isActivePhase(snap.phase);

  const health = tagHealth(SIMULATION_REFERENCE_TAGS, live, realNow);
  const healthKey = health ? `${health.ok}/${health.bad}/${health.missing}/${health.stale}` : 'pending';
  const nowMinute = Math.floor(now / 60_000);
  const confidence = useMemo(
    () => (health ? suggestionConfidence(scenarios, runs, health, new Date(nowMinute * 60_000)) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `health` đổi object mỗi giây; khoá theo nội dung
    [scenarios, runs, healthKey, nowMinute],
  );
  const run = session.runId ? runs.find((r) => r.id === session.runId) : undefined;

  // Thông báo động: cảnh báo mô phỏng mới, gợi ý AI, kết thúc lượt (không đọc đồng hồ mỗi giây).
  const alertCount = snap.alerts.length;
  const hasAi = snap.recommendations.length > 0;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return;
    if (alertCount > 0) announce(`Cảnh báo mô phỏng mới: ${snap.alerts[0]!.id} – ${snap.alerts[0]!.title}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi số cảnh báo đổi
  }, [alertCount]);
  useEffect(() => {
    if (!first.current && hasAi) announce(`AI đã tạo ${snap.recommendations.length} gợi ý xử lý mô phỏng.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi có gợi ý
  }, [hasAi]);
  useEffect(() => {
    if (!first.current && !active) announce(`${s.code}: ${snap.phase === 'stopped' ? 'đã dừng' : 'kết thúc'} mô phỏng. Kết quả đã lưu vào lịch sử.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi lượt kết thúc
  }, [active]);
  useEffect(() => {
    first.current = false;
  }, []);

  const onStop = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await stopSimulation(session.id);
    } catch (e) {
      announce(e instanceof Error ? e.message : 'Không dừng được mô phỏng.');
    } finally {
      setStopping(false);
    }
  };

  const header = (
    <PageHeader
      breadcrumb={crumbs(s.code, simulationConfigPath(s.id))}
      title={TITLE}
      titleEnd={<PhaseBadge phase={snap.phase} />}
      description={DESCRIPTION}
      actions={
        <>
          <MonitorHeaderMeta scenario={s} session={session} />
          {active && canRun ? (
            <Button variant="outline" icon={<StopCircleIcon size={18} />} aria-busy={stopping || undefined} onClick={() => void onStop()}>
              {stopping ? 'Đang dừng…' : 'Dừng mô phỏng'}
            </Button>
          ) : !active ? (
            <>
              {back}
              <Link to={simulationConfigPath(s.id)} className={buttonClass('ghost')}>
                Cấu hình và chạy lại
              </Link>
              {session.runId && (
                <Link to={simulationResultPath(s.id, session.id)} className={buttonClass('primary')}>
                  Xem kết quả mô phỏng
                </Link>
              )}
            </>
          ) : null}
        </>
      }
    />
  );

  return (
    <Page pageHeader={header}>
      <EmergencyBanner
        tone="warning"
        title="Chế độ mô phỏng — không tác động thiết bị thật"
        text="Toàn bộ kịch bản chỉ chạy trên dữ liệu mô phỏng và dữ liệu tham chiếu PLC/SCADA. Hệ thống không gửi lệnh điều khiển đến thiết bị thực tế."
      />
      {!active && run && (
        <p role="status" className="rounded-lg border border-line/30 bg-surface px-4 py-3 text-base text-fg">
          Kết quả lượt: <strong className={run.result === 'pass' ? 'text-success' : 'text-warning'}>{RUN_RESULT_LABEL[run.result]}</strong> – {run.note}
        </p>
      )}

      <MonitorKpis scenario={s} snap={snap} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px] wide:grid-cols-[minmax(0,1fr)_390px] wide:gap-6">
        <div className="flex min-w-0 flex-col gap-4 wide:gap-6">
          <SimulationTrendCard scenario={s} session={session} snap={snap} />
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 wide:gap-8">
            <SimAlertsCard scenario={s} snap={snap} />
            <MonitorTimelineCard snap={snap} />
          </div>
          <MonitorSuggestionCard scenario={s} snap={snap} confidence={confidence} />
        </div>
        <aside aria-label="Trạng thái và dữ liệu tham chiếu" className="flex min-w-0 flex-col gap-4">
          <MonitorStatusCard scenario={s} session={session} snap={snap} />
          <ReferenceSnapshotCard rows={session.reference} sync={dataSyncState(health)} health={health} />
        </aside>
      </div>
    </Page>
  );
}
