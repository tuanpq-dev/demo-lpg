import { forwardRef, type Ref } from 'react';
import { AiSparklesIcon, Button, Card, CheckCircleIcon, AlertTriangleIcon, MetricListCard, type MetricTone } from '@/components';
import {
  DATA_SYNC_LABEL,
  formatVariable,
  orderedAreas,
  runDateTimeText,
  type ConfigSuggestion,
  type DataSyncState,
  type Readiness,
  type ScenarioConfig,
} from '@/features/simulation/config';
import { RUN_RESULT_LABEL, SCENARIO_RISK_LABEL, type Scenario, type SimulationRun, type TagHealth } from '@/features/simulation/scenarios';
import { plantTimeOfDay } from '@/lib/plantTime';
import { cn } from '@/lib/cn';

const SYNC_TONE: Record<DataSyncState, MetricTone> = { synced: 'success', missing: 'warning', pending: 'default' };
const READINESS_TONE: Record<Readiness['tone'], MetricTone> = { success: 'success', warning: 'warning', muted: 'default' };

/** "Tóm tắt cấu hình" (ảnh `summary.png`) – theo cấu hình ĐANG SỬA (chưa lưu cũng cập nhật). */
export function ConfigSummaryCard({
  scenario: s,
  config,
  inputSync,
  readiness,
}: {
  scenario: Scenario;
  config: ScenarioConfig;
  inputSync: DataSyncState;
  readiness: Readiness;
}) {
  const areas = orderedAreas(config.areas, s.setup.areaOptions);
  return (
    <section aria-label="Tóm tắt cấu hình">
      <MetricListCard
        title="Tóm tắt cấu hình"
        headerVariant="plain"
        titleSize="lg"
        divided
        rows={[
          { id: 'title', label: 'Kịch bản:', value: s.title },
          { id: 'code', label: 'Mã:', value: s.code },
          {
            id: 'risk',
            label: 'Mức độ:',
            value: SCENARIO_RISK_LABEL[s.risk],
            tone: s.risk === 'critical' ? 'danger' : s.risk === 'high' ? 'warning' : 'default',
          },
          { id: 'target', label: 'Giá trị mục tiêu:', value: formatVariable(config.target, s.setup.variable), tone: 'primary' },
          { id: 'duration', label: 'Thời lượng:', value: `${config.durationMin} phút` },
          { id: 'area', label: 'Khu vực:', value: areas.length ? areas.join(', ') : '—' },
          { id: 'input', label: 'Dữ liệu đầu vào:', value: DATA_SYNC_LABEL[inputSync], tone: SYNC_TONE[inputSync] },
          { id: 'status', label: 'Trạng thái:', value: readiness.short, tone: READINESS_TONE[readiness.tone] },
        ]}
      />
    </section>
  );
}

/**
 * "Trạng thái sẵn sàng" (ảnh `readiness.png`): ô icon + câu trạng thái · "Dữ liệu PLC/SCADA: Đã đồng bộ" · 4 ô đếm 21 tag
 * giám sát (khả dụng / lỗi / mất kết nối / cũ) · giờ cập nhật cuối. Lý do chưa sẵn sàng hiện dưới câu trạng thái.
 */
export function ReadinessCard({ readiness, reason, health }: { readiness: Readiness; reason?: string; health: TagHealth | undefined }) {
  const ok = readiness.tone === 'success';
  const sync: DataSyncState = !health ? 'pending' : health.ok === health.total ? 'synced' : 'missing';
  const tiles: { id: string; label: string; value: string; warn: boolean }[] = [
    { id: 'ok', label: 'Thông số khả dụng', value: health ? `${health.ok}/${health.total}` : '—', warn: !!health && health.ok < health.total },
    { id: 'bad', label: 'Cảm biến lỗi', value: health ? String(health.bad) : '—', warn: !!health && health.bad > 0 },
    { id: 'missing', label: 'Mất kết nối', value: health ? String(health.missing) : '—', warn: !!health && health.missing > 0 },
    { id: 'stale', label: 'Dữ liệu cũ', value: health ? String(health.stale) : '—', warn: !!health && health.stale > 0 },
  ];
  return (
    <Card title="Trạng thái sẵn sàng" headerVariant="divided" radius="lg" titleSize="lg" aria-label="Trạng thái sẵn sàng" bodyClassName="gap-2">
      <div className="mb-2 mt-1 flex items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-lg border',
            ok
              ? 'border-success bg-success/10 text-success'
              : readiness.tone === 'warning'
                ? 'border-warning bg-warning/10 text-warning'
                : 'border-line bg-surface-raised text-fg-secondary',
          )}
        >
          {ok ? <CheckCircleIcon size={24} /> : <AlertTriangleIcon size={22} />}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('text-md', ok ? 'text-success' : readiness.tone === 'warning' ? 'text-warning' : 'text-fg-secondary')}>
            {readiness.headline}
          </span>
          {reason && <span className="text-sm text-fg-secondary">{reason}</span>}
        </span>
      </div>
      <dl className="flex items-center justify-between gap-3 rounded-md border border-line/30 bg-surface-raised px-2.5 py-2.5 text-base">
        <dt className="text-fg-secondary">Dữ liệu PLC/SCADA:</dt>
        <dd className={sync === 'synced' ? 'text-success' : sync === 'missing' ? 'text-warning' : 'text-fg-secondary'}>{DATA_SYNC_LABEL[sync]}</dd>
      </dl>
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.id} className="flex flex-col gap-1 rounded-md border border-line/30 bg-surface-raised px-2.5 py-2">
            <dt className="text-base text-fg-secondary">{t.label}</dt>
            <dd className={cn('text-lg tabular-nums', t.warn ? 'font-semibold text-warning' : 'text-fg')}>{t.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="flex items-center justify-between gap-3 rounded-md border border-line/30 bg-surface-raised px-2.5 py-2.5 text-xs">
        <dt className="text-fg-secondary">Lần cập nhật cuối:</dt>
        <dd className="tabular-nums text-fg">{health?.lastUpdate ? plantTimeOfDay(new Date(health.lastUpdate)) : '—'}</dd>
      </dl>
    </Card>
  );
}

