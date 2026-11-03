import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, Button, Card, EmergencyBanner, PageHeader, PlayCircleSolidIcon, buttonClass, type BreadcrumbItem } from '@/components';
import { useAuth, useCan } from '@/app/auth';
import { SIMULATION_PATH } from '@/app/assetRoutes';
import { Page } from '@/app/Page';
import { Placeholder } from '@/app/Placeholder';
import { SIMULATION_REFERENCE_TAGS, runSimulation, saveScenarioConfig, useSimulation } from '@/data/simulation';
import {
  checkConfig,
  configSuggestion,
  configValid,
  dataSyncState,
  formatVariable,
  readiness as readinessOf,
  sameConfig,
  scenarioRuns,
  setupTags,
  startValue,
  suggestionApplied,
  type ScenarioConfig,
} from '@/features/simulation/config';
import { runBlocker, runSummary, suggestionConfidence, tagHealth, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';
import { announce } from '@/lib/announce';
import { useNow } from '@/lib/useNow';
import NotFoundPage from '../NotFoundPage';
import { ExpectedOutcomesCard, InputParamsCard, ReferenceDataCard, ScenarioInfoCard } from './simulation/ConfigCards';
import { ConfigSuggestionCard, ConfigSummaryCard, ReadinessCard, ScenarioHistoryCard } from './simulation/ConfigSideCards';
import { CONFIG_SAFETY_RULES, SafetyRulesCard } from './simulation/SimulationSideCards';

const BREADCRUMB_BASE: readonly BreadcrumbItem[] = [{ label: 'Vận hành' }, { label: 'AI mô phỏng sự cố', to: SIMULATION_PATH }, { label: 'Cấu hình kịch bản' }];
const TITLE = 'Cấu hình kịch bản mô phỏng';
const DESCRIPTION = 'Mô phỏng các tình huống bất thường trong hệ thống LPG để đánh giá phản ứng vận hành và gợi ý xử lý an toàn.';
const PENDING_HISTORY = 'Chưa có màn lịch sử đầy đủ – chờ thiết kế.';

/**
 * Route `/operations/ai-simulation/:scenarioId/config` – mã không phân biệt hoa thường (`sc-001` = SC-001);
 * mã lạ → "Không tìm thấy kịch bản". `key` theo mã: đổi kịch bản = form mới (state khởi tạo lại từ cấu hình đã lưu).
 */
export default function ScenarioConfigRoute() {
  const { scenarioId = '' } = useParams();
  return <ScenarioConfigPage key={scenarioId.toUpperCase()} scenarioId={scenarioId} />;
}

function ScenarioConfigPage({ scenarioId }: { scenarioId: string }) {
  const sim = useSimulation();
  const scenario = sim.scenarios?.find((s) => s.id.toUpperCase() === scenarioId.toUpperCase());
  const back = (
    <Link to={SIMULATION_PATH} className={buttonClass('ghost')}>
      <ArrowLeftIcon size={16} />
      Quay lại danh sách
    </Link>
  );
  const header = (
    <PageHeader breadcrumb={[...BREADCRUMB_BASE, { label: scenario?.code ?? scenarioId }]} title={TITLE} description={DESCRIPTION} actions={back} />
  );

  if (sim.status === 'error') {
    return (
      <Page pageHeader={header}>
        <Card title="Không tải được kịch bản mô phỏng" headerVariant="plain" tone="danger">
          <p className="mb-4 text-base text-fg-secondary">{sim.error.message}</p>
          <Button onClick={sim.refetch} className="self-start">
            Thử lại
          </Button>
        </Card>
      </Page>
    );
  }
  if (sim.status === 'loading') {
    return (
      <Page pageHeader={header}>
        <Placeholder label="Đang tải…" height={64} />
        <Placeholder label="Đang tải…" height={760} />
      </Page>
    );
  }
  if (!scenario) {
    return (
      <NotFoundPage
        title="Không tìm thấy kịch bản"
        breadcrumb={[...BREADCRUMB_BASE, { label: scenarioId || '—' }]}
        message={`Không có kịch bản mô phỏng "${scenarioId}". Kịch bản đang có: ${sim.scenarios.map((s) => s.code).join(', ')}.`}
        actions={back}
      />
    );
  }
  return <ConfigForm scenario={scenario} scenarios={sim.scenarios} runs={sim.runs} live={sim.liveData} back={back} />;
}

type ConfigFormProps = {
  scenario: Scenario;
  scenarios: readonly Scenario[];
  runs: readonly SimulationRun[];
  live: ReturnType<typeof useSimulation>['liveData'];
  back: ReactNode;
};

/**
 * Cấu hình kịch bản mô phỏng (ảnh người dùng gửi 03/11/2026 – `scratch/figma-ref/ai-sim-config/`; Figma không đọc được):
 * header (Quay lại · Lưu cấu hình · Bắt đầu chạy) → banner "Chế độ mô phỏng" → [Thông tin kịch bản · Tham số đầu vào · Dữ liệu
 * PLC/SCADA tham chiếu · Kết quả mong đợi | Tóm tắt cấu hình · Trạng thái sẵn sàng · Gợi ý từ AI · Quy tắc an toàn · Lịch sử
 * kịch bản này]. Tóm tắt / trạng thái theo cấu hình ĐANG SỬA. "Bắt đầu chạy" lưu thay đổi (nếu có) rồi chạy – kết quả vào lịch sử.
 */
function ConfigForm({ scenario: s, scenarios, runs, live, back }: ConfigFormProps) {
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const canConfigure = useCan('simulation:configure');
  const canRun = useCan('simulation:run');
  // Phút cho giờ phân tích (giờ nhà máy, ?now= dời được); giây để tag "cũ" chuyển trạng thái đúng lúc.
  const now = useNow(60_000);
  useNow(1000);
  // Mất tín hiệu so `ts` với giờ THẬT (không dùng ?now=) – CLAUDE.md "Dữ liệu trực tiếp".
  const realNow = Date.now();

  const [draft, setDraft] = useState<ScenarioConfig>(() => ({ ...s.config, areas: [...s.config.areas] }));
  const [busy, setBusy] = useState<'save' | 'run' | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const patch = (p: Partial<ScenarioConfig>) => setDraft((cur) => ({ ...cur, ...p }));

  const setup = s.setup;
  const v = setup.variable;
  const check = checkConfig(draft, setup);
  const valid = configValid(check);
  const dirty = !sameConfig(draft, s.config);

  const health = tagHealth(SIMULATION_REFERENCE_TAGS, live, realNow);
  const inputHealth = tagHealth(setupTags(setup), live, realNow);
  const inputSync = dataSyncState(inputHealth);
  const blocker = runBlocker(s, live, realNow);
  const ready = readinessOf(blocker, valid);
  const start = startValue(v, live, realNow);

  // Gợi ý + giờ phân tích chỉ đổi khi dữ liệu đầu vào đổi (không nhảy mỗi giây).
  const healthKey = health ? `${health.ok}/${health.bad}/${health.missing}/${health.stale}` : 'pending';
  const suggestion = useMemo(
    () => (health ? configSuggestion(s, health, suggestionConfidence(scenarios, runs, health, now)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `health` đổi object mỗi giây; khoá theo nội dung
    [s, scenarios, runs, healthKey],
  );
  const analyzedAt = useMemo(() => now, [suggestion]); // eslint-disable-line react-hooks/exhaustive-deps -- giờ của lần phân tích
  const history = useMemo(() => scenarioRuns(s.id, runs), [s.id, runs]);

  // Focus sau khi "Bỏ qua" / "Xem lại gợi ý" (nút vừa bấm biến mất).
  const restoreRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<'restore' | 'dismiss' | null>(null);
  useEffect(() => {
    const target = focusAfter.current === 'restore' ? restoreRef.current : focusAfter.current === 'dismiss' ? dismissRef.current : null;
    target?.focus();
    focusAfter.current = null;
  }, [dismissed]);

  const uid = useId();
  const runReasonId = `${uid}-run-reason`;
  const saveReasonId = `${uid}-save-reason`;
  const historyPendingId = `${uid}-history-pending`;

  const firstError = Object.values(check.errors)[0];
  const runReason = blocker ? blocker.text : !valid ? `Cấu hình chưa hợp lệ: ${firstError}` : undefined;
  const saveReason = !valid ? `Cấu hình chưa hợp lệ: ${firstError}` : undefined;

  const save = async (): Promise<boolean> => {
    try {
      await saveScenarioConfig(s.id, draft);
      return true;
    } catch (e) {
      announce(e instanceof Error ? e.message : 'Không lưu được cấu hình.');
      return false;
    }
  };

  const onSave = async () => {
    if (busy || saveReason) return;
    if (!dirty) {
      announce(`Cấu hình ${s.code} không có thay đổi.`);
      return;
    }
    setBusy('save');
    if (await save()) announce(`Đã lưu cấu hình ${s.code}.`);
    setBusy(null);
  };

  const onRun = async () => {
    if (busy || runReason) return;
    setBusy('run');
    if (dirty && !(await save())) {
      setBusy(null);
      return;
    }
    announce(`${dirty ? 'Đã lưu cấu hình. ' : ''}Đang mô phỏng ${s.code}…`);
    try {
      const run = await runSimulation(s.id, actor);
      announce(`${s.code}: ${runSummary(run)}. Đã lưu vào lịch sử.`);
    } catch (e) {
      announce(e instanceof Error ? e.message : 'Không chạy được mô phỏng.');
    } finally {
      setBusy(null);
    }
  };

  const onApply = () => {
    if (suggestion?.kind !== 'run') return;
    if (suggestionApplied(draft, suggestion)) {
      announce(`Cấu hình đang dùng đúng gợi ý: ${formatVariable(suggestion.target, v)} trong ${suggestion.durationMin} phút.`);
      return;
    }
    patch({ target: suggestion.target, durationMin: suggestion.durationMin });
    announce(`Đã áp dụng gợi ý: ${formatVariable(suggestion.target, v)} trong ${suggestion.durationMin} phút. Bấm "Lưu cấu hình" để lưu.`);
  };

  const header = (
    <PageHeader
      breadcrumb={[...BREADCRUMB_BASE, { label: s.code }]}
      title={TITLE}
      description={DESCRIPTION}
      actions={
        <>
          {back}
          {canConfigure && (
            <>
              <Button
                aria-disabled={!!saveReason || !!busy || undefined}
                aria-describedby={saveReason ? saveReasonId : undefined}
                aria-busy={busy === 'save' || undefined}
                onClick={() => void onSave()}
              >
                {busy === 'save' ? 'Đang lưu…' : 'Lưu cấu hình'}
              </Button>
              {saveReason && (
                <span id={saveReasonId} hidden>
                  {saveReason}
                </span>
              )}
            </>
          )}
          {canRun && (
            <>
              <Button
                variant="primary"
                aria-disabled={!!runReason || !!busy || undefined}
                aria-describedby={runReason ? runReasonId : undefined}
                aria-busy={busy === 'run' || undefined}
                title={runReason}
                onClick={() => void onRun()}
              >
                {busy === 'run' ? 'Đang mô phỏng…' : 'Bắt đầu chạy mô phỏng'}
                <PlayCircleSolidIcon size={18} className="shrink-0" />
              </Button>
              {runReason && (
                <span id={runReasonId} hidden>
                  {runReason}
                </span>
              )}
            </>
          )}
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

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px] wide:grid-cols-[minmax(0,1fr)_388px] wide:gap-7">
        <div className="flex min-w-0 flex-col gap-3">
          <ScenarioInfoCard scenario={s} readiness={ready} inputSync={inputSync} />
          <InputParamsCard scenario={s} config={draft} onChange={patch} check={check} start={start} readOnly={!canConfigure} />
          <ReferenceDataCard rows={setup.referenceRows} live={live} now={realNow} liveSynced={inputHealth ? inputSync === 'synced' : undefined} />
          <ExpectedOutcomesCard outcomes={setup.expectedOutcomes} />
        </div>

        <aside aria-label="Tóm tắt và trạng thái mô phỏng" className="flex min-w-0 flex-col gap-3">
          <ConfigSummaryCard scenario={s} config={draft} inputSync={inputSync} readiness={ready} />
          <ReadinessCard readiness={ready} reason={blocker?.kind === 'pending' ? undefined : runReason} health={health} />
          <ConfigSuggestionCard
            suggestion={suggestion}
            analyzedAt={analyzedAt}
            dismissed={dismissed}
            canApply={canConfigure}
            onApply={onApply}
            onDismiss={() => {
              focusAfter.current = 'restore';
              setDismissed(true);
              announce('Đã bỏ qua gợi ý AI.');
            }}
            onRestore={() => {
              focusAfter.current = 'dismiss';
              setDismissed(false);
            }}
            restoreRef={restoreRef}
            dismissRef={dismissRef}
          />
          <SafetyRulesCard variant="verified" rules={CONFIG_SAFETY_RULES} />
          <span id={historyPendingId} hidden>
            {PENDING_HISTORY}
          </span>
          <ScenarioHistoryCard runs={history} pendingHint={PENDING_HISTORY} pendingId={historyPendingId} />
        </aside>
      </div>
    </Page>
  );
}
