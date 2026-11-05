/*
 * Báo cháy (loại cảnh báo `fire`, ảnh FIR-00018) – thuần, có test (fire.test.ts). Đọc giá trị tag đã qua quy tắc mất tín hiệu
 * (`state: 'lost'` = không dùng số/chuỗi cũ). Không gọi Date.now().
 *
 * Trạng thái đầu báo TÁCH 2 khái niệm (thay chữ "Hoạt động" mơ hồ của ảnh):
 * - thiết bị: Trực tuyến · Mất kết nối · Lỗi (tag `.STATE` = 'fault') – kết nối theo tag báo động.
 * - báo động: Đang báo động · Đã phục hồi · không rõ (mất tín hiệu).
 */
import type { AlertBand } from '@/features/alerts/kinds';
import { bandOf, levelStart } from './bands';
import { formatMeasure } from './gauge';

/** Một tag sau quy tắc tín hiệu: pending = chưa nhận lần đầu · lost = mất tín hiệu · ok = có giá trị. */
export type TagReading = { state: 'pending' | 'lost' | 'ok'; value?: number | string };

export type DetectorDevice = 'pending' | 'online' | 'lost' | 'fault';
export type DetectorAlarm = 'unknown' | 'active' | 'cleared';

export const DEVICE_LABEL: Readonly<Record<DetectorDevice, string>> = { pending: '—', online: 'Trực tuyến', lost: 'Mất kết nối', fault: 'Lỗi' };
export const ALARM_LABEL: Readonly<Record<DetectorAlarm, string>> = { unknown: 'Không rõ', active: 'Đang báo động', cleared: 'Đã phục hồi' };

/** Thiết bị + báo động của đầu báo từ tag `.ALARM` ('alarm' | 'normal') và `.STATE` ('online' | 'fault'). */
export function detectorStatus(alarm: TagReading, state: TagReading): { device: DetectorDevice; alarm: DetectorAlarm } {
  const device: DetectorDevice = alarm.state === 'pending' ? 'pending' : alarm.state === 'lost' ? 'lost' : state.state === 'ok' && state.value === 'fault' ? 'fault' : 'online';
  const a: DetectorAlarm = alarm.state !== 'ok' ? 'unknown' : alarm.value === 'alarm' ? 'active' : alarm.value === 'normal' ? 'cleared' : 'unknown';
  return { device, alarm: a };
}

export type SignalTone = 'success' | 'warning' | 'danger' | 'neutral';
export type FireSignalKind = 'gas' | 'smoke' | 'call-point';
/** Một dòng "Tín hiệu liên quan": chữ hiển thị, tone, có bất thường không (xác nhận chéo), lý do cho banner. */
export type FireSignalView = { text: string; tone: SignalTone; lost: boolean; abnormal: boolean; reason?: string };

/**
 * Đánh giá một tín hiệu liên quan. Gas bất thường khi ≥ đầu mức `level-1` của bands (cấu hình gas, 10 % LEL); khói khi 'alarm';
 * nút nhấn khi 'activated'. Mất tín hiệu → không bất thường (không suy diễn), chữ "Mất tín hiệu".
 */
export function fireSignalView(kind: FireSignalKind, label: string, r: TagReading, gas: { bands: readonly AlertBand[]; unit: string }): FireSignalView {
  if (r.state === 'pending') return { text: '—', tone: 'neutral', lost: false, abnormal: false };
  if (r.state === 'lost') return { text: 'Mất tín hiệu', tone: 'neutral', lost: true, abnormal: false };
  if (kind === 'gas') {
    if (typeof r.value !== 'number') return { text: 'Mất tín hiệu', tone: 'neutral', lost: true, abnormal: false };
    const b = bandOf(r.value, gas.bands);
    const from = levelStart(gas.bands, 'level-1') ?? Infinity;
    const abnormal = r.value >= from;
    const tone: SignalTone = b.tone === 'success' ? 'success' : b.tone === 'danger' ? 'danger' : 'warning';
    const measure = formatMeasure(r.value, gas.unit);
    return { text: `${measure} - ${b.label}`, tone, lost: false, abnormal, reason: abnormal ? `${label} ${measure} (${b.label.toLowerCase()})` : undefined };
  }
  if (kind === 'smoke') {
    const on = r.value === 'alarm';
    return { text: on ? 'Đang báo động' : 'Bình thường', tone: on ? 'danger' : 'success', lost: false, abnormal: on, reason: on ? `${label} đang báo động` : undefined };
  }
  const on = r.value === 'activated';
  return { text: on ? 'Đã kích hoạt' : 'Chưa kích hoạt', tone: on ? 'danger' : 'neutral', lost: false, abnormal: on, reason: on ? 'Nút nhấn khẩn cấp đã được kích hoạt' : undefined };
}

