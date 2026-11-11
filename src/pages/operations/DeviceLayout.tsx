import type { ReactNode } from 'react';
import { Card, DualTrendChart, type DualTrendPoint, type DualTrendSeries, type MetricRow } from '@/components';
import type { DeviceAlerts, DeviceMaintenanceView, PlcSignal } from '@/data/operationDevice';
import type { OperationLogEntry } from '@/features/operations/types';
import type { TagValue } from '@/features/live/types';
import { trendTicks } from '@/features/operations/device';
import { cn } from '@/lib/cn';
import { DeviceMaintenanceCard, OperationLogCard, PlcSignalsCard, RelatedAlertsCard } from './DeviceSideCards';
import type { DeviceViewProps } from './deviceView';

/** Khung + khối dùng chung của trang chi tiết thiết bị (VaporizerView, PlcScadaView). */

type Loadable = { status: 'loading' | 'error' | 'success' };

export type DeviceSideProps = {
  /** "Trạng thái nhanh" – riêng theo loại thiết bị. */
  quick: ReactNode;
  alerts: DeviceAlerts;
  alertsState: Loadable;
  /** Từ khoá mở danh sách cảnh báo liên quan. */
  alertsQuery: string;
  mt: DeviceMaintenanceView;
  maintenanceState: Loadable;
  maintenanceScope: readonly string[];
  deviceId: string;
  showNextMaintenance?: boolean;
  signals: readonly PlcSignal[];
  signalsNote: string;
  liveData: Readonly<Record<string, TagValue>> | undefined;
  log: readonly OperationLogEntry[];
  nowDate: Date;
};

/** 4 KPI → [cột trái (sơ đồ · xu hướng · bảng) | cột phải (trạng thái nhanh · cảnh báo · bảo trì · dữ liệu PLC · nhật ký)]. */
export function DeviceLayout({ kpis, children, side }: { kpis: ReactNode; children: ReactNode; side: DeviceSideProps }) {
  return (
    <>
      <section aria-label="Chỉ số chính" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis}
      </section>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        <aside aria-label="Trạng thái, cảnh báo, bảo trì và nhật ký" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:flex xl:flex-col">
          {side.quick}
          <RelatedAlertsCard alerts={side.alerts} state={side.alertsState} query={side.alertsQuery} />
          <DeviceMaintenanceCard
            mt={side.mt}
            state={side.maintenanceState}
            scope={side.maintenanceScope}
            deviceId={side.deviceId}
            showNext={side.showNextMaintenance}
          />
          <PlcSignalsCard signals={side.signals} liveData={side.liveData} now={side.nowDate.getTime()} note={side.signalsNote} />
          <OperationLogCard log={side.log} now={side.nowDate} />
        </aside>
      </div>
    </>
  );
}

/** Props cột phải lấy thẳng từ props của view (phần chung). */
export const commonSide = (
  p: DeviceViewProps<{ id: string; maintenanceScope: readonly string[]; plcSignals: readonly PlcSignal[]; log: readonly OperationLogEntry[] }>,
) => ({
  alerts: p.alerts,
  alertsState: p.alertsState,
  mt: p.mt,
  maintenanceState: p.maintenanceState,
  maintenanceScope: p.data.maintenanceScope,
  deviceId: p.data.id,
  signals: p.data.plcSignals,
  liveData: p.liveData,
  log: p.data.log,
  nowDate: p.nowDate,
});

/** Thẻ sơ đồ: vùng cuộn ngang có tên (sơ đồ rộng hơn màn hẹp). */
export function DiagramCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title} padding="none">
      <div role="region" aria-label={`${title} (cuộn ngang)`} tabIndex={0} className="overflow-x-auto p-4">
        {children}
      </div>
    </Card>
  );
}

const SWATCH = { accent: 'bg-accent', secondary: 'bg-fg-secondary', warning: 'bg-warning' } as const;

/** Thẻ xu hướng 2 trục: chú thích (ẩn với trình đọc – `label` đã mô tả) + biểu đồ. */
export function TrendCard({
  title,
  legend,
  label,
  heightClass,
  points,
  series,
  minutes,
}: {
  title: string;
  legend: readonly { label: string; swatch: keyof typeof SWATCH }[];
  /** Tóm tắt cho trình đọc màn hình (giá trị hiện tại + ngưỡng). */
  label: string;
  heightClass: string;
  points: readonly DualTrendPoint[];
  series: readonly [DualTrendSeries, DualTrendSeries];
  minutes: number;
}) {
  return (
    <Card
      title={title}
      headerEnd={
        <ul aria-hidden="true" className="flex items-center gap-5 text-sm text-fg-secondary">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2">
              <span className={cn('h-0.5 w-4 rounded-full', SWATCH[l.swatch])} />
              {l.label}
            </li>
          ))}
        </ul>
      }
    >
      <div role="img" aria-label={label} className={heightClass}>
        <DualTrendChart data={points} series={series} xTicks={trendTicks(minutes)} />
      </div>
    </Card>
  );
}

/** Dòng "Cảnh báo nghiêm trọng" của Trạng thái nhanh ('—' khi chưa tải xong). */
export function criticalAlertsRow(alerts: DeviceAlerts, state: Loadable, zeroTone: MetricRow['tone']): MetricRow {
  const ready = state.status === 'success';
  return {
    id: 'critical',
    label: 'Cảnh báo nghiêm trọng',
    value: !ready ? '—' : alerts.criticalOpen === 0 ? 'Không có' : String(alerts.criticalOpen),
    tone: !ready ? 'default' : alerts.criticalOpen === 0 ? zeroTone : 'danger',
  };
}
