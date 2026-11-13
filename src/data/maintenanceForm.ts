/** Form tạo yêu cầu bảo trì: danh mục thiết bị, phòng ban/ca, gợi ý AI, mẫu checklist, nháp. Tách từ maintenance.ts. */
import type { SelectOption } from '@/components';
import { parsePlantDateTime } from '@/lib/plantTime';
import type { AlertRecord } from '@/features/alerts/types';
import { CHECKLIST_TEMPLATES } from '@/mocks/maintenance';
import { type DEPARTMENTS, SHIFTS } from '@/features/staff/org';
import type { MaintenanceRecord, MaintenanceType, ShiftId } from '@/features/maintenance/types';

/** Loại bảo trì trong form – nhãn đầy đủ (bảng dùng nhãn ngắn TYPE_OPTIONS). */
export const FORM_TYPE_OPTIONS: SelectOption<MaintenanceType>[] = [
  { value: 'incident', label: 'Bảo trì khắc phục' },
  { value: 'periodic', label: 'Bảo trì định kỳ' },
  { value: 'inspection', label: 'Kiểm tra / Hiệu chuẩn' },
];

/** Mức độ ưu tiên trong form: 3 nút. "Thường" = medium; "Thấp" chỉ có trong dữ liệu cũ. */
export const FORM_PRIORITY_OPTIONS = [
  { id: 'critical', label: 'Nghiêm trọng', tone: 'danger' as const },
  { id: 'high', label: 'Cao', tone: 'warning' as const },
  { id: 'medium', label: 'Thường', tone: 'neutral' as const },
];

export type DeviceDirectoryEntry = { device: string; area: string };

/**
 * Danh bạ thiết bị → khu vực (ô "Thiết bị" + "Khu vực" của form tạo yêu cầu), gộp từ cảnh báo + bảo trì; trùng thiết bị
 * thì khu vực của bảo trì thắng; sắp theo mã. Thuần – trang tính bằng `useMemo` rồi truyền vào modal.
 */
export function deriveDeviceDirectory(maint: readonly MaintenanceRecord[], alerts: readonly AlertRecord[] = []): DeviceDirectoryEntry[] {
  const directory = new Map<string, string>();
  for (const a of alerts) directory.set(a.device, a.area);
  for (const r of maint) directory.set(r.device, r.area);
  return [...directory.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([device, area]) => ({ device, area }));
}

/** Phòng ban gợi ý theo tiền tố mã thiết bị. */
export function departmentFor(device: string): (typeof DEPARTMENTS)[number] {
  if (/^(GS|PT|TT|FT|LT|PI|PCV)-/i.test(device)) return 'Đo lường – Tự động hóa';
  if (/^(G|C)-/i.test(device)) return 'Bảo trì Điện';
  if (/^FS-/i.test(device)) return 'An toàn – HSE';
  return 'Bảo trì Cơ khí';
}

/** Ca vận hành chứa thời điểm "yyyy-mm-ddTHH:mm". */
export function shiftFor(dateTime: string): ShiftId {
  const h = Number(dateTime.slice(11, 13));
  return SHIFTS.find((s) => (s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to))?.value ?? 'shift-1';
}

/** Số giờ giữa hai mốc "yyyy-mm-ddTHH:mm" giờ nhà máy (làm tròn 0.5); thiếu / sai định dạng → null. */
export function durationHours(start?: string, end?: string) {
  const a = start ? parsePlantDateTime(start) : null;
  const b = end ? parsePlantDateTime(end) : null;
  return a && b ? Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 2) / 2 : null;
}

export type AiSuggestion = { assessment: string; checks: string[] };

/**
 * "GÓP Ý TỪ AI" – ⚠ MOCK theo quy tắc (chưa nối AI thật).
 * Khi có API: thay thân hàm bằng gọi dịch vụ AI với ngữ cảnh {device, alert, lịch sử vận hành}.
 */
export function suggestForRequest({ device, alert }: { device: string | null; alert?: AlertRecord }): AiSuggestion | null {
  if (!device && !alert) return null;
  const d = device ?? alert?.device ?? '';
  if (alert && /áp suất/i.test(alert.message)) {
    return {
      assessment: `Áp suất ${alert.device.startsWith('V-') ? 'bồn ' : ''}${alert.device} tăng bất thường trong 2 giờ gần nhất và có khả năng liên quan đến van an toàn PSV-${alert.device.replace(/\D/g, '') || '101'} hoặc hệ thống làm mát.`,
      checks: [
        `Kiểm tra trạng thái van PSV-${alert.device.replace(/\D/g, '') || '101'}`,
        'Đối chiếu áp suất tại hiện trường',
        'Kiểm tra hệ thống làm mát và tín hiệu cảm biến liên quan',
      ],
    };
  }
  if (/^GS-/i.test(d) || (alert && /gas|LEL/i.test(alert.message + alert.unit))) {
    return {
      assessment: `Nồng độ gas tại ${d} vượt ngưỡng cảnh báo; cần loại trừ rò rỉ thật trước khi hiệu chuẩn cảm biến.`,
      checks: ['Đo nồng độ bằng máy cầm tay', 'Kiểm tra mặt bích & khớp nối lân cận', 'Hiệu chuẩn cảm biến bằng khí chuẩn'],
    };
  }
  if (/^E-/i.test(d) || (alert && /hóa hơi/i.test(alert.message))) {
    return {
      assessment: `Nhiệt độ đầu ra máy hóa hơi ${d} thấp hơn định mức; có thể do bám cặn bộ trao đổi nhiệt hoặc van điều nhiệt.`,
      checks: ['Kiểm tra van điều nhiệt', 'Đo nhiệt độ nước nóng đầu vào', 'Kiểm tra bám cặn bộ trao đổi nhiệt'],
    };
  }
  return {
    assessment: `Chưa ghi nhận bất thường lớn ở ${d} trong 24 giờ qua; đề xuất kiểm tra tổng quát theo checklist định kỳ.`,
    checks: ['Kiểm tra ngoại quan & rò rỉ', 'Đối chiếu thông số vận hành', 'Kiểm tra tín hiệu cảm biến liên quan'],
  };
}

/** Checklist mẫu phù hợp nhất với thiết bị/cảnh báo. */
export function templateFor(device: string | null, alert?: AlertRecord) {
  if (alert && /áp suất/i.test(alert.message)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'pressure');
  if (device && /^GS-/i.test(device)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'gas');
  if (device && /^E-/i.test(device)) return CHECKLIST_TEMPLATES.find((t) => t.id === 'vaporizer');
  return undefined;
}

// ---- Lưu nháp (localStorage, theo trình duyệt) ----
const DRAFT_KEY = 'demo-lpg:maintenance-draft';
export function saveMaintenanceDraft(draft: unknown) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), draft }));
  } catch {
    /* bộ nhớ không khả dụng – bỏ qua */
  }
}
export function loadMaintenanceDraft<T>(): { savedAt: string; draft: T } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearMaintenanceDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
