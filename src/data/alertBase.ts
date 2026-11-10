/** Cấu hình theo loại cảnh báo, chỉ số chính, nhãn thời gian, nhân sự. Tách từ alertDetail.ts. */
import { formatGaugeNumber, withUnit } from '@/features/alerts/gauge';
import { formatDayVi, parsePlantDateTime, plantDayKey } from '@/lib/plantTime';
import type { AlertDirection, AlertRecord } from '@/features/alerts/types';
import { ALERT_KINDS, fillPlaybookText } from '@/mocks/alertKinds';
import type { AlertKindConfig } from '@/features/alerts/kinds';
import { nearbySensor } from '@/mocks/sensors';
import { assetMocks } from '@/mocks/assets';
import { STAFF } from '@/mocks/maintenance';

/**
 * Người nhận xử lý cảnh báo = TOÀN BỘ `STAFF` (kể cả trưởng ca / quản lý vận hành). Khác bảo trì (chỉ technician +
 * engineer – `ASSIGNABLE_STAFF`) là CÓ CHỦ ĐÍCH: cảnh báo thuộc vận hành, trưởng ca thường là người nhận đầu tiên.
 */
export const ALERT_STAFF = STAFF;

/** Ngày giờ phát sinh "10:45:22 - 12/10/2026" (ngày = hôm nay − daysAgo theo giờ nhà máy). */
export function alertDateTimeLabel(a: Pick<AlertRecord, 'daysAgo' | 'time'>, now: Date): string {
  const [y, m, d] = plantDayKey(now).split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! - a.daysAgo));
  return `${a.time} - ${formatDayVi(t.toISOString())}`;
}

/** "10:45 hôm nay" · "22:41 hôm qua" · "20:16 24/10/2026" – thẻ đầu modal phân công. */
export function alertShortTimeLabel(a: Pick<AlertRecord, 'daysAgo' | 'time'>, now: Date): string {
  const hm = a.time.slice(0, 5);
  if (a.daysAgo === 0) return `${hm} hôm nay`;
  if (a.daysAgo === 1) return `${hm} hôm qua`;
  return `${hm} ${alertDateTimeLabel(a, now).split(' - ')[1]}`;
}

export type AlertMetric = {
  value: number;
  /** "Ngưỡng cho phép": cấu hình tag (warn / lowWarn theo chiều) nếu có, không thì ngưỡng của bản ghi. */
  threshold: number;
  /** Mức nguy hiểm của cấu hình (đặt thang đo); undefined = không có cấu hình. */
  danger?: number;
  unit: string;
  direction: AlertDirection;
  tag?: string;
  fromConfig: boolean;
};

/** Ngưỡng của tag trong cấu hình tài sản (`mocks/assets.ts`) – tìm tài sản có tag này. */
export function configFor(tag: string | undefined) {
  if (!tag) return undefined;
  for (const asset of Object.values(assetMocks)) {
    const field = (Object.keys(asset.tags) as (keyof typeof asset.tags)[]).find((k) => asset.tags[k] === tag);
    if (field && field in asset.alarms)
      return asset.alarms[field as keyof typeof asset.alarms] as { warn?: number; danger?: number; lowWarn?: number; lowDanger?: number };
  }
  return undefined;
}

/** Số liệu cảnh báo + ngưỡng + chiều. Giá trị là "giá trị LÚC CẢNH BÁO" của bản ghi (không phải số trực tiếp). */
export function alertMetric(a: AlertRecord): AlertMetric {
  const direction = a.direction ?? 'above';
  const cfg = configFor(a.tag);
  const cfgThreshold = direction === 'above' ? cfg?.warn : cfg?.lowWarn;
  const cfgDanger = direction === 'above' ? cfg?.danger : cfg?.lowDanger;
  return {
    value: Number(a.value),
    threshold: cfgThreshold ?? Number(a.threshold),
    danger: cfgThreshold !== undefined ? cfgDanger : undefined,
    unit: a.unit,
    direction,
    tag: a.tag,
    fromConfig: cfgThreshold !== undefined,
  };
}

export const metricText = (n: number, unit: string) => withUnit(formatGaugeNumber(n), unit);

/** Cấu hình loại của cảnh báo (`ALERT_KINDS`, thiếu → generic). */
export const alertKind = (a: Pick<AlertRecord, 'kind'>): AlertKindConfig => ALERT_KINDS[a.kind ?? 'generic'] ?? ALERT_KINDS.generic;

/** Nguyên nhân + hướng dẫn theo loại, chữ đã thay `{device}` / `{safetyValve}` / `{nearbySensor}`. */
export function alertPlaybook(a: Pick<AlertRecord, 'kind' | 'device' | 'tag'>) {
  const pb = alertKind(a);
  const vars = { nearbySensor: nearbySensor(a.tag ?? a.device), tag: a.tag };
  return {
    label: pb.label,
    gauge: pb.gauge !== false,
    causes: pb.causes.map((c) => fillPlaybookText(c, a.device, vars)),
    steps: pb.steps.map((s) => ({ id: s.id, text: fillPlaybookText(s.text, a.device, vars) })),
  };
}

/** Thời điểm phát sinh (giờ nhà máy: hôm nay − daysAgo, lúc `time`). */
export function alertOccurredAt(a: Pick<AlertRecord, 'daysAgo' | 'time'>, now: Date): Date {
  const [y, m, d] = plantDayKey(now).split('-').map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d! - a.daysAgo)).toISOString().slice(0, 10);
  return parsePlantDateTime(`${day}T${a.time}`) ?? now;
}
