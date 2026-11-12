/** Điều kiện hệ thống để đóng cảnh báo (đọc live) + tóm tắt. Tách từ alertDetail.ts. */
import type { AlertDirection, AlertRecord } from '@/features/alerts/types';
import { closeConditions, type CloseCondition, type CloseConditionInput, type RelatedAlert } from '@/features/alerts/close';
import { HEAT_DETECTORS, type HeatDetector } from '@/mocks/sensors';
import { detectorStatus } from '@/features/alerts/fire';
import type { LiveData } from '@/features/live/types';
import { useLiveData } from './live';
import { useRelatedOpen } from './alertApi';
import { type AlertLiveReading, liveReading, readingOf } from './alertLive';
import { alertKind, alertMetric } from './alertBase';
import { closeLimit, updateConfig, updateReadingRows } from './alertUpdateData';

type CloseSpec = {
  primary: { label: string; tag?: string; limit: number; unit: string; direction: AlertDirection } | null;
  secondary: { label: string; tag: string; warn?: number; alarm?: boolean }[];
  detector?: HeatDetector;
};

/** Tag cần đọc để kiểm 3 điều kiện của một cảnh báo (theo cấu hình loại). */
function closeSpec(a: AlertRecord): CloseSpec {
  const u = updateConfig(a);
  if (u) {
    const rows = updateReadingRows(a, u);
    const p = rows.find((r) => r.primary)!;
    return {
      primary: p.tag
        ? { label: p.label, tag: p.tag, limit: closeLimit(a), unit: p.unit, direction: 'above' }
        : { label: p.label, limit: closeLimit(a), unit: p.unit, direction: 'above' },
      secondary: rows.filter((r) => !r.primary && r.tag).map((r) => ({ label: r.label, tag: r.tag!, warn: r.warn, alarm: r.alarm })),
      detector: u.close.rule === 'fire' ? HEAT_DETECTORS[a.device] : undefined,
    };
  }
  const m = alertMetric(a);
  return { primary: a.tag ? { label: a.tag, tag: a.tag, limit: m.threshold, unit: a.unit, direction: m.direction } : null, secondary: [] };
}

/** Trạng thái tín hiệu phụ: số ≥ ngưỡng cảnh báo / chuỗi 'alarm' → bất thường; mất tín hiệu không chặn. */
function secondaryState(s: CloseSpec['secondary'][number], r: AlertLiveReading): 'ok' | 'abnormal' | 'lost' | 'pending' {
  if (r.state === 'pending') return 'pending';
  if (r.state !== 'ok') return 'lost';
  if (s.alarm) return r.text === 'alarm' ? 'abnormal' : 'ok';
  return s.warn !== undefined && r.value !== undefined && r.value >= s.warn ? 'abnormal' : 'ok';
}

/** Đầu vào thuần của `closeConditions` từ LiveData đã đọc (tách khỏi hook để test). */
function closeConditionInput(a: AlertRecord, related: readonly RelatedAlert[], live: LiveData | undefined, now: number): CloseConditionInput {
  const spec = closeSpec(a);
  const read = (tag: string | undefined): AlertLiveReading => (tag ? liveReading(live, tag, now) : { state: 'lost' });
  const p = spec.primary;
  const pr = p ? read(p.tag) : undefined;
  const d = spec.detector;
  const st = d ? detectorStatus(readingOf(live, d.alarmTag, now), readingOf(live, d.stateTag, now)) : undefined;
  return {
    primary:
      p && pr
        ? {
            label: p.label,
            reading: { state: pr.state === 'none' ? 'lost' : pr.state, value: pr.value },
            limit: p.limit,
            unit: p.unit,
            direction: p.direction,
          }
        : null,
    secondary: spec.secondary.map((s) => ({ label: s.label, state: secondaryState(s, read(s.tag)) })),
    detector: d && st ? { name: d.id, alarm: st.alarm, device: live ? st.device : 'pending' } : undefined,
    related,
  };
}

/** Tag cần đọc cho danh sách cảnh báo (một lần `useLiveData` cho cả modal đóng lẫn đóng hàng loạt). */
function closeTags(alerts: readonly AlertRecord[]): string[] {
  const out = new Set<string>();
  for (const a of alerts) {
    const s = closeSpec(a);
    if (s.primary?.tag) out.add(s.primary.tag);
    s.secondary.forEach((x) => out.add(x.tag));
    if (s.detector) [s.detector.alarmTag, s.detector.stateTag].forEach((t) => out.add(t));
  }
  return [...out].sort();
}

/** Điều kiện "không còn cảnh báo liên quan" khi máy chủ chưa trả danh sách liên quan – chưa đạt (không cho đóng sớm). */
const RELATED_PENDING: CloseCondition = { id: 'no-related', ok: false, reason: 'Đang kiểm tra cảnh báo liên quan…' };

/**
 * 3 điều kiện hệ thống theo id cảnh báo – đọc live một lần cho cả danh sách; cảnh báo liên quan đang mở hỏi máy chủ
 * (GET /alerts/related-open). Mất tín hiệu theo `tagSignal` lúc render.
 */
export function useCloseConditions(alerts: readonly AlertRecord[]): Record<string, CloseCondition[]> {
  const tags = closeTags(alerts);
  const live = useLiveData(tags, { enabled: tags.length > 0 });
  const related = useRelatedOpen(alerts.map((a) => a.id));
  const now = Date.now();
  return Object.fromEntries(
    alerts.map((a) => {
      const rel = related?.[a.id];
      const conds = closeConditions(closeConditionInput(a, rel ?? [], tags.length ? live : {}, now));
      return [a.id, rel ? conds : conds.map((c) => (c.id === 'no-related' ? RELATED_PENDING : c))];
    }),
  );
}

/**
 * "Kết quả kỹ thuật" (modal đóng, chỉ đọc – từ dữ liệu modal cập nhật): nguyên nhân, hành động, số trước/sau của tag chính
 * + ngưỡng đóng ("< 10.5 bar"; chiều thấp → "> …"). Cháy báo động giả → `falseAlarm` (UI thay khối thông số).
 */
export function closeSummary(a: AlertRecord) {
  const u = updateConfig(a);
  const primaryId = u ? updateReadingRows(a, u).find((r) => r.primary)?.id : undefined;
  const m = alertMetric(a);
  const after = a.readings?.rows.find((r) => r.id === primaryId)?.after ?? a.closingReading?.value;
  const lastNote = a.notes?.at(-1)?.text;
  return {
    cause: a.cause ?? null,
    action: a.actionTaken ?? lastNote ?? null,
    falseAlarm: a.resolution?.kind === 'false-alarm',
    quantity: u ? u.quantity : 'Giá trị',
    before: Number.isFinite(m.value) && alertKind(a).numericValue !== false ? m.value : undefined,
    after,
    limit: closeLimit(a),
    direction: m.direction,
    unit: a.unit,
  };
}
