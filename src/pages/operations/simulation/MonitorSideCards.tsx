/* Thẻ cột phải màn Theo dõi diễn biến mô phỏng: gợi ý AI, trạng thái, dữ liệu PLC/SCADA tham chiếu. */
import { useId } from 'react';
import { AiSparklesIcon, Badge, Card, MetricListCard, SignalLostIcon, type TagTone } from '@/components';
import { DATA_SYNC_LABEL, formatQty, orderedAreas, type DataSyncState } from '@/features/simulation/config';
import {
  TREND_LABEL,
  pendingSuggestionText,
  type MonitorSnapshot,
  type ReferenceSnapshotRow,
  type SimulationSession,
} from '@/features/simulation/monitor';
import { type Scenario, type TagHealth } from '@/features/simulation/scenarios';
import { cn } from '@/lib/cn';

/** "Gợi ý từ AI" (ảnh `1.png`): câu tóm tắt + danh sách đánh số + chân trang an toàn. */
export function MonitorSuggestionCard({
  scenario: s,
  snap,
  confidence,
}: {
  scenario: Scenario;
  snap: MonitorSnapshot;
  confidence: number | undefined;
}) {
  const listId = useId();
  return (
    <Card
      title={<span className="text-primary">Gợi ý từ AI</span>}
      icon={<AiSparklesIcon size={22} className="shrink-0 text-primary" />}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      tone="primary"
      aria-label="Gợi ý từ AI"
      headerEnd={
        snap.summary && confidence !== undefined ? (
          <span
            className="rounded-md border border-primary/60 px-2 py-1 text-sm text-primary"
            title="Giả định: 60 % tỉ lệ thông số khả dụng + 40 % tỉ lệ kịch bản đã chạy trong 7 ngày"
          >
            Độ tin cậy: {confidence}%
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-base leading-6 text-fg">{snap.summary ?? pendingSuggestionText(s.setup.variable)}</p>
        {snap.recommendations.length > 0 && (
          <ol aria-labelledby={listId} className="flex flex-col gap-3">
            <span id={listId} hidden>
              Các bước gợi ý
            </span>
            {snap.recommendations.map((r, i) => (
              <li key={r} className="flex items-center gap-3 rounded-lg border border-line/30 bg-app/60 px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-raised text-sm font-bold text-primary"
                >
                  {i + 1}
                </span>
                <span className="text-md text-fg">{r}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="border-t border-line/30 pt-4 text-center text-sm text-fg-secondary">
          AI chỉ đưa ra gợi ý trong mô phỏng. Không có lệnh điều khiển nào được gửi đến thiết bị thật.
        </p>
      </div>
    </Card>
  );
}

/** "Trạng thái mô phỏng" (ảnh `9.png`). */
export function MonitorStatusCard({ scenario: s, session, snap }: { scenario: Scenario; session: SimulationSession; snap: MonitorSnapshot }) {
  const v = s.setup.variable;
  const areas = orderedAreas(session.config.areas, s.setup.areaOptions);
  return (
    <section aria-label="Trạng thái mô phỏng">
      <MetricListCard
        title="Trạng thái mô phỏng"
        headerVariant="divided"
        titleSize="lg"
        divided
        rows={[
          { id: 'area', label: 'Khu vực:', value: areas.length ? areas.join(', ') : '—' },
          { id: 'equipment', label: 'Thiết bị:', value: s.setup.equipment },
          {
            id: 'progress',
            label: `Tiến độ (Mục tiêu ${formatQty(session.config.target, v.unit, v.digits)}):`,
            value: `${formatQty(snap.value, v.unit, v.digits)} (${TREND_LABEL[snap.trend]})`,
            tone: snap.exceeded ? 'danger' : 'primary',
          },
          { id: 'plc', label: 'Lệnh điều khiển PLC:', value: 'Không gửi', tone: 'success' },
          { id: 'esd', label: 'Trạng thái ESD thật:', value: 'Không kích hoạt', tone: 'success' },
        ]}
      />
    </section>
  );
}

const SYNC_BADGE: Record<DataSyncState, TagTone> = { synced: 'success', missing: 'warning', pending: 'muted' };

/** "Dữ liệu PLC/SCADA tham chiếu" (ảnh `7.png`): trạng thái nguồn thật (trực tiếp) + giá trị CHỤP lúc bắt đầu. */
export function ReferenceSnapshotCard({
  rows,
  sync,
  health,
}: {
  rows: readonly ReferenceSnapshotRow[];
  sync: DataSyncState;
  health: TagHealth | undefined;
}) {
  return (
    <Card title="Dữ liệu PLC/SCADA tham chiếu" headerVariant="divided" radius="lg" titleSize="lg" aria-label="Dữ liệu PLC/SCADA tham chiếu">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-fg-secondary">PLC/SCADA thật:</span>
          <Badge variant="tag" size="sm" tone={SYNC_BADGE[sync]} className="gap-1.5 rounded-md px-2 font-bold uppercase">
            <span
              aria-hidden="true"
              className={cn('size-1.5 rounded-full', sync === 'synced' ? 'bg-success' : sync === 'missing' ? 'bg-warning' : 'bg-neutral')}
            />
            {DATA_SYNC_LABEL[sync]}
          </Badge>
        </div>
        <p className="text-base text-fg-secondary">
          Thông số khả dụng: <strong className="font-bold text-fg">{health ? `${health.ok}/${health.total}` : '—'}</strong>
        </p>
        <dl className="flex flex-col gap-3 rounded-lg border border-line/30 bg-app/60 px-4 py-4 text-sm">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3">
              <dt className="min-w-0 break-words text-fg-secondary">{r.label}</dt>
              <dd className="shrink-0 tabular-nums text-fg">
                {r.valueText ?? (
                  <span className="inline-flex items-center gap-1 text-fg-secondary">
                    <SignalLostIcon size={14} className="shrink-0" />
                    Mất tín hiệu
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="px-1 text-sm italic leading-6 text-fg-secondary">
          Dữ liệu thật chỉ dùng làm trạng thái ban đầu và không bị thay đổi trong quá trình mô phỏng.
        </p>
      </div>
    </Card>
  );
}
