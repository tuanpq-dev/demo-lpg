/*
 * Logic thuần màn Vận hành – chi tiết hệ thống PLC/SCADA (Figma bản sao A88YJ2BRhICDDdeu2rtRg1 – 168:4689). `now` truyền vào.
 * Mọi giá trị đọc từ tag trực tiếp; mất tín hiệu (bad / ≥ 10 s / thiếu tag) → "Mất tín hiệu" xám, KHÔNG giữ số cũ.
 */
import { SIGNAL_LOST_LABEL, tagSignal } from '@/features/live/signal';
import type { TagValue } from '@/features/live/types';
import { plantTimeOfDay } from '@/lib/plantTime';
import { readParam, type ViewTone } from './device';

/** Tông badge cột "Trạng thái" – thêm `primary` cho "Thông tin" (ảnh: badge xanh dương). */
export type RowTone = ViewTone | 'primary';

type LiveMap = Readonly<Record<string, TagValue>> | undefined;

// ============================================================================
// Tag trạng thái (chuỗi)
// ============================================================================

export type StateRead = { state: 'pending' | 'lost' | 'ok'; raw?: string; ts?: number };

/** Đọc tag chuỗi: chưa có ảnh chụp đầu → pending; mất tín hiệu / không phải chuỗi → lost. */
export function readStateTag(tv: TagValue | undefined, live: boolean, now: number): StateRead {
  if (!live) return { state: 'pending' };
  if (tagSignal(tv, now) === 'lost' || typeof tv?.value !== 'string') return { state: 'lost', ts: tv?.ts };
  return { state: 'ok', raw: tv.value, ts: tv.ts };
}

/** Giá trị + nhãn trạng thái của một tag chuỗi theo bảng ánh xạ; giá trị lạ → "Không xác định". */
export type StateView = { value: string; status: string; tone: RowTone };

export function stateView(r: StateRead, map: Readonly<Record<string, StateView>>): StateView {
  if (r.state === 'pending') return { value: '—', status: '—', tone: 'neutral' };
  if (r.state === 'lost') return { value: SIGNAL_LOST_LABEL, status: SIGNAL_LOST_LABEL, tone: 'neutral' };
  return map[r.raw!] ?? { value: r.raw!, status: 'Không xác định', tone: 'warning' };
}

/** Bảng ánh xạ giá trị tag → hiển thị (theo ảnh: "OK / Ổn định", "Đang hoạt động / Bình thường", "SCADA Từ xa / Thông tin"). */
export const HEARTBEAT_VIEW: Record<string, StateView> = {
  ok: { value: 'OK', status: 'Ổn định', tone: 'success' },
  lost: { value: 'Không nhận', status: 'Mất heartbeat', tone: 'danger' },
};
const LINK_VIEW: Record<string, StateView> = {
  active: { value: 'Đang hoạt động', status: 'Bình thường', tone: 'success' },
  down: { value: 'Mất kết nối', status: 'Mất kết nối', tone: 'danger' },
};
export const MODE_VIEW: Record<string, StateView> = {
  'scada-remote': { value: 'SCADA Từ xa', status: 'Thông tin', tone: 'primary' },
  local: { value: 'Tại chỗ (Local)', status: 'Thông tin', tone: 'primary' },
};
export const HISTORIAN_VIEW: Record<string, StateView> = {
  ok: { value: 'Thành công', status: 'Bình thường', tone: 'success' },
  failed: { value: 'Thất bại', status: 'Cảnh báo', tone: 'warning' },
};

// ============================================================================
// Trạng thái PLC / SCADA (KPI, trạng thái nhanh, header)
// ============================================================================

export type LinkStatusView = {
  /** KPI / trạng thái nhanh: "Trực tuyến" · "Đã kết nối" · "Mất kết nối" · "Mất tín hiệu". */
  label: string;
  tone: ViewTone;
  /** Pill "Trạng thái" ở header: "Đang hoạt động" · "Mất kết nối" … */
  headerLabel: string;
};

/** PLC: heartbeat + liên kết PLC đều tốt → "Trực tuyến"; một trong hai mất tín hiệu → xám; báo hỏng → đỏ. */
export function plcStatus(heartbeat: StateRead, link: StateRead): LinkStatusView {
  if (heartbeat.state === 'pending' || link.state === 'pending') return { label: '—', tone: 'neutral', headerLabel: '—' };
  if (heartbeat.state === 'lost' || link.state === 'lost') return { label: SIGNAL_LOST_LABEL, tone: 'neutral', headerLabel: SIGNAL_LOST_LABEL };
  if (heartbeat.raw === 'ok' && link.raw === 'active') return { label: 'Trực tuyến', tone: 'success', headerLabel: 'Đang hoạt động' };
  return { label: 'Mất kết nối', tone: 'danger', headerLabel: 'Mất kết nối' };
}

/** SCADA: liên kết SCADA 'active' → "Đã kết nối". */
export function scadaStatus(link: StateRead): LinkStatusView {
  if (link.state === 'pending') return { label: '—', tone: 'neutral', headerLabel: '—' };
  if (link.state === 'lost') return { label: SIGNAL_LOST_LABEL, tone: 'neutral', headerLabel: SIGNAL_LOST_LABEL };
  return link.raw === 'active'
    ? { label: 'Đã kết nối', tone: 'success', headerLabel: 'Đã kết nối' }
    : { label: 'Mất kết nối', tone: 'danger', headerLabel: 'Mất kết nối' };
}

// ============================================================================
// Tag khả dụng
// ============================================================================

export type TagAvailability = { ok: number; total: number; lost: number; percent: number };

