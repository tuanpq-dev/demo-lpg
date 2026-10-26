/*
 * Trang chi tiết yêu cầu bảo trì `/maintenance/:id` – định dạng + suy dẫn thuần (`now` truyền vào) và hook thiết bị liên quan.
 * Quy trình (chuyển bước, hủy, checklist, hạn) ở `src/features/maintenance/*`; mutation qua `useMaintenance()`.
 */
import type { TimelineEvent, TimelineTone } from '@/components';
import { daysFromToday, plantDayKey } from '@/lib/plantTime';
import type { WorkState } from '@/features/maintenance/progress';
import type { MaintenanceAttachment, MaintenanceHistoryKind, MaintenanceRecord } from '@/mocks/maintenance';
import { resolveAssetId, useAssetDetail, type Reading } from './assetDetail';
import { levelPercentToVolumePercent } from '@/features/tank/volume';

/** Mã yêu cầu từ URL, không phân biệt hoa thường ("mt-00128" → "MT-00128"); không có → null. */
export function resolveMaintenanceId(raw: string | undefined, rows: readonly Pick<MaintenanceRecord, 'id'>[]): string | null {
  const key = (raw ?? '').trim().toUpperCase();
  if (!key) return null;
  return rows.find((r) => r.id.toUpperCase() === key)?.id ?? null;
}

/** "2026-10-26T08:30" → "26/10/2026 08:30"; chỉ ngày → "26/10/2026". */
export function formatPlantDateTime(s: string): string {
  const [y, m, d] = s.slice(0, 10).split('-');
  const t = s.slice(11, 16);
  return `${d}/${m}/${y}${t ? ` ${t}` : ''}`;
}

/** "Hôm nay 10:50" · "Hôm qua 09:00" · "24/10 09:00" (năm khác: "24/10/2025 09:00") – ngày theo giờ nhà máy. */
export function relativeDayTime(at: string, now: Date): string {
  const d = daysFromToday(at, now);
  const time = at.slice(11, 16);
  if (d === 0) return `Hôm nay ${time}`;
  if (d === -1) return `Hôm qua ${time}`;
  const [y, m, day] = at.slice(0, 10).split('-');
  const sameYear = y === plantDayKey(now).slice(0, 4);
  return `${day}/${m}${sameYear ? '' : `/${y}`} ${time}`;
}

const HISTORY_TONE: Record<MaintenanceHistoryKind, TimelineTone> = {
  create: 'success',
  notify: 'neutral',
  priority: 'danger',
  assign: 'info',
  accept: 'info',
  start: 'info',
  progress: 'info',
  pause: 'warning',
  block: 'danger',
  resume: 'success',
  review: 'warning',
  rework: 'warning',
  done: 'success',
  cancel: 'danger',
};

/** Lịch sử xử lý → mục timeline: giờ "08:30" (hôm nay) hoặc "Hôm qua 08:30"/"24/10 08:30"; màu chấm theo loại. */
export function historyEvents(r: Pick<MaintenanceRecord, 'history'>, now: Date): TimelineEvent[] {
  return (r.history ?? []).map((h) => ({
    id: h.id,
    title: h.text,
    time: daysFromToday(h.at, now) === 0 ? h.at.slice(11, 16) : relativeDayTime(h.at, now),
    tone: HISTORY_TONE[h.kind],
  }));
}

/**
 * Tệp mẫu để "Tải xuống" khi chưa có backend: `<tên không đuôi>-mau.txt`, nội dung ghi rõ là dữ liệu mẫu.
 * TODO(backend): tải tệp thật qua API (URL ký sẵn), upload ở form tạo/trang chi tiết.
 */
export function mockAttachmentFile(a: Pick<MaintenanceAttachment, 'name' | 'size'>, code: string) {
  const base = a.name.replace(/\.[^.]+$/, '') || 'tep';
  return {
    fileName: `${base}-mau.txt`,
    content: [
      'DỮ LIỆU MẪU – chưa có tệp thật (demo, chưa nối backend).',
      `Yêu cầu: ${code}`,
      `Tệp gốc: ${a.name}`,
      `Kích thước khai báo: ${formatFileSize(a.size)}`,
    ].join('\n'),
  };
}

/** 2_480_000 → "2,4 MB"; 860_000 → "840 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// ---- Nháp modal "Cập nhật tiến độ" (sessionStorage theo mã yêu cầu; không đổi trạng thái bản ghi) ----

/** Nháp chỉ giữ lựa chọn + tiến độ + nội dung; KHÔNG giữ tệp (object URL chết khi đóng modal). */
export type ProgressDraft = { state: WorkState; progress: number; text: string; /** ISO */ savedAt: string };

const progressDraftKey = (id: string) => `demo-lpg:mt-progress-draft:${id}`;
const WORK_STATES: readonly WorkState[] = ['working', 'paused', 'blocked', 'completed'];

