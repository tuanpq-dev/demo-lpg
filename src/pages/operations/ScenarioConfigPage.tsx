import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, EmergencyBanner, PageHeader, PlayCircleSolidIcon, buttonClass, type BreadcrumbItem } from '@/components';
import { useAuth, useCan } from '@/app/auth';
import { SIMULATION_PATH, simulationMonitorPath } from '@/app/assetRoutes';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { SIMULATION_REFERENCE_TAGS, saveScenarioConfig, startSimulation, useSimulation } from '@/data/simulation';
import { activeSessionOf, startBlocker, type SimulationSession } from '@/features/simulation/monitor';
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
import { suggestionConfidence, tagHealth, type Scenario, type SimulationRun } from '@/features/simulation/scenarios';
import { announce } from '@/lib/announce';
import { useNow } from '@/hooks/useNow';
import { BackLink, ScenarioNotFound, healthKeyOf, useAnalyzedAt } from './simulation/shared';
import { ExpectedOutcomesCard, InputParamsCard, ReferenceDataCard, ScenarioInfoCard } from './simulation/ConfigCards';
import { ConfigSuggestionCard, ConfigSummaryCard, ReadinessCard, ScenarioHistoryCard } from './simulation/ConfigSideCards';
import { CONFIG_SAFETY_RULES, SafetyRulesCard } from './simulation/SimulationSideCards';
import { errorMessage } from '@/lib/actionError';

const BREADCRUMB_BASE: readonly BreadcrumbItem[] = [
  { label: 'Vận hành' },
  { label: 'AI mô phỏng sự cố', to: SIMULATION_PATH },
  { label: 'Cấu hình kịch bản' },
];
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
  const back = <BackLink to={SIMULATION_PATH} label="Quay lại danh sách" />;
  const header = (
    <PageHeader breadcrumb={[...BREADCRUMB_BASE, { label: scenario?.code ?? scenarioId }]} title={TITLE} description={DESCRIPTION} actions={back} />
  );

  if (sim.status !== 'success') return pageFallback(sim, { header, errorTitle: 'Không tải được kịch bản mô phỏng', skeleton: [64, 760] });
  if (!scenario) {
    return (
      <ScenarioNotFound
        scenarioId={scenarioId}
        scenarios={sim.scenarios}
        breadcrumb={[...BREADCRUMB_BASE, { label: scenarioId || '—' }]}
        actions={back}
      />
    );
  }
  return <ConfigForm scenario={scenario} scenarios={sim.scenarios} runs={sim.runs} sessions={sim.sessions} live={sim.liveData} back={back} />;
}

type ConfigFormProps = {
  scenario: Scenario;
  scenarios: readonly Scenario[];
  runs: readonly SimulationRun[];
  sessions: readonly SimulationSession[];
  live: ReturnType<typeof useSimulation>['liveData'];
  back: ReactNode;
};

/** Nút khoá được (`aria-disabled` + lý do đọc qua `aria-describedby`, span ẩn) – vẫn nhận focus để đọc được lý do. */
function LockableButton({
  reason,
  reasonId,
  busy,
  busyHere,
  showTitle,
  variant,
  onClick,
  children,
}: {
  reason?: string;
  reasonId: string;
  busy: unknown;
  busyHere: boolean;
  showTitle?: boolean;
  variant?: 'primary';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <Button
        variant={variant}
        aria-disabled={!!reason || !!busy || undefined}
        aria-describedby={reason ? reasonId : undefined}
        aria-busy={busyHere || undefined}
        title={showTitle ? reason : undefined}
        onClick={onClick}
      >
        {children}
      </Button>
      {reason && (
        <span id={reasonId} hidden>
          {reason}
        </span>
      )}
    </>
  );
}

/** Focus sau khi "Bỏ qua" / "Xem lại gợi ý" (nút vừa bấm biến mất → focus sang nút đối ứng). */
function useSwapFocus(flag: boolean) {
  const restoreRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<'restore' | 'dismiss' | null>(null);
  useEffect(() => {
    const which = focusAfter.current;
    const target = which === 'restore' ? restoreRef.current : which === 'dismiss' ? dismissRef.current : null;
    target?.focus();
    focusAfter.current = null;
  }, [flag]);
  return { restoreRef, dismissRef, focusAfter };
}