/** Tag giám sát còn tín hiệu / tổng (không trùng). Chưa có số liệu → undefined. */
export function tagAvailability(tags: readonly string[], live: LiveMap, now: number): TagAvailability | undefined {
  if (!live) return undefined;
  const unique = [...new Set(tags)];
  const lost = unique.filter((t) => tagSignal(live[t], now) === 'lost').length;
  const ok = unique.length - lost;
  return { ok, total: unique.length, lost, percent: unique.length ? Math.round((ok / unique.length) * 1000) / 10 : 0 };
}

/** Nút nguồn của sơ đồ: mọi tag của nhóm có tín hiệu → ok; có tag mất → lost. */
export function sourceState(tags: readonly string[], live: LiveMap, now: number): 'pending' | 'ok' | 'lost' {
  if (!live) return 'pending';
  return tags.some((t) => tagSignal(live[t], now) === 'lost') ? 'lost' : 'ok';
}

// ============================================================================
// Bảng "Thông số vận hành chi tiết" (9 dòng)
// ============================================================================

export type PlcRow = {
  id: string;
  label: string;
  value: string;
  /** Giá trị có số / trạng thái đọc được (chữ accent) – false = "—" / mất tín hiệu (xám). */
  valueOk: boolean;
  unit: string;
  /** Cột "Ngưỡng cảnh báo": điều kiện bị coi là bất thường ("> 3.0 giây", "Mất kết nối PLC"). */
  alarm: string;
  status: string;
  tone: RowTone;
  /** Giờ cập nhật "18:03:42" (giờ nhà máy); không có → undefined. */
  updated?: string;
};

export type PlcRowInput = {
  tags: {
    heartbeat: string;
    plcLink: string;
    scadaLink: string;
    latency: string;
    packetLoss: string;
    mode: string;
    historian: string;
  };
  limits: { latency: { warn: number }; packetLoss: { warn: number }; minAvailableTags: number };
  availability: TagAvailability | undefined;
  /** Giờ cập nhật dòng tag khả dụng = lúc tính (now). */
};

const clock = (ts: number | undefined) => (ts === undefined ? undefined : plantTimeOfDay(new Date(ts)));

/** 9 dòng theo ảnh: heartbeat · kết nối PLC · kết nối SCADA · độ trễ · tag khả dụng · tag lỗi · mất gói tin · chế độ · đồng bộ lịch sử. */
export function plcScadaRows(input: PlcRowInput, live: LiveMap, now: number): PlcRow[] {
  const on = !!live;
  const t = input.tags;
  const state = (id: string, label: string, tag: string, map: Record<string, StateView>, alarm: string): PlcRow => {
    const r = readStateTag(live?.[tag], on, now);
    const v = stateView(r, map);
    return { id, label, value: v.value, valueOk: r.state === 'ok', unit: '-', alarm, status: v.status, tone: v.tone, updated: clock(r.ts) };
  };
  const number = (id: string, label: string, tag: string, unit: string, warn: number, alarm: string): PlcRow => {
    const tv = live?.[tag];
    const r = readParam({ limits: { warn }, okLabel: 'Tốt', okTone: 'success' }, tv, on, now);
    return {
      id,
      label,
      value: r.state === 'ok' ? r.value!.toFixed(1) : r.state === 'lost' ? SIGNAL_LOST_LABEL : '—',
      valueOk: r.state === 'ok',
      unit,
      alarm,
      status: r.label,
      tone: r.tone,
      updated: r.state === 'pending' ? undefined : clock(tv?.ts),
    };
  };
  const a = input.availability;
  const min = input.limits.minAvailableTags;
  const nowClock = on ? plantTimeOfDay(new Date(now)) : undefined;
  return [
    state('heartbeat', 'PLC Heartbeat', t.heartbeat, HEARTBEAT_VIEW, 'Không nhận heartbeat'),
    state('plc-link', 'Kết nối PLC', t.plcLink, LINK_VIEW, 'Mất kết nối PLC'),
    state('scada-link', 'Kết nối SCADA', t.scadaLink, LINK_VIEW, 'Mất kết nối SCADA'),
    number('latency', 'Độ trễ dữ liệu', t.latency, 's', input.limits.latency.warn, `> ${input.limits.latency.warn.toFixed(1)} giây`),
    {
      id: 'tags',
      label: 'Tag khả dụng',
      value: a ? `${a.ok}/${a.total}` : '—',
      valueOk: !!a,
      unit: 'tag',
      alarm: a ? `< ${min}/${a.total} tag` : `< ${min} tag`,
      status: !a ? '—' : a.ok >= min ? 'Tốt' : 'Thấp',
      tone: !a ? 'neutral' : a.ok >= min ? 'success' : 'warning',
      updated: nowClock,
    },
    {
      id: 'faults',
      label: 'Tag lỗi',
      value: a ? String(a.lost) : '—',
      valueOk: !!a,
      unit: 'tag',
      alarm: '> 0 tag',
      status: !a ? '—' : a.lost === 0 ? 'Bình thường' : 'Cảnh báo',
      tone: !a ? 'neutral' : a.lost === 0 ? 'success' : 'warning',
      updated: nowClock,
    },
    number('packet-loss', 'Mất gói tin', t.packetLoss, '%', input.limits.packetLoss.warn, `> ${input.limits.packetLoss.warn.toFixed(1)}%`),
    state('mode', 'Chế độ vận hành', t.mode, MODE_VIEW, 'Chuyển sang Local'),
    state('historian', 'Đồng bộ lịch sử', t.historian, HISTORIAN_VIEW, 'Đồng bộ thất bại'),
  ];
}

// ============================================================================
// Khác
// ============================================================================

/** "45 ngày 12 giờ" · "3 giờ 20 phút" · "15 phút". */
export function uptimeText(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return `${d} ngày ${h} giờ`;
  if (h > 0) return `${h} giờ ${min} phút`;
  return `${min} phút`;
}