export function saveProgressDraft(id: string, draft: ProgressDraft): boolean {
  try {
    sessionStorage.setItem(progressDraftKey(id), JSON.stringify(draft));
    return true;
  } catch {
    return false; // bộ nhớ không khả dụng (chế độ riêng tư, đầy) – modal báo không lưu được
  }
}

/** Nháp đã lưu; hỏng / sai dạng / không đọc được → null. */
export function loadProgressDraft(id: string): ProgressDraft | null {
  try {
    const raw = sessionStorage.getItem(progressDraftKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ProgressDraft>;
    if (!WORK_STATES.includes(d.state as WorkState) || typeof d.progress !== 'number' || typeof d.text !== 'string') return null;
    return { state: d.state as WorkState, progress: d.progress, text: d.text, savedAt: typeof d.savedAt === 'string' ? d.savedAt : '' };
  } catch {
    return null;
  }
}

export function clearProgressDraft(id: string) {
  try {
    sessionStorage.removeItem(progressDraftKey(id));
  } catch {
    /* ignore */
  }
}

// ---- Quay lại danh sách đúng bộ lọc cũ ----

const LIST_SEARCH_KEY = 'demo-lpg:maintenance-list-search';

/** Tham số chỉ dùng một lần (mở drawer cũ / modal tạo) – không lưu vào URL "quay lại". */
const TRANSIENT_PARAMS = ['open', 'create', 'device', 'from', 'progress'];

/** Query danh sách bỏ tham số một lần: `?tab=overdue&open=MT-1` → `?tab=overdue`; không còn gì → "". */
export function listSearchOnly(search: string): string {
  const p = new URLSearchParams(search);
  TRANSIENT_PARAMS.forEach((k) => p.delete(k));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Lưu query của danh sách (`?tab=&q=…`) – trang danh sách gọi mỗi khi query đổi. */
export function rememberListSearch(search: string) {
  try {
    sessionStorage.setItem(LIST_SEARCH_KEY, listSearchOnly(search));
  } catch {
    /* bộ nhớ không khả dụng – nút quay lại về danh sách mặc định */
  }
}

/** URL danh sách để quay lại: ưu tiên `state.from` của điều hướng, rồi query đã lưu trong phiên, cuối cùng `/maintenance`. */
export function maintenanceListUrl(stateFrom?: unknown): string {
  if (typeof stateFrom === 'string' && stateFrom.startsWith('/maintenance') && !stateFrom.startsWith('/maintenance/')) return stateFrom;
  try {
    const s = sessionStorage.getItem(LIST_SEARCH_KEY);
    if (s) return `/maintenance${s.startsWith('?') ? s : `?${s}`}`;
  } catch {
    /* ignore */
  }
  return '/maintenance';
}

// ---- Thiết bị liên quan (số liệu trực tiếp) ----

export type RelatedDeviceView =
  | { kind: 'none' }
  | { kind: 'loading' }
  | {
      kind: 'live';
      id: string;
      name: string;
      pressure: Reading;
      temperature: Reading;
      /** % thể tích toàn bộ chất lỏng (cùng cách tính KPI "Mức bồn"), undefined khi mất tín hiệu / chưa có số. */
      levelPct?: number;
      level: Reading;
      /** Tag xấu nhất: danger > warning > offline > normal. */
      status: 'danger' | 'warning' | 'offline' | 'normal';
    };

const RANK = { normal: 0, offline: 1, warning: 2, danger: 3 } as const;

/** Trạng thái xấu nhất của các số liệu (dùng cho chấm cạnh tên thiết bị). */
export function worstReading(readings: readonly Reading[]): 'danger' | 'warning' | 'offline' | 'normal' {
  return readings.reduce<'danger' | 'warning' | 'offline' | 'normal'>((w, r) => (RANK[r.status] > RANK[w] ? r.status : w), 'normal');
}

/**
 * Số liệu trực tiếp của thiết bị liên quan – chỉ thiết bị có trang chi tiết tài sản (hiện V-101); thiết bị khác → `none`.
 * Đọc qua `useAssetDetail` (useLiveData → "Mất tín hiệu" khi stale), không có số riêng cho trang bảo trì.
 */
export function useRelatedDevice(device: string): RelatedDeviceView {
  const id = resolveAssetId(device);
  const asset = useAssetDetail(id ?? device);
  if (!id) return { kind: 'none' };
  if (asset.status !== 'success' || !asset.live) return asset.status === 'error' ? { kind: 'none' } : { kind: 'loading' };
  const { pressure, temperature, level } = asset.live;
  return {
    kind: 'live',
    id,
    name: asset.data.name,
    pressure,
    temperature,
    level,
    levelPct: level.state === 'ok' ? levelPercentToVolumePercent(level.value!) : undefined,
    status: worstReading([pressure, temperature, level]),
  };
}
