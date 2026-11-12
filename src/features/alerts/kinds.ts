/**
 * Kiểu cấu hình theo LOẠI cảnh báo (`AlertKindConfig`…) + danh sách id loại. Dữ liệu cấu hình (`ALERT_KINDS`) vẫn ở
 * `src/mocks/alertKinds.ts` (TODO backend: GET /alert-kinds).
 */
import type { StaffSkill } from '@/features/staff/skills';

export type AlertKind =
  | 'tank-overpressure'
  | 'gas-leak'
  | 'fire'
  | 'temperature-low'
  | 'temperature-high'
  | 'filter-dp-high'
  | 'flow-low'
  | 'level-low'
  | 'level-drop'
  | 'sensor-signal-lost'
  | 'vibration-high'
  | 'safety-valve-open'
  | 'pressure-high'
  | 'battery-low'
  | 'pump-standby'
  | 'generic';

/** Mức theo nồng độ/giá trị (thứ tự tăng dần). */
export type AlertLevel = 'normal' | 'level-1' | 'level-2' | 'esd';
export type BandTone = 'success' | 'warning-dim' | 'warning' | 'danger';
/** Một đoạn mức: [from, to) – `to` thiếu = tới hết thang. */
export type AlertBand = { level: AlertLevel; from: number; to?: number; label: string; tone: BandTone };

/**
 * Nguồn số của một dòng "Thông số trước và sau xử lý" – lớp dữ liệu tra tag + ngưỡng theo thiết bị (`updateReadingRows`):
 * primary = tag của cảnh báo (dòng quyết định điều kiện "Đã xử lý") · regulatorOut = áp suất sau bộ điều áp · temperature =
 * nhiệt độ bồn · areaSensors = các cảm biến gas CÙNG KHU (mỗi cảm biến một dòng, trừ tag chính) · smoke / gas = tín hiệu liên
 * quan của khu báo cháy (`AREA_FIRE_SIGNALS`).
 */
export type UpdateReadingField = 'primary' | 'regulatorOut' | 'temperature' | 'areaSensors' | 'smoke' | 'gas';

/** Trạng thái chọn trong modal cập nhật (ô). `false-alarm` chỉ báo cháy. */
export type UpdateStateId = 'inspecting' | 'resolving' | 'paused' | 'needs-support' | 'resolved' | 'false-alarm';

/**
 * "Cập nhật xử lý" theo LOẠI – khung chung `AlertUpdateModal` (dựng theo ảnh modal áp suất; gas/cháy chưa có
 * thiết kế riêng – docs/figma-diffs.md). Chữ được thay `{device}`, `{tag}`, `{regulator}`, `{safetyValve}`, `{smoke}`, `{gas}`.
 */
export type AlertUpdateConfig = {
  kind: 'alert-update';
  /** Tiêu đề modal. */
  title: string;
  /** Đại lượng chính trong lịch sử ("áp suất", "nồng độ", "nhiệt độ"). */
  quantity: string;
  /** Các ô trạng thái (thứ tự hiển thị) + nhãn riêng (thiếu → nhãn mặc định). */
  states: readonly UpdateStateId[];
  stateLabels?: Partial<Record<UpdateStateId, string>>;
  /**
   * Điều kiện chọn "Đã xử lý" (giữ nguyên như modal cũ của từng loại): pressure = live < ngưỡng VÀ sau xử lý < ngưỡng (mất tín
   * hiệu → đồng hồ cơ) · gas = live < đầu mức `closeBelow` (mất tín hiệu → số đo lại < mức đó) · fire = đầu báo đã phục hồi
   * (mất tín hiệu → mục xác minh `role: 'field'`).
   */
  close: { rule: 'pressure' } | { rule: 'gas'; closeBelow: AlertLevel } | { rule: 'fire' };
  /** Dòng thông số; dòng `primary` là dòng quyết định điều kiện. */
  readings: readonly { id: string; label: string; field: UpdateReadingField }[];
  /** Nguồn xác minh (nhãn) – thiếu = chỉ số cảm biến, không nhập tay (báo cháy). */
  sources?: Readonly<Record<'sensor' | 'gauge' | 'both', string>>;
  /**
   * "Kết quả xác minh" (chọn nhiều). role normal = chỉ tick khi đủ điều kiện "Đã xử lý" (`required` → bắt buộc khi Đã xử lý) ·
   * over = mâu thuẫn với normal · field = đã kiểm tra tại chỗ (căn cứ đóng khi đầu báo mất tín hiệu) · real-fire = mâu thuẫn
   * với "Báo động giả".
   */
  verification: readonly { id: string; text: string; role?: 'normal' | 'over' | 'field' | 'real-fire'; required?: boolean }[];
  /** Câu điều kiện của mục role normal: "Chỉ chọn "…" khi {normalHint}." */
  normalHint?: string;
  /** "Vấn đề phát sinh" (chọn một). `none` = mặc định. */
  issues: readonly { id: string; label: string; needsNote?: boolean; suggestSupport?: boolean }[];
  /** Theo dõi sau xử lý: số phút (0 = không), mặc định, mục tiêu (< target, đơn vị cảnh báo; thiếu = không có mục tiêu số). */
  followUp: FollowUpConfig;
};

