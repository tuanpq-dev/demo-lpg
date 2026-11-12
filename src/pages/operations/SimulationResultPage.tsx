import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, EmergencyBanner, Modal, PageHeader, buttonClass, type BreadcrumbItem } from '@/components';
import { simulationConfigPath, simulationMonitorPath } from '@/app/assetRoutes';
import { useCan } from '@/app/auth';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { updateSessionReport, useSimulation } from '@/data/simulation';
import { formatVariable, lowerFirst } from '@/features/simulation/config';
import { finishedSessionOf, isActivePhase, sessionCode, sessionPhase, type SimulationSession } from '@/features/simulation/monitor';
import { CHECK_LABEL, areaAssetText, reportStatusText, resultCsv, resultFileName, simulationResult } from '@/features/simulation/result';
import type { Scenario, SimulationRun } from '@/features/simulation/scenarios';
import { announce } from '@/lib/announce';
import { plantTimeOfDay } from '@/lib/plantTime';
import { useNow } from '@/lib/useNow';
import { OverviewCard, ResultInfoStrip, ResultKpis, ResultTimelineCard, ResultTrendCard } from './simulation/ResultCards';
import { CriteriaCard, PointsCards, ReportCard, ResultAdviceCard, ResultAlertsCard, ResultReferenceCard } from './simulation/ResultDetailCards';
import { BackLink, ScenarioNotFound, useSuggestionConfidence } from './simulation/shared';
import { downloadCsv } from '@/lib/download';
import { errorMessage } from '@/lib/actionError';

const TITLE = 'Kết quả mô phỏng';
const PDF_REASON = 'Xuất PDF cần máy chủ tạo tệp – chờ backend. Dùng "Xuất Excel" hoặc "Xem trước".';
const crumbs = (code: string, to?: string): BreadcrumbItem[] => [{ label: 'Vận hành' }, { label: code, to }, { label: TITLE }];

/**
 * Route `/operations/ai-simulation/:scenarioId/result` (`?session=` chọn lượt; mặc định lượt đã kết thúc gần nhất;
 * `?preview=1` mở "Xem trước"). Mã không phân biệt hoa thường; mã lạ → "Không tìm thấy kịch bản".
 */
export default function SimulationResultRoute() {
  const { scenarioId = '' } = useParams();
  return <SimulationResultPage key={scenarioId.toUpperCase()} scenarioId={scenarioId} />;
}

function SimulationResultPage({ scenarioId }: { scenarioId: string }) {
  const sim = useSimulation();
  const [params] = useSearchParams();
  const now = useNow(1000).getTime();
  const scenario = sim.scenarios?.find((s) => s.id.toUpperCase() === scenarioId.toUpperCase());
  const sessionParam = params.get('session');
  const monitorTo = `${simulationMonitorPath(scenario?.id ?? scenarioId)}${sessionParam ? `?session=${encodeURIComponent(sessionParam)}` : ''}`;
  const back = <BackLink to={monitorTo} label="Quay lại theo dõi" />;
  const description = scenario ? `Tổng kết phiên mô phỏng ${lowerFirst(scenario.title)} và đánh giá phản ứng của hệ thống.` : undefined;
  const plainHeader = <PageHeader breadcrumb={crumbs(scenario?.code ?? scenarioId)} title={TITLE} description={description} actions={back} />;

  if (sim.status !== 'success')
    return pageFallback(sim, { header: plainHeader, errorTitle: 'Không tải được kết quả mô phỏng', skeleton: [64, 110, 900] });
  if (!scenario) {
    return <ScenarioNotFound scenarioId={scenarioId} scenarios={sim.scenarios} breadcrumb={crumbs(scenarioId || '—')} actions={back} />;
  }
  const wanted = sessionParam;
  const picked = wanted ? sim.sessions.find((x) => x.id === wanted && x.scenarioId === scenario.id) : finishedSessionOf(scenario.id, sim.sessions);
  // "Quay lại theo dõi" mở đúng lượt đang xem (không nhảy sang lượt khác đang chạy).
  const backToPicked = picked ? (
    <BackLink to={`${simulationMonitorPath(scenario.id)}?session=${encodeURIComponent(picked.id)}`} label="Quay lại theo dõi" />
  ) : (
    back
  );
  const header = (
    <PageHeader
      breadcrumb={crumbs(scenario.code, simulationConfigPath(scenario.id))}
      title={TITLE}
      description={description}
      actions={backToPicked}
    />
  );
  if (!picked || isActivePhase(sessionPhase(picked, now)) || !picked.runId) {
    return (
      <Page pageHeader={header}>
        <NoResultCard
          scenario={scenario}
          running={picked && isActivePhase(sessionPhase(picked, now)) ? sessionCode(picked, sim.sessions) : undefined}
          wanted={wanted}
          monitorTo={monitorTo}
        />
      </Page>
    );
  }
  return (
    <ResultView
      scenario={scenario}
      session={picked}
      sessions={sim.sessions}
      scenarios={sim.scenarios}
      runs={sim.runs}
      live={sim.liveData}
      now={now}
      header={header}
    />
  );
}

