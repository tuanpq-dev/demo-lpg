import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, EmergencyBanner, FilterBar, HistoryIcon, Icon, KpiCard, PageHeader, buttonClass, type FilterDef } from '@/components';
import { simulationConfigPath, simulationMonitorPath } from '@/app/assetRoutes';
import { useAuth, useCan } from '@/app/auth';
import { Page } from '@/app/Page';
import { pageFallback } from '@/app/Placeholder';
import { useTableFilters } from '@/app/useTableFilters';
import { SIMULATION_REFERENCE_TAGS, startSimulation, useSimulation } from '@/data/simulation';
import { activeSessionOf, startBlocker } from '@/features/simulation/monitor';
import {
  SCENARIO_GROUPS,
  SCENARIO_GROUP_LABEL,
  SCENARIO_RISKS,
  SCENARIO_RISK_LABEL,
  SCENARIO_STATUSES,
  SCENARIO_STATUS_LABEL,
  SIMULATION_PARAMS,
  aiSuggestion,
  byNewestRun,
  byScenarioCode,
  deriveSimulationKpis,
  healthSynced,
  lastRunOf,
  matchScenario,
  tagHealth,
  type Scenario,
  type ScenarioGroup,
  type ScenarioRisk,
  type ScenarioStatus,
} from '@/features/simulation/scenarios';
import { announce } from '@/lib/announce';
import { useNow } from '@/lib/useNow';
import { healthKeyOf, useAnalyzedAt } from './simulation/shared';
import { ScenarioCard } from './simulation/ScenarioCard';
import { AiSuggestionCard, PlcDataCard, RecentRunsCard, SafetyRulesCard } from './simulation/SimulationSideCards';
import { errorMessage } from '@/lib/actionError';

const getId = (s: Scenario) => s.id;
const PENDING_DESIGN = 'Chưa có màn này – chờ thiết kế.';

/**
 * AI mô phỏng sự cố (ảnh thiết kế 02/11/2026 – `scratch/figma-ref/ai-sim/`; Figma không đọc được do hết lượt MCP / không có
 * quyền file): header (Lịch sử · Cấu hình · Tạo kịch bản) → banner "Chế độ mô phỏng" → 4 KPI → [lọc + danh sách kịch bản |
 * Góp ý AI · Dữ liệu PLC/SCADA · Lịch sử gần đây · Quy tắc an toàn]. Mọi số suy từ kịch bản + lịch sử chạy + tag trực tiếp.
 */
