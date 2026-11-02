import { forwardRef } from 'react';
import { AiSparklesIcon, Badge, Card, CheckIcon, HistoryIcon, ServerIcon, ShieldPlusIcon } from '@/components';
import {
  RUN_RESULT_LABEL,
  healthSynced,
  runTimeText,
  type AiSuggestion,
  type Scenario,
  type SimulationRun,
  type TagHealth,
} from '@/features/simulation/scenarios';
import { plantTimeOfDay } from '@/lib/plantTime';
import { cn } from '@/lib/cn';

/** "Góp ý từ AI" – câu gợi ý + giờ phân tích + độ tin cậy (luật ở `aiSuggestion`; TODO(backend): dịch vụ AI). */
export function AiSuggestionCard({ suggestion, analyzedAt }: { suggestion: AiSuggestion | null; analyzedAt: Date }) {
  return (
    <Card title="Góp ý từ AI" icon={<AiSparklesIcon size={20} className="shrink-0 text-primary" />} headerVariant="plain" radius="lg">
      <div className="flex flex-col gap-3 rounded-lg border border-line/30 bg-app/60 p-4">
        <p className="text-base leading-6 text-fg">{suggestion ? suggestion.text : 'Đang chờ dữ liệu PLC/SCADA tham chiếu để phân tích…'}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/30 pt-3 text-sm">
          <span className="text-fg-secondary">Thời gian phân tích: {plantTimeOfDay(analyzedAt).slice(0, 5)}</span>
          {suggestion && (
            <span className="text-success" title="Giả định: 60 % tỉ lệ thông số khả dụng + 40 % tỉ lệ kịch bản đã chạy trong 7 ngày">
              Độ tin cậy: {suggestion.confidence}%
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/** "Dữ liệu PLC/SCADA: Đã đồng bộ" – đếm 21 tag giám sát theo nhóm (khả dụng / lỗi / mất kết nối / cũ) + giờ cập nhật cuối. */
export function PlcDataCard({ health }: { health: TagHealth | undefined }) {
  const synced = healthSynced(health);
  const state = !health ? 'Đang kết nối…' : synced ? 'Đã đồng bộ' : 'Thiếu dữ liệu';
  const rows: { id: string; label: string; value: string; warn?: boolean }[] = health
    ? [
        { id: 'ok', label: 'Thông số khả dụng', value: `${health.ok}/${health.total}`, warn: health.ok < health.total },
        { id: 'bad', label: 'Cảm biến lỗi', value: String(health.bad), warn: health.bad > 0 },
        { id: 'missing', label: 'Mất kết nối', value: String(health.missing), warn: health.missing > 0 },
        { id: 'stale', label: 'Dữ liệu cũ', value: String(health.stale), warn: health.stale > 0 },
        { id: 'last', label: 'Lần cập nhật cuối', value: health.lastUpdate ? plantTimeOfDay(new Date(health.lastUpdate)) : '—' },
      ]
    : [];
  return (
    <Card title={`Dữ liệu PLC/SCADA: ${state}`} icon={<ServerIcon size={20} className="shrink-0 text-fg-secondary" />} headerVariant="plain" radius="lg">
      <div className="flex flex-col gap-3 rounded-lg border border-line/30 bg-app/60 p-4">
        {health ? (
          <dl className="flex flex-col gap-1.5 text-base">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <dt className="text-fg-secondary">{r.label}</dt>
                <dd className={cn('tabular-nums', r.warn ? 'font-semibold text-warning' : 'text-fg')}>{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-base text-fg-secondary">Đang kết nối nguồn dữ liệu trực tiếp…</p>
        )}
        <div className="flex justify-center border-t border-line/30 pt-3">
          <Badge variant="tag" size="md" tone={synced ? 'success' : 'warning'}>
            {synced ? 'Sẵn sàng mô phỏng' : health ? 'Kiểm tra dữ liệu trước khi mô phỏng' : 'Chưa sẵn sàng'}
          </Badge>
        </div>
      </div>
    </Card>
  );
}

/** "Lịch sử gần đây" – 4 lượt mới nhất; heading nhận focus khi bấm "Lịch sử mô phỏng" ở header. */
export const RecentRunsCard = forwardRef<HTMLHeadingElement, { runs: readonly SimulationRun[]; scenarios: readonly Scenario[]; now: Date }>(
  function RecentRunsCard({ runs, scenarios, now }, ref) {
    const label = (id: string) => {
      const s = scenarios.find((x) => x.id === id);
      return s ? `${s.code} (${s.shortLabel})` : id;
    };
    return (
      <section aria-labelledby="sim-history-title" className="rounded-lg border border-line/30 bg-surface p-4">
        <h3 id="sim-history-title" ref={ref} tabIndex={-1} className="mb-3 flex items-center gap-2 text-md font-semibold text-fg">
          <HistoryIcon size={18} className="shrink-0 text-fg-secondary" />
          Lịch sử gần đây
        </h3>
        {runs.length === 0 ? (
          <p className="text-base text-fg-secondary">Chưa có lượt mô phỏng nào.</p>
        ) : (
          <ul className="flex flex-col">
            {runs.slice(0, 4).map((r, i) => (
              <li key={r.id} className={cn('flex items-center justify-between gap-3 py-2.5', i > 0 && 'border-t border-line/30')}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-fg">{label(r.scenarioId)}</span>
                  <span className="text-sm tabular-nums text-fg-secondary">{runTimeText(r.at, now)}</span>
                </span>
                <span className={cn('shrink-0 text-md font-semibold', r.result === 'pass' ? 'text-success' : 'text-warning')}>
                  {RUN_RESULT_LABEL[r.result]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  },
);

const SAFETY_RULES = [
  'Không gửi lệnh xuống PLC thật',
  'Không thay đổi trạng thái thiết bị thật',
  'Không kích hoạt ESD thật',
  'Không tạo cảnh báo vận hành thật',
  'Lưu kết quả vào lịch sử',
] as const;

/** "Quy tắc an toàn" – danh sách cố định (cam kết của chế độ mô phỏng; lớp dữ liệu tuân theo – test khoá). */
export function SafetyRulesCard() {
  return (
    <Card title="Quy tắc an toàn" icon={<ShieldPlusIcon size={20} className="shrink-0 text-fg-secondary" />} headerVariant="plain" radius="lg">
      <ul className="flex flex-col gap-2">
        {SAFETY_RULES.map((t) => (
          <li key={t} className="flex items-center gap-2.5 text-base text-fg-secondary">
            <CheckIcon size={16} className="shrink-0 text-primary" />
            {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}
