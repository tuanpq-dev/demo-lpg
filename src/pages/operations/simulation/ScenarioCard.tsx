import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  FanBoxIcon,
  FlameIcon,
  GasCylinderIcon,
  GaugeIcon,
  Icon,
  InfoGrid,
  PlayIcon,
  ToolsIcon,
  buttonClass,
  type TagTone,
} from '@/components';
import {
  RUN_RESULT_LABEL,
  SCENARIO_RISK_LABEL,
  SCENARIO_STATUS_LABEL,
  agoText,
  runTimeText,
  type RunBlocker,
  type Scenario,
  type ScenarioIcon,
  type ScenarioRisk,
  type SimulationRun,
} from '@/features/simulation/scenarios';
import { cn } from '@/lib/cn';

/** Ô icon đầu thẻ: nền tone/15 + icon tone (ảnh: gas đỏ, áp suất vàng, hóa hơi cyan, mất kết nối vàng, cháy đỏ). */
const ICON_VIEW: Record<ScenarioIcon, { box: string; node: ReactNode }> = {
  gas: { box: 'bg-danger/15 text-danger-text', node: <GasCylinderIcon size={20} /> },
  pressure: { box: 'bg-warning/15 text-warning', node: <GaugeIcon size={20} /> },
  vaporizer: { box: 'bg-primary/15 text-primary', node: <FanBoxIcon size={20} /> },
  link: { box: 'bg-warning/15', node: <Icon name="logLinkOff" box={20} /> },
  fire: { box: 'bg-danger/15 text-danger-text', node: <FlameIcon size={20} /> },
};

const RISK_TONE: Record<ScenarioRisk, TagTone> = { critical: 'danger', high: 'warning', medium: 'neutral' };

export type ScenarioCardProps = {
  scenario: Scenario;
  lastRun?: SimulationRun;
  now: Date;
  expanded: boolean;
  onToggle: () => void;
  /** null = chạy được. */
  blocker: RunBlocker | null;
  /** Có quyền chạy (`simulation:run`) – không có → ẩn nút chạy/cấu hình. */
  canRun: boolean;
  running: boolean;
  onRun: () => void;
  /** Màn "Cấu hình kịch bản" của kịch bản này. */
  configHref: string;
  /** Kịch bản đang có lượt chạy → link "Theo dõi mô phỏng" (mọi vai trò) thay cho nút chạy. */
  monitorHref?: string;
};

/**
 * Một kịch bản (ảnh `scratch/figma-ref/ai-sim/scenario-list.png`): icon · tên · mã + cập nhật · badge rủi ro + trạng thái;
 * "Chi tiết kịch bản" mở/đóng lưới Khu vực / Dữ liệu PLC / Ngưỡng / Kết quả; lần chạy + kết quả gần nhất từ lịch sử;
 * "Chạy mô phỏng" (hoặc link "Cấu hình trước khi chạy" sang màn cấu hình khi thiếu mapping; đang có lượt chạy → "Theo dõi mô phỏng").
 */