export type FollowUpConfig = { options: readonly number[]; defaultMinutes: number; target?: number };

export type AlertKindConfig = {
  label: string;
  /**
   * Panel "Thông số": threshold = một ngưỡng (áp suất…) · gas = nhiều mức + cảm biến trong khu · fire = báo cháy (đầu báo,
   * tín hiệu liên quan, thiết bị trong khu, xác nhận chéo). Sau: 'vaporizer'.
   */
  panel: 'threshold' | 'gas' | 'fire';
  /** Số lớn: record = giá trị LÚC cảnh báo (bản ghi) · live = số trực tiếp của tag (dòng nhỏ "Lúc cảnh báo"). */
  value: 'record' | 'live';
  /** Thang đo (gas: 0–100 % LEL). Thiếu → tính từ ngưỡng (panel threshold). */
  scale?: { min: number; max: number };
  /** Mức theo giá trị (gas). Badge mức, màu thang, banner, điều kiện đóng đều tính từ đây. */
  bands?: readonly AlertBand[];
  /** Banner khẩn cấp: hiện khi mức ≥ `fromLevel`; ≥ `esdLevel` đổi sang câu `afterEsd`. `{esd}` = giá trị bắt đầu mức ESD. */
  banner?: { fromLevel: AlertLevel; esdLevel: AlertLevel; title: string; beforeEsd: string; afterEsd: string };
  /** Nút phụ ở chân drawer (thứ tự hiển thị). `procedure` = "Xem quy trình khẩn cấp" (cần `emergency`). */
  actions: readonly ('assign' | 'support' | 'maintenance' | 'procedure')[];
  /**
   * Nút chính khi Đang xử lý: resolve-note = "Đánh dấu đã xử lý" (cần ghi chú) · alert-update = "Cập nhật xử lý" (modal chung
   * `AlertUpdateModal`: trạng thái, hạng mục kiểm tra, thông số trước/sau, xác minh, theo dõi – docs/guide/alerts.md (4o)).
   * Cả hai chỉ đưa cảnh báo tới Đã xử lý (resolved); Hoàn thành qua modal "Xác nhận đóng cảnh báo".
   */
  update: { kind: 'resolve-note' } | AlertUpdateConfig;
  /** Người phụ trách MẶC ĐỊNH (nhóm) khi chưa phân công cá nhân – chỉ hiển thị ("Trực ca"), KHÔNG ghi vào `assignee`. */
  defaultOwner?: string;
  /** Sau khi đóng là "Báo động giả": nút "Tạo yêu cầu bảo trì" với tên điền sẵn (`{device}`) – kiểm tra đầu báo. */
  falseAlarmMaintenance?: { title: string };
  /** Banner xác nhận chéo (panel fire). */
  crossConfirmTitle?: string;
  /**
   * "Xem quy trình khẩn cấp": các bước ứng phó + danh bạ. `draft` = nhãn hiển thị trong modal khi nội dung chưa được duyệt.
   * `phone` thiếu → "Chờ khách cung cấp" (KHÔNG đặt số giả trông như thật).
   */
  emergency?: {
    title: string;
    draft?: string;
    steps: readonly string[];
    contacts: readonly { id: string; name: string; role: string; phone?: string }[];
  };
  /** Mục thu gọn mặc định (ảnh không có): Tiến trình, Ghi chú, Nhật ký. */
  collapsed?: readonly ('progress' | 'notes' | 'log')[];
  /**
   * Có vẽ thanh đo ngưỡng ở drawer không (mặc định true). false = cảnh báo TỐC ĐỘ THAY ĐỔI (vd mức giảm %/h – giá trị
   * và ngưỡng có thể âm, thang 0 → ngưỡng vô nghĩa): drawer chỉ hiện hai ô số.
   */
  gauge?: boolean;
  /**
   * false = giá trị của bản ghi không phải số đo có nghĩa (mất tín hiệu, chuyển trạng thái bơm…) → modal phân công ẩn ô
   * "Lúc cảnh báo". Mặc định có.
   */
  numericValue?: false;
  /** Chuyên môn phù hợp – modal phân công đưa người có chuyên môn này (hoặc cùng khu) lên đầu danh sách. */
  skills?: readonly StaffSkill[];
  causes: readonly string[];
  steps: readonly { id: string; text: string }[];
};