export default function AiSimulationPage() {
  const sim = useSimulation();
  const { user } = useAuth();
  const actor = user?.name || 'Admin';
  const canRun = useCan('simulation:run');
  // Phút cho KPI/giờ hiển thị (giờ nhà máy, có thể dời bằng ?now=).
  const now = useNow(60_000);
  // Giây: tag "cũ" chuyển trạng thái đúng lúc + lượt chạy kết thúc đúng giờ.
  const tick = useNow(1000).getTime();
  // Quy tắc mất tín hiệu so `ts` với giờ THẬT (không dùng ?now=) – CLAUDE.md "Dữ liệu trực tiếp".
  const realNow = Date.now();

  const scenarios = useMemo(() => sim.scenarios ?? [], [sim.scenarios]);
  const runs = useMemo(() => [...(sim.runs ?? [])].sort(byNewestRun), [sim.runs]);
  const table = useTableFilters({ rows: scenarios, getId, params: SIMULATION_PARAMS, match: matchScenario, sort: byScenarioCode, pageSize: 100 });
  const { values: f, setValues } = table;

  const health = tagHealth(SIMULATION_REFERENCE_TAGS, sim.liveData, realNow);
  const healthKey = healthKeyOf(health);
  const kpis = deriveSimulationKpis(scenarios, runs, health, now);
  // Góp ý + giờ phân tích chỉ đổi khi dữ liệu đầu vào đổi (không nhảy mỗi giây).
  const suggestion = useMemo(
    () => aiSuggestion(scenarios, runs, health, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `health` đổi object mỗi giây; khoá theo nội dung
    [scenarios, runs, healthKey],
  );
  const analyzedAt = useAnalyzedAt(suggestion, now);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const firstId = table.filtered[0]?.id;
  const isExpanded = (id: string) => expanded[id] ?? id === firstId;
  const [running, setRunning] = useState<ReadonlySet<string>>(new Set());
  const navigate = useNavigate();
  const liveData = sim.liveData;

  // Bắt đầu lượt chạy theo thời gian thực rồi mở màn "Theo dõi diễn biến mô phỏng".
  const onRun = useCallback(
    async (s: Scenario) => {
      setRunning((cur) => new Set(cur).add(s.id));
      announce(`Đang khởi động mô phỏng ${s.code}…`);
      try {
        await startSimulation(s.id, actor, liveData);
        announce(`Đã bắt đầu mô phỏng ${s.code}.`);
        void navigate(simulationMonitorPath(s.id));
      } catch (e) {
        announce(errorMessage(e, 'Không chạy được mô phỏng.'));
        setRunning((cur) => {
          const next = new Set(cur);
          next.delete(s.id);
          return next;
        });
      }
    },
    [actor, liveData, navigate],
  );

  const historyRef = useRef<HTMLHeadingElement>(null);
  const configTarget = table.filtered[0]?.id ?? [...scenarios].sort(byScenarioCode)[0]?.id ?? 'SC-001';
  const pendingId = `${useId()}-pending`;

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Vận hành' }, { label: 'AI mô phỏng sự cố' }]}
      title="AI mô phỏng sự cố"
      description="Mô phỏng các tình huống bất thường trong hệ thống LPG để đánh giá phản ứng vận hành và gợi ý xử lý an toàn."
      actions={
        <>
          <span id={pendingId} hidden>
            {PENDING_DESIGN}
          </span>
          <Button
            icon={<HistoryIcon size={16} />}
            onClick={() => {
              historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              historyRef.current?.focus({ preventScroll: true });
            }}
          >
            Lịch sử mô phỏng
          </Button>
          {/* Mở cấu hình kịch bản đầu danh sách đang lọc (SC-001 khi không lọc). */}
          <Link to={simulationConfigPath(configTarget)} className={buttonClass('ghost')}>
            <Icon name="settings" box={16} />
            Cấu hình kịch bản
          </Link>
          <Button variant="primary" icon={<Icon name="add" box={18} />} aria-disabled="true" aria-describedby={pendingId} title={PENDING_DESIGN}>
            Tạo kịch bản tùy chỉnh
          </Button>
        </>
      }
    />
  );

  if (sim.status !== 'success') return pageFallback(sim, { header, errorTitle: 'Không tải được kịch bản mô phỏng', skeleton: [64, 110, 720] });

  const filterDefs: FilterDef[] = [
    {
      id: 'group',
      label: 'Nhóm kịch bản',
      allLabel: 'Tất cả nhóm',
      options: SCENARIO_GROUPS.map((g) => ({ value: g, label: SCENARIO_GROUP_LABEL[g] })),
    },
    { id: 'risk', label: 'Mức độ rủi ro', allLabel: 'Tất cả', options: SCENARIO_RISKS.map((r) => ({ value: r, label: SCENARIO_RISK_LABEL[r] })) },
    { id: 'status', label: 'Trạng thái', allLabel: 'Tất cả', options: SCENARIO_STATUSES.map((s) => ({ value: s, label: SCENARIO_STATUS_LABEL[s] })) },
    {
      id: 'area',
      label: 'Khu vực',
      allLabel: 'Tất cả khu vực',
      options: [...new Set(scenarios.map((s) => s.area))].sort((a, b) => a.localeCompare(b, 'vi')).map((a) => ({ value: a, label: a })),
    },
  ];
  const h = kpis.health;
  const synced = healthSynced(h);

  return (
    <Page pageHeader={header}>
      <EmergencyBanner
        tone="warning"
        title="Chế độ mô phỏng — không tác động thiết bị thật"
        text="Toàn bộ kịch bản chỉ chạy trên dữ liệu mô phỏng và dữ liệu tham chiếu PLC/SCADA. Hệ thống không gửi lệnh điều khiển đến thiết bị thực tế."
      />

      <section aria-label="Thống kê mô phỏng" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard variant="compact" label="Kịch bản khả dụng" value={kpis.total} sub={`${kpis.ready} sẵn sàng mô phỏng`} subTone="success" />
        <KpiCard variant="compact" label="Đã chạy hôm nay" value={kpis.runsToday} sub="Lượt mô phỏng" subTone="muted" />
        <KpiCard
          variant="compact"
          label="Cần cấu hình"
          value={kpis.needsConfig}
          tone={kpis.needsConfig > 0 ? 'warning' : 'neutral'}
          sub={kpis.needsConfig > 0 ? 'Thiếu mapping hoặc tham số' : 'Đủ cấu hình'}
          subTone={kpis.needsConfig > 0 ? 'warning' : 'muted'}
        />
        <KpiCard
          variant="compact"
          label="Dữ liệu PLC tham chiếu"
          value={h ? `${h.ok}/${h.total}` : '—'}
          tone={!h ? 'neutral' : synced ? 'success' : 'warning'}
          sub={!h ? 'Đang kết nối' : synced ? 'Đã đồng bộ' : `Thiếu ${h.total - h.ok} thông số`}
          subTone={!h ? 'muted' : synced ? 'success' : 'warning'}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px] wide:grid-cols-[minmax(0,1fr)_484px] wide:gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <Card padding="none" radius="lg">
            <FilterBar
              layout="inline"
              standalone
              search={f.q}
              onSearchChange={(q) => setValues({ q })}
              searchPlaceholder="Tìm theo tên kịch bản hoặc thiết bị..."
              filters={filterDefs}
              values={{ group: f.group, risk: f.risk, status: f.status, area: f.area }}
              onValuesChange={(v) =>
                setValues({
                  group: (v.group as ScenarioGroup | null) ?? null,
                  risk: (v.risk as ScenarioRisk | null) ?? null,
                  status: (v.status as ScenarioStatus | null) ?? null,
                  area: v.area ?? null,
                })
              }
              advancedLabel="Xoá bộ lọc"
              advancedActive={table.isFiltered()}
              onAdvancedFilter={() => table.reset()}
            />
          </Card>
          <section aria-label={`Danh sách kịch bản (${table.filtered.length})`} className="flex flex-col gap-3">
            {table.filtered.length === 0 ? (
              <p className="rounded-lg border border-line/30 bg-surface p-6 text-center text-base text-fg-secondary">
                Không có kịch bản phù hợp với bộ lọc.
              </p>
            ) : (
              table.filtered.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  lastRun={lastRunOf(s.id, runs)}
                  now={now}
                  expanded={isExpanded(s.id)}
                  onToggle={() => setExpanded((cur) => ({ ...cur, [s.id]: !isExpanded(s.id) }))}
                  blocker={startBlocker(s, sim.liveData, realNow)}
                  canRun={canRun}
                  running={running.has(s.id)}
                  onRun={() => void onRun(s)}
                  configHref={simulationConfigPath(s.id)}
                  monitorHref={activeSessionOf(s.id, sim.sessions ?? [], tick) ? simulationMonitorPath(s.id) : undefined}
                />
              ))
            )}
          </section>
        </div>

        <aside aria-label="Thông tin mô phỏng" className="flex flex-col gap-4">
          <AiSuggestionCard suggestion={suggestion} analyzedAt={analyzedAt} />
          <PlcDataCard health={h} />
          <RecentRunsCard ref={historyRef} runs={runs} scenarios={scenarios} now={now} />
          <SafetyRulesCard />
        </aside>
      </div>
    </Page>
  );
}