export function ScenarioCard({
  scenario: s,
  lastRun,
  now,
  expanded,
  onToggle,
  blocker,
  canRun,
  running,
  onRun,
  configHref,
  monitorHref,
}: ScenarioCardProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const detailId = `${uid}-detail`;
  const reasonId = `${uid}-reason`;
  const needsConfig = s.status === 'needs-config';
  const icon = ICON_VIEW[s.icon];
  const locked = !!blocker || running;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-4 rounded-lg border p-4',
        // Ảnh: nền xám sáng – đổi sang surface-raised để badge đỏ đủ tương phản (axe color-contrast).
        needsConfig ? 'border-warning/60 bg-surface-raised' : 'border-line/30 bg-surface',
      )}
    >
      {/* Hàng đầu */}
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', icon.box)}>
          {icon.node}
        </span>
        {/* basis-60: khung hẹp → badge xuống hàng thay vì ép tên mỗi dòng một từ. */}
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
          <h3 id={titleId} className="text-lg font-semibold leading-6 text-fg">
            {s.title}
          </h3>
          <p className="text-sm text-fg-secondary">
            Mã kịch bản: {s.code} • Cập nhật: {agoText(s.updatedAt, now)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="tag" size="md" tone={RISK_TONE[s.risk]}>
            <span className="sr-only">Mức độ rủi ro: </span>
            {SCENARIO_RISK_LABEL[s.risk]}
          </Badge>
          <Badge variant="tag" size="md" tone={needsConfig ? 'warning' : 'success'}>
            <span className="sr-only">Trạng thái: </span>
            {SCENARIO_STATUS_LABEL[s.status]}
          </Badge>
        </div>
      </div>

      {expanded && (
        <div id={detailId} className="rounded-lg border border-line/30 bg-app/60 p-4">
          <InfoGrid
            items={[
              { id: 'area', label: 'Khu vực', value: s.area },
              { id: 'plc', label: 'Dữ liệu PLC', value: <span className="break-words">{s.plcVariables.join(', ')}</span> },
              { id: 'threshold', label: 'Ngưỡng', value: s.threshold },
              { id: 'outcome', label: 'Kết quả', value: s.outcome },
            ]}
          />
        </div>
      )}

      {/* Chân thẻ */}
      <div className="flex flex-wrap items-end justify-between gap-3 sm:pl-12">
        <LastRun run={lastRun} now={now} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="link" size="lg" aria-expanded={expanded} aria-controls={expanded ? detailId : undefined} onClick={onToggle}>
            {expanded ? 'Thu gọn chi tiết' : 'Chi tiết kịch bản'}
            <span className="sr-only"> {s.code}</span>
          </Button>
          <RunAction
            code={s.code}
            monitorHref={monitorHref}
            configHref={configHref}
            canRun={canRun}
            needsConfig={needsConfig}
            locked={locked}
            running={running}
            blocked={!!blocker}
            reasonId={reasonId}
            onRun={onRun}
          />
        </div>
      </div>
      {canRun && blocker && !monitorHref && (
        <p id={reasonId} className={cn('text-sm sm:pl-12', blocker.kind === 'pending' ? 'text-fg-secondary' : 'text-warning')}>
          {needsConfig ? `${blocker.text} Màn cấu hình ánh xạ đang chờ thiết kế.` : blocker.text}
        </p>
      )}
    </article>
  );
}

/** Lần chạy + kết quả gần nhất (từ lịch sử). */
function LastRun({ run, now }: { run: ScenarioCardProps['lastRun']; now: ScenarioCardProps['now'] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base text-fg-secondary">
      <dt>Lần chạy gần nhất:</dt>
      <dd className="tabular-nums text-fg">{run ? runTimeText(run.at, now) : '--'}</dd>
      <dt>Kết quả gần nhất:</dt>
      <dd className={run ? (run.result === 'pass' ? 'text-success' : 'text-warning') : 'text-fg'}>
        {run ? `${RUN_RESULT_LABEL[run.result]} (${run.responseSeconds} s / mục tiêu ${run.targetSeconds} s)` : '--'}
      </dd>
    </dl>
  );
}

/** Nút chính: đang chạy → "Theo dõi" · thiếu mapping → "Cấu hình trước khi chạy" · còn lại → "Chạy mô phỏng" (khoá kèm lý do). */
function RunAction({
  code,
  monitorHref,
  configHref,
  canRun,
  needsConfig,
  locked,
  running,
  blocked,
  reasonId,
  onRun,
}: {
  code: string;
  monitorHref?: string;
  configHref: string;
  canRun: boolean;
  needsConfig: boolean;
  locked: boolean;
  running: boolean;
  blocked: boolean;
  reasonId: string;
  onRun: () => void;
}) {
  return monitorHref ? (
    <Link to={monitorHref} className={buttonClass('tinted')}>
      <PlayIcon size={14} />
      Đang chạy – Theo dõi
      <span className="sr-only"> {code}</span>
    </Link>
  ) : (
    canRun &&
      (needsConfig ? (
        <Link to={configHref} aria-describedby={reasonId} className={buttonClass('outline-warning')}>
          <ToolsIcon size={16} />
          Cấu hình trước khi chạy
          <span className="sr-only"> {code}</span>
        </Link>
      ) : (
        <Button
          variant="primary"
          icon={<PlayIcon size={14} />}
          aria-disabled={locked || undefined}
          aria-describedby={blocked ? reasonId : undefined}
          aria-busy={running || undefined}
          onClick={() => !locked && onRun()}
        >
          {running ? 'Đang khởi động…' : 'Chạy mô phỏng'}
          <span className="sr-only"> {code}</span>
        </Button>
      ))
  );
}
