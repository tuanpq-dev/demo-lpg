import { AlertItem, Button, Card, DonutGauge, MaintenanceSummaryCard } from '@/components';
import type { deriveMaintenanceSummary, deriveRelatedAlerts } from '@/data/assetDetail';
import type { AssetData } from './AssetKpiSection';

export type AssetAsideProps = {
  data: AssetData;
  related: ReturnType<typeof deriveRelatedAlerts>;
  summary: ReturnType<typeof deriveMaintenanceSummary>;
  /** Mở một cảnh báo / danh sách cảnh báo theo tài sản. */
  onOpenAlert: (id: string) => void;
  onAllAlerts: () => void;
};

/** Cột phải: tình trạng tài sản (số tạm), cảnh báo liên quan + "Xem tất cả", tóm tắt bảo trì. */
export function AssetAside({ data, related, summary, onOpenAlert, onAllAlerts }: AssetAsideProps) {
  const ph = data.placeholders;
  return (
    <aside aria-label="Tình trạng, cảnh báo và bảo trì" className="grid gap-6 lg:col-span-2 lg:grid-cols-3 xl:col-span-1 xl:flex xl:flex-col">
      <Card title="Tình trạng tài sản" headerVariant="plain">
        <div className="flex flex-col items-center gap-4">
          <DonutGauge
            size={132}
            ringWidth={10}
            hideLegend
            label={`Tình trạng tài sản ${ph.health.value}%, tối ưu (số tạm)`}
            segments={[
              { id: 'ok', label: 'Tốt', value: ph.health.value, tone: 'success' },
              { id: 'rest', label: 'Còn lại', value: 100 - ph.health.value, tone: 'offline' },
            ]}
            center={{ value: `${ph.health.value}%`, caption: 'Tối ưu', tone: 'success' }}
          />
          <p className="self-stretch text-sm text-fg-muted">Hệ thống đang vận hành trong thông số kỹ thuật cho phép.</p>
        </div>
      </Card>

      <Card title="Cảnh báo liên quan" padding="none" className="min-h-[196px]">
        {related.length ? (
          related.map((a, i) => <AlertItem key={a.id} layout="inline" {...a} last={i === related.length - 1} onClick={() => onOpenAlert(a.id)} />)
        ) : (
          <p className="px-4 py-6 text-sm text-fg-secondary">Không có cảnh báo liên quan.</p>
        )}
        <div className="mt-auto border-t border-line/30 bg-surface-muted/10 py-2 text-center">
          <Button variant="link" onClick={onAllAlerts}>
            Xem tất cả
          </Button>
        </div>
      </Card>

      <MaintenanceSummaryCard
        next={
          summary.next && {
            date: summary.next.date,
            note: summary.next.overdue || summary.next.daysLeft <= 7 ? summary.next.dueText : undefined,
            overdue: summary.next.overdue,
          }
        }
        last={summary.last && { date: summary.last.date }}
        records={{
          value: ph.recordCompleteness.value,
          status: ph.recordCompleteness.value >= 100 ? 'Đầy đủ' : `${ph.recordCompleteness.value}%`,
          hint: `Số tạm: ${ph.recordCompleteness.note}`,
        }}
      />
    </aside>
  );
}
