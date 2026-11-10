import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertItem, Badge, Button, Card, EventTimeline, Icon, StatusDot, StatusPill, UserIcon, type StatusPillTone } from '@/components';
import type { DeviceAlerts, DeviceMaintenanceView } from '@/data/operationDevice';
import { SIGNAL_LOST_LABEL, tagSignal } from '@/features/live/signal';
import type { TagValue } from '@/features/live/types';
import { logTimeLabel, type ViewTone } from '@/features/operations/device';
import { cn } from '@/lib/cn';
import type { OperationLogEntry, PlcSignal } from '@/features/operations/types';

/*
 * Thẻ cột phải dùng chung mọi loại thiết bị ở màn Vận hành (máy hóa hơi E-101A, hệ thống PLC/SCADA).
 */

export const textTone: Record<ViewTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-text',
  neutral: 'text-fg-secondary',
};
const pillTone = (t: ViewTone): StatusPillTone => t;

type Loadable = { status: 'loading' | 'error' | 'success' };

/** "Cảnh báo liên quan": 3 mục mới nhất (bấm → drawer ở /alerts) + "Xem tất cả cảnh báo". */
export function RelatedAlertsCard({ alerts, state, query }: { alerts: DeviceAlerts; state: Loadable; query: string }) {
  const navigate = useNavigate();
  return (
    <Card
      title="Cảnh báo liên quan"
      headerVariant="divided"
      headerEnd={
        state.status === 'success' ? (
          <Badge variant="tag" tone="neutral">
            {alerts.total} mục
          </Badge>
        ) : undefined
      }
      bodyClassName="gap-2"
    >
      {state.status !== 'success' ? (
        <p className="py-4 text-sm text-fg-secondary">{state.status === 'error' ? 'Không tải được cảnh báo.' : 'Đang tải…'}</p>
      ) : alerts.items.length ? (
        <ul className="flex flex-col gap-2">
          {alerts.items.map((a) => (
            <li key={a.id}>
              <AlertItem layout="bar" {...a} onClick={() => void navigate(`/alerts?alert=${encodeURIComponent(a.id)}&range=30d`)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-fg-secondary">Không có cảnh báo liên quan.</p>
      )}
      <Button variant="subtle" className="mt-2 w-full" onClick={() => void navigate(`/alerts?q=${encodeURIComponent(query)}&range=30d`)}>
        Xem tất cả cảnh báo
      </Button>
    </Card>
  );
}

/** "Bảo trì": kỹ thuật viên, lần cuối, hạng mục (số tạm), [bảo trì tiếp theo], "Xem lịch sử bảo trì". */
export function DeviceMaintenanceCard({
  mt,
  state,
  scope,
  deviceId,
  showNext,
}: {
  mt: DeviceMaintenanceView;
  state: Loadable;
  scope: readonly string[];
  deviceId: string;
  /** Dòng "Bảo trì tiếp theo" trong thẻ (màn PLC/SCADA – E-101A đặt ở "Trạng thái nhanh"). */
  showNext?: boolean;
}) {
  const navigate = useNavigate();
  const ok = state.status === 'success';
  return (
    <Card
      title="Bảo trì"
      headerVariant="divided"
      headerEnd={
        ok ? (
          <StatusPill size="sm" tone={pillTone(mt.badge.tone)}>
            {mt.badge.label}
          </StatusPill>
        ) : undefined
      }
      bodyClassName="gap-3"
    >
      <dl className="flex flex-col gap-2 text-base">
        <div className="flex items-center gap-2">
          <UserIcon size={18} className="shrink-0 text-fg-secondary" />
          <dt className="text-fg-secondary">Kỹ thuật viên:</dt>
          <dd className="font-semibold text-fg">{ok ? mt.technician : '—'}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="calendar" box={18} />
          <dt className="text-fg-secondary">Lần bảo trì cuối:</dt>
          <dd className="font-semibold tabular-nums text-fg">{ok ? mt.lastDate : '—'}</dd>
        </div>
      </dl>
      <div className="rounded-md border border-line/30 p-3">
        <p className="mb-1.5 text-sm text-fg-secondary">Hạng mục chi tiết:</p>
        <ul className="flex flex-col gap-1.5 pl-2 text-base text-fg" title="Phạm vi bảo dưỡng định kỳ – số tạm, chờ kế hoạch bảo trì từ hệ thống">
          {scope.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      {showNext && (
        <p className="flex items-center justify-between gap-3 text-md">
          <span className="text-fg">Bảo trì tiếp theo</span>
          <span className={cn('font-semibold', !ok ? 'text-fg-secondary' : mt.next.tone === 'neutral' ? 'text-accent' : textTone[mt.next.tone])}>
            {ok ? (mt.next.tone === 'neutral' && /^\d/.test(mt.next.text) ? `Còn ${mt.next.text}` : mt.next.text) : '—'}
          </span>
        </p>
      )}
      <Button variant="subtle" className="w-full" onClick={() => void navigate(`/maintenance?q=${encodeURIComponent(deviceId)}`)}>
        Xem lịch sử bảo trì
      </Button>
    </Card>
  );
}

/** "Dữ liệu PLC/SCADA": tín hiệu PLC + trạng thái tín hiệu (mất tín hiệu → xám). */
export function PlcSignalsCard({
  signals,
  liveData,
  now,
  note,
  headerEnd,
}: {
  signals: readonly PlcSignal[];
  liveData: Readonly<Record<string, TagValue>> | undefined;
  now: number;
  note: string;
  headerEnd?: ReactNode;
}) {
  return (
    <Card title="Dữ liệu PLC/SCADA" headerVariant="divided" headerEnd={headerEnd} bodyClassName="gap-3">
      <ul aria-label="Tín hiệu PLC/SCADA" className="flex flex-col gap-2">
        {signals.map((s) => {
          const st = !liveData ? 'pending' : tagSignal(liveData[s.tag], now) === 'lost' ? 'lost' : 'ok';
          const ok = st === 'ok';
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-md border border-line/30 bg-surface-muted/10 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base text-fg">{s.label}</span>
                {s.address && <span className="truncate font-mono text-2xs text-fg-secondary">{s.address}</span>}
              </span>
              <span className={cn('shrink-0 text-xs font-semibold', ok ? 'text-success' : 'text-fg-secondary')}>
                {ok ? 'Trực tuyến' : st === 'lost' ? SIGNAL_LOST_LABEL : '—'}
              </span>
              <StatusDot status={ok ? 'live' : 'offline'} />
            </li>
          );
        })}
      </ul>
      <p className="text-sm italic text-fg-secondary">{note}</p>
    </Card>
  );
}

export function OperationLogCard({ log, now }: { log: readonly OperationLogEntry[]; now: Date }) {
  return (
    <Card title="Nhật ký vận hành" headerVariant="divided">
      <EventTimeline variant="schedule" events={log.map((l) => ({ id: l.id, title: l.text, time: logTimeLabel(l, now) }))} />
    </Card>
  );
}