export type CrossConfirm = { active: false } | { active: true; callPoint: boolean; reasons: string[]; stage: string };

/**
 * Xác nhận chéo (ngoài Figma, docs/figma-diffs.md): ngoài đầu báo nhiệt còn ít nhất MỘT tín hiệu liên quan bất thường (khói,
 * gas ≥ cấp 1, nút nhấn đã kích hoạt) → banner "Nhiều tín hiệu cùng báo". `stage` = tập nguồn → banner chỉ đọc lại khi nguồn đổi.
 */
export function crossConfirm(signals: readonly (FireSignalView & { kind: FireSignalKind })[]): CrossConfirm {
  const hit = signals.filter((s) => s.abnormal);
  if (!hit.length) return { active: false };
  const callPoint = hit.some((s) => s.kind === 'call-point');
  return { active: true, callPoint, reasons: hit.map((s) => s.reason!).filter(Boolean), stage: hit.map((s) => s.kind).sort().join('+') };
}

/** Chữ banner: nút nhấn đứng đầu + ghi rõ "Nút nhấn khẩn cấp đã được kích hoạt". */
export function crossConfirmText(c: Extract<CrossConfirm, { active: true }>): string {
  const ordered = c.callPoint ? ['Nút nhấn khẩn cấp đã được kích hoạt', ...c.reasons.filter((r) => !r.startsWith('Nút nhấn'))] : c.reasons;
  return `${ordered.join(' · ')}. Đầu báo nhiệt và tín hiệu khác cùng báo – xác minh hiện trường và sẵn sàng phương án sơ tán.`;
}

export type FireCloseCheck =
  | { ok: true; source: 'live' | 'field' }
  | { ok: false; reason: 'pending' | 'still-alarm' | 'need-field-check'; message: string };

/**
 * Đóng cảnh báo cháy (Đã xử lý sự cố / Báo động giả) chỉ khi đầu báo ĐÃ PHỤC HỒI (live). Còn báo động → chặn (kể cả có tick
 * kiểm tra tại chỗ). Mất tín hiệu → bắt buộc xác nhận đã kiểm tra tại chỗ.
 */
export function canCloseFire(input: { alarm: DetectorAlarm; device: DetectorDevice; fieldChecked?: boolean; detector: string }): FireCloseCheck {
  if (input.device === 'pending') return { ok: false, reason: 'pending', message: 'Đang đọc trạng thái đầu báo…' };
  if (input.alarm === 'active') return { ok: false, reason: 'still-alarm', message: `Đầu báo ${input.detector} vẫn đang báo động – chỉ đóng khi đầu báo đã phục hồi.` };
  if (input.alarm === 'cleared') return { ok: true, source: 'live' };
  return input.fieldChecked
    ? { ok: true, source: 'field' }
    : { ok: false, reason: 'need-field-check', message: `Đầu báo ${input.detector} mất tín hiệu – xác nhận đã kiểm tra tại chỗ trước khi đóng.` };
}

/** Trạng thái máy trong khu ('running' | 'standby' | 'fault' | 'stopped') → chữ + tone. */
export function equipmentStateView(r: TagReading): { text: string; role?: string; tone: SignalTone; lost: boolean } {
  if (r.state === 'pending') return { text: '—', tone: 'neutral', lost: false };
  if (r.state === 'lost') return { text: 'Mất tín hiệu', tone: 'neutral', lost: true };
  switch (r.value) {
    case 'running':
      return { text: 'Đang hoạt động', tone: 'success', lost: false };
    case 'standby':
      return { text: 'Sẵn sàng', role: 'Dự phòng', tone: 'success', lost: false };
    case 'fault':
      return { text: 'Sự cố', tone: 'danger', lost: false };
    default:
      return { text: 'Dừng', tone: 'neutral', lost: false };
  }
}