export type ConfigSuggestionCardProps = {
  suggestion: ConfigSuggestion | null;
  analyzedAt: Date;
  /** Đã bỏ qua → chỉ còn dòng ngắn + "Xem lại gợi ý". */
  dismissed: boolean;
  /** Không có quyền cấu hình → ẩn "Áp dụng gợi ý". */
  canApply: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  /** Focus sau khi bỏ qua / xem lại (nút cũ biến mất). */
  restoreRef?: Ref<HTMLButtonElement>;
  dismissRef?: Ref<HTMLButtonElement>;
};

/** "Gợi ý từ AI" (ảnh `ai-suggestion.png`): câu gợi ý có số nhấn mạnh · dữ liệu tham chiếu · giờ phân tích · Áp dụng / Bỏ qua. */
export function ConfigSuggestionCard({
  suggestion: sg,
  analyzedAt,
  dismissed,
  canApply,
  onApply,
  onDismiss,
  onRestore,
  restoreRef,
  dismissRef,
}: ConfigSuggestionCardProps) {
  return (
    <Card
      title={<span className="text-primary">Gợi ý từ AI</span>}
      icon={<AiSparklesIcon size={20} className="shrink-0 text-primary" />}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      aria-label="Gợi ý từ AI"
      headerEnd={
        sg && !dismissed ? (
          <span
            className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary"
            title="Giả định: 60 % tỉ lệ thông số khả dụng + 40 % tỉ lệ kịch bản đã chạy trong 7 ngày"
          >
            Độ tin cậy: {sg.confidence}%
          </span>
        ) : undefined
      }
    >
      {dismissed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-fg-secondary">Đã bỏ qua gợi ý cho lần cấu hình này.</p>
          <Button ref={restoreRef} variant="link" size="lg" onClick={onRestore}>
            Xem lại gợi ý
          </Button>
        </div>
      ) : !sg ? (
        <p className="text-base text-fg-secondary">Đang chờ dữ liệu PLC/SCADA tham chiếu để phân tích…</p>
      ) : (
        <div className="-mt-1 flex flex-col gap-3">
          <p className="text-base leading-6 text-fg">
            {sg.kind === 'run' ? (
              <>
                {sg.lead} Nên chạy với mức <strong className="font-bold text-primary">{sg.targetText}</strong> trong{' '}
                <strong className="font-bold text-primary">{sg.durationMin} phút</strong> để {sg.goal}.
              </>
            ) : (
              sg.text
            )}
          </p>
          <p className="text-sm leading-6 text-fg-secondary">Dữ liệu tham chiếu: {sg.refs.join(', ')}</p>
          <p className="text-sm text-fg-secondary">Thời gian phân tích: {plantTimeOfDay(analyzedAt).slice(0, 5)}</p>
          {sg.kind === 'run' && (
            <div className="mt-1 grid grid-cols-2 gap-2">
              {canApply && (
                <Button variant="tinted" size="sm" onClick={onApply}>
                  Áp dụng gợi ý
                </Button>
              )}
              <Button ref={dismissRef} variant="ghost" size="sm" className={cn(!canApply && 'col-span-2')} onClick={onDismiss}>
                Bỏ qua
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** "Lịch sử kịch bản này" (ảnh `history.png`) – 3 lượt mới nhất của kịch bản: ngày · giờ, kết quả, ghi chú. */
export const ScenarioHistoryCard = forwardRef<HTMLHeadingElement, { runs: readonly SimulationRun[]; pendingHint: string; pendingId: string }>(
  function ScenarioHistoryCard({ runs, pendingHint, pendingId }, ref) {
    return (
      <section aria-labelledby="sim-config-history" className="flex flex-col rounded-lg border border-line/30 bg-surface p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 id="sim-config-history" ref={ref} tabIndex={-1} className="text-lg font-semibold text-fg">
            Lịch sử kịch bản này
          </h3>
          {/* Chưa có màn lịch sử đầy đủ – khoá kèm lý do. */}
          <Button variant="link" size="md" aria-disabled="true" aria-describedby={pendingId} title={pendingHint}>
            Xem toàn bộ lịch sử
          </Button>
        </div>
        {runs.length === 0 ? (
          <p className="text-base text-fg-secondary">Kịch bản chưa chạy lần nào.</p>
        ) : (
          <ul className="flex flex-col">
            {runs.slice(0, 3).map((r, i) => (
              <li key={r.id} className={cn('flex flex-col gap-2 py-3', i > 0 && 'border-t border-line/20', i === 0 && 'pt-0')}>
                <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="tabular-nums text-fg-secondary">{runDateTimeText(r.at)}</span>
                  <span className={r.result === 'pass' ? 'text-success' : 'text-warning'}>Kết quả: {RUN_RESULT_LABEL[r.result]}</span>
                </span>
                {r.note && <span className="text-base text-fg">Ghi chú: {r.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  },
);