/**
 * Cấu hình kịch bản mô phỏng (ảnh người dùng gửi – `scratch/figma-ref/ai-sim-config/`; Figma không đọc được):
 * header (Quay lại · Lưu cấu hình · Bắt đầu chạy) → banner "Chế độ mô phỏng" → [Thông tin kịch bản · Tham số đầu vào · Dữ liệu
 * PLC/SCADA tham chiếu · Kết quả mong đợi | Tóm tắt cấu hình · Trạng thái sẵn sàng · Gợi ý từ AI · Quy tắc an toàn · Lịch sử
 * kịch bản này]. Tóm tắt / trạng thái theo cấu hình ĐANG SỬA. "Bắt đầu chạy" lưu thay đổi (nếu có) rồi mở lượt chạy theo thời gian
 * thực và chuyển sang màn "Theo dõi diễn biến mô phỏng"; kịch bản đang chạy → nút thành link "Theo dõi mô phỏng đang chạy".
 */
function ConfigForm({ scenario: s, scenarios, runs, sessions, live, back }: ConfigFormProps) {
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const canConfigure = useCan('simulation:configure');
  const canRun = useCan('simulation:run');
  // Phút cho giờ phân tích (giờ nhà máy, ?now= dời được); giây để tag "cũ" chuyển trạng thái đúng lúc.
  const now = useNow(60_000);
  const tick = useNow(1000).getTime();
  const navigate = useNavigate();
  const activeSession = activeSessionOf(s.id, sessions, tick);
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
  const blocker = startBlocker(s, live, realNow);
  const ready = readinessOf(blocker, valid);
  const start = startValue(v, live, realNow);

  // Gợi ý + giờ phân tích chỉ đổi khi dữ liệu đầu vào đổi (không nhảy mỗi giây).
  const healthKey = healthKeyOf(health);
  const suggestion = useMemo(
    () => (health ? configSuggestion(s, health, suggestionConfidence(scenarios, runs, health, now)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `health` đổi object mỗi giây; khoá theo nội dung
    [s, scenarios, runs, healthKey],
  );
  const analyzedAt = useAnalyzedAt(suggestion, now);
  const history = useMemo(() => scenarioRuns(s.id, runs), [s.id, runs]);

  const { restoreRef, dismissRef, focusAfter } = useSwapFocus(dismissed);

  const uid = useId();
  const runReasonId = `${uid}-run-reason`;
  const saveReasonId = `${uid}-save-reason`;
  const historyPendingId = `${uid}-history-pending`;

  const saveReason = valid ? undefined : `Cấu hình chưa hợp lệ: ${Object.values(check.errors)[0]}`;
  const runReason = blocker ? blocker.text : saveReason;

  const save = async (): Promise<boolean> => {
    try {
      await saveScenarioConfig(s.id, draft);
      return true;
    } catch (e) {
      announce(errorMessage(e, 'Không lưu được cấu hình.'));
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
    announce(`${dirty ? 'Đã lưu cấu hình. ' : ''}Đang khởi động mô phỏng ${s.code}…`);
    try {
      await startSimulation(s.id, actor, live);
      announce(`Đã bắt đầu mô phỏng ${s.code}.`);
      void navigate(simulationMonitorPath(s.id));
    } catch (e) {
      announce(errorMessage(e, 'Không chạy được mô phỏng.'));
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
            <LockableButton reason={saveReason} reasonId={saveReasonId} busy={busy} busyHere={busy === 'save'} onClick={() => void onSave()}>
              {busy === 'save' ? 'Đang lưu…' : 'Lưu cấu hình'}
            </LockableButton>
          )}
          {activeSession ? (
            <Link to={simulationMonitorPath(s.id)} className={buttonClass('primary')}>
              Theo dõi mô phỏng đang chạy
              <PlayCircleSolidIcon size={18} className="shrink-0" />
            </Link>
          ) : (
            canRun && (
              <LockableButton
                variant="primary"
                reason={runReason}
                reasonId={runReasonId}
                busy={busy}
                busyHere={busy === 'run'}
                showTitle
                onClick={() => void onRun()}
              >
                {busy === 'run' ? 'Đang khởi động…' : 'Bắt đầu chạy mô phỏng'}
                <PlayCircleSolidIcon size={18} className="shrink-0" />
              </LockableButton>
            )
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