type ResultViewProps = {
  scenario: Scenario;
  session: SimulationSession;
  sessions: readonly SimulationSession[];
  scenarios: readonly Scenario[];
  runs: readonly SimulationRun[];
  live: ReturnType<typeof useSimulation>['liveData'];
  now: number;
  header: ReactNode;
};

/**
 * Kết quả mô phỏng (ảnh người dùng gửi – `scratch/figma-ref/ai-sim-result/`; Figma không đọc được): thông tin phiên →
 * banner → 5 KPI → [Đánh giá tổng quan · biểu đồ · dòng thời gian · bảng tiêu chí · điểm làm tốt / cần cải thiện | Gợi ý AI ·
 * cảnh báo đã tạo · dữ liệu tham chiếu · báo cáo]. Mọi số suy từ lượt + bản ghi lịch sử (`simulationResult`).
 */
function ResultView({ scenario: s, session, sessions, scenarios, runs, live, now, header }: ResultViewProps) {
  const canEdit = useCan('simulation:run');
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const run = runs.find((r) => r.id === session.runId);
  const r = useMemo(() => simulationResult(s, session, run, now), [s, session, run, now]);
  const code = sessionCode(session, sessions);
  const fileName = resultFileName(code, 'pdf');
  const report = session.report ?? {};

  // Độ tin cậy dùng chung công thức màn danh sách (tình trạng 21 tag theo giờ THẬT).
  const confidence = useSuggestionConfidence(scenarios, runs, live, now);

  const patchReport = async (patch: Parameters<typeof updateSessionReport>[1], message: string) => {
    setBusy(true);
    try {
      await updateSessionReport(session.id, patch);
      announce(message);
    } catch (e) {
      announce(errorMessage(e, 'Không cập nhật được báo cáo.'));
    } finally {
      setBusy(false);
    }
  };

  const onExcel = () => {
    downloadCsv(resultCsv(s, session, code, r), resultFileName(code, 'csv'));
    void patchReport({ excelAt: new Date(now).toISOString() }, `Đã xuất ${resultFileName(code, 'csv')}.`);
  };

  const previewOpen = params.get('preview') === '1';
  const setPreview = (open: boolean) =>
    setParams(
      (cur) => {
        const next = new URLSearchParams(cur);
        if (open) next.set('preview', '1');
        else next.delete('preview');
        return next;
      },
      { replace: true },
    );
  const pdfReasonId = `${useId()}-pdf`;

  return (
    <Page pageHeader={header}>
      <ResultInfoStrip scenario={s} session={session} code={code} stopped={r.stopped} />
      <EmergencyBanner
        tone="warning"
        title="Kết quả mô phỏng — không phải sự cố vận hành thật"
        text="Kết quả này được tạo từ dữ liệu mô phỏng và dữ liệu tham chiếu PLC/SCADA. Không có lệnh điều khiển nào được gửi đến thiết bị thật"
      />
      <ResultKpis result={r} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px] wide:grid-cols-[minmax(0,1fr)_484px] wide:gap-6">
        <div className="flex min-w-0 flex-col gap-4 wide:gap-6">
          <OverviewCard result={r} />
          <ResultTrendCard scenario={s} session={session} result={r} />
          <ResultTimelineCard events={r.events} />
          <CriteriaCard criteria={r.criteria} />
          <PointsCards strengths={s.setup.monitor.result.strengths} improvements={s.setup.monitor.result.improvements} />
        </div>
        <aside aria-label="Gợi ý, cảnh báo và báo cáo" className="flex min-w-0 flex-col gap-4 wide:gap-6">
          <ResultAdviceCard
            advice={r.advice}
            confidence={confidence}
            included={!!report.aiIncluded}
            dismissed={!!report.aiDismissed}
            canEdit={canEdit}
            busy={busy}
            onInclude={() => void patchReport({ aiIncluded: true, aiDismissed: false }, 'Đã thêm gợi ý AI vào báo cáo nháp.')}
            onDismiss={() => void patchReport({ aiDismissed: true, aiIncluded: false }, 'Đã bỏ qua gợi ý AI.')}
            onUndo={() =>
              void patchReport({ aiIncluded: false, aiDismissed: false }, report.aiIncluded ? 'Đã bỏ gợi ý AI khỏi báo cáo.' : 'Hiện lại gợi ý AI.')
            }
          />
          <ResultAlertsCard alerts={r.alerts} />
          <ResultReferenceCard session={session} />
          <ReportCard
            fileName={fileName}
            status={reportStatusText(session, (iso) => plantTimeOfDay(new Date(iso)).slice(0, 5))}
            canExport={canEdit}
            pdfReasonId={pdfReasonId}
            pdfReason={PDF_REASON}
            onPreview={() => setPreview(true)}
            onExcel={onExcel}
          />
        </aside>
      </div>

      {previewOpen && (
        <Modal
          open
          onClose={() => setPreview(false)}
          title="Xem trước báo cáo mô phỏng"
          description={`${fileName} – ${reportStatusText(session)}`}
          size="lg"
          footer={
            canEdit ? (
              <Button variant="primary" onClick={onExcel}>
                Xuất Excel
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-col gap-4 text-base text-fg">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {[
                ['Mã phiên', code],
                ['Kịch bản', `${s.code} – ${s.title}`],
                ['Khu vực / Tài sản chính', areaAssetText(s, session)],
                ['Người chạy', session.by],
                ['Thời lượng / Mục tiêu', `${session.config.durationMin} phút / ${formatVariable(session.config.target, s.setup.variable)}`],
                ['Kết quả', r.kpis[0]!.value],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-sm text-fg-secondary">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <section aria-label="Tổng kết">
              <h3 className="mb-1 text-md font-semibold">Tổng kết</h3>
              <p className="text-fg-secondary">{r.summary}</p>
            </section>
            <section aria-label="Tiêu chí đánh giá">
              <h3 className="mb-1 text-md font-semibold">Đánh giá phản ứng hệ thống</h3>
              <ul className="flex flex-col gap-1">
                {r.criteria.map((c) => (
                  <li key={c.id}>
                    {c.label}: <span className={c.result === 'pass' ? 'text-success' : 'text-warning'}>{CHECK_LABEL[c.result]}</span> – {c.comment}
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Sự kiện">
              <h3 className="mb-1 text-md font-semibold">Dòng thời gian</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {r.events.map((e) => (
                  <li key={e.id}>
                    <span className="tabular-nums text-fg-secondary">{e.time}</span> {e.title} – {e.detail}
                  </li>
                ))}
              </ul>
            </section>
            {report.aiIncluded && (
              <section aria-label="Gợi ý AI trong báo cáo">
                <h3 className="mb-1 text-md font-semibold">Gợi ý từ AI</h3>
                <p className="text-fg-secondary">{r.advice}</p>
              </section>
            )}
          </div>
        </Modal>
      )}
    </Page>
  );
}

/** Chưa có kết quả: lượt còn đang chạy (→ theo dõi) · không tìm thấy lượt `?session=` · kịch bản chưa có lượt nào kết thúc. */
function NoResultCard({ scenario, running, wanted, monitorTo }: { scenario: Scenario; running?: string; wanted: string | null; monitorTo: string }) {
  const text = running
    ? `Lượt ${running} chưa kết thúc – kết quả có khi hết thời lượng hoặc dừng mô phỏng.`
    : wanted
      ? `Không tìm thấy lượt "${wanted}" của kịch bản ${scenario.code}.`
      : `Kịch bản ${scenario.code} chưa có lượt mô phỏng nào kết thúc.`;
  return (
    <Card title={running ? 'Lượt mô phỏng đang chạy' : 'Chưa có kết quả mô phỏng'} headerVariant="plain" radius="lg">
      <p className="mb-4 text-base text-fg-secondary">{text}</p>
      <Link to={running ? monitorTo : simulationConfigPath(scenario.id)} className={`${buttonClass('primary')} self-start`}>
        {running ? 'Theo dõi lượt đang chạy' : 'Cấu hình và chạy mô phỏng'}
      </Link>
    </Card>
  );
}
