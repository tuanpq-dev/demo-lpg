/**
 * Cấu hình theo LOẠI cảnh báo – MỘT chỗ quyết định drawer chi tiết cảnh báo hiển thị gì:
 * panel thông số (`threshold` một ngưỡng · `gas` nhiều mức), số lớn lấy từ bản ghi hay live, thang + bands mức,
 * banner khẩn cấp, nguyên nhân, hướng dẫn xử lý, nút phụ ở chân drawer, kiểu "cập nhật/đóng", mục thu gọn.
 * Không viết cứng trong UI: drawer đọc `ALERT_KINDS[alert.kind]` (thiếu → `generic`). Thêm loại mới: docs/guide/alerts.md (4m).
 * Chữ có thể chứa `{device}` (mã thiết bị), `{safetyValve}` (van an toàn của bồn, `SAFETY_VALVES`) và `{nearbySensor}`
 * (cảm biến kề trong cùng khu – `nearbySensor` ở mocks/sensors.ts).
 * `id` của bước là khoá lưu tiến độ tick theo cảnh báo – đổi chữ không làm mất tick, đổi id thì có.
 * TODO(backend): danh mục do kỹ sư quản lý (GET /alert-kinds).
 */
import type { StaffSkill } from './skills';

export const ALERT_KIND_IDS = [
  'tank-overpressure',
  'gas-leak',
  'fire',
  'temperature-low',
  'temperature-high',
  'filter-dp-high',
  'flow-low',
  'level-low',
  'level-drop',
  'sensor-signal-lost',
  'vibration-high',
  'safety-valve-open',
  'pressure-high',
  'battery-low',
  'pump-standby',
  'generic',
] as const;
export type AlertKind = (typeof ALERT_KIND_IDS)[number];

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
 * "Cập nhật xử lý" theo LOẠI – khung chung `AlertUpdateModal` (dựng theo ảnh modal áp suất 28/10/2026; gas/cháy chưa có
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
  emergency?: { title: string; draft?: string; steps: readonly string[]; contacts: readonly { id: string; name: string; role: string; phone?: string }[] };
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

/** Van an toàn theo bồn (ảnh ghi "van PR-101" – dữ liệu dùng PSV-101, docs/figma-diffs.md). */
export const SAFETY_VALVES: Readonly<Record<string, string>> = { 'V-101': 'PSV-101', 'V-102': 'PSV-102' };
/** Bộ điều áp sau bồn (ảnh modal cập nhật xử lý áp suất: "PR-101"). PR-102 giả định. */
export const REGULATORS: Readonly<Record<string, string>> = { 'V-101': 'PR-101', 'V-102': 'PR-102' };

const ISSUES: AlertUpdateConfig['issues'] = [
  { id: 'none', label: 'Không có vấn đề phát sinh' },
  { id: 'need-staff', label: 'Cần thêm nhân sự hỗ trợ', suggestSupport: true },
  { id: 'no-access', label: 'Không thể tiếp cận thiết bị' },
  { id: 'missing-data', label: 'Thiếu dữ liệu xác minh' },
  { id: 'other', label: 'Khác', needsNote: true },
];
const FOLLOW_OPTIONS = [0, 15, 30, 60, 120] as const;
const BASE_STATES: readonly UpdateStateId[] = ['inspecting', 'resolving', 'paused', 'needs-support', 'resolved'];

/** Theo dõi khi loại không có cấu hình cập nhật (resolve-note): mặc định không theo dõi. */
export const DEFAULT_FOLLOW_UP: FollowUpConfig = { options: FOLLOW_OPTIONS, defaultMinutes: 0 };

/** Cấu hình "Cập nhật xử lý" áp suất bồn (ảnh `scratch/figma-ref/alert-pressure-update-modal-design.png`). */
const PRESSURE_UPDATE: AlertUpdateConfig = {
  kind: 'alert-update',
  title: 'Cập nhật xử lý cảnh báo áp suất',
  quantity: 'áp suất',
  states: BASE_STATES,
  close: { rule: 'pressure' },
  readings: [
    { id: 'pressure', label: 'Áp suất {device}', field: 'primary' },
    { id: 'regulator-out', label: 'Áp suất sau {regulator}', field: 'regulatorOut' },
    { id: 'temperature', label: 'Nhiệt độ bồn', field: 'temperature' },
  ],
  sources: { sensor: 'Cảm biến (SCADA)', gauge: 'Đồng hồ cơ', both: 'Cả hai' },
  verification: [
    { id: 'over-confirmed', text: 'Xác nhận áp suất thực tế vượt ngưỡng', role: 'over' },
    { id: 'sensor-drift', text: 'Cảm biến {tag} có sai lệch' },
    { id: 'regulator-fault', text: 'Bộ điều áp {regulator} có bất thường' },
    { id: 'valve-check', text: 'Van {safetyValve} cần kiểm tra' },
    { id: 'back-to-normal', text: 'Hệ thống đã trở về bình thường', role: 'normal', required: true },
  ],
  normalHint: 'áp suất hiện tại và sau xử lý đều dưới ngưỡng cảnh báo',
  // Ảnh có 2 ô "Không có vấn đề phát sinh" trùng nhau → giữ một (docs/figma-diffs.md).
  issues: ISSUES,
  followUp: { options: FOLLOW_OPTIONS, defaultMinutes: 30, target: 10 },
};

/** Gas (chưa có thiết kế – dựng theo khung áp suất): nồng độ tag chính + cảm biến cùng khu; mục tiêu theo dõi < 10 % LEL. */
const GAS_UPDATE: AlertUpdateConfig = {
  kind: 'alert-update',
  title: 'Cập nhật xử lý cảnh báo rò rỉ khí',
  quantity: 'nồng độ',
  states: BASE_STATES,
  close: { rule: 'gas', closeBelow: 'level-1' },
  readings: [
    { id: 'concentration', label: 'Nồng độ {device}', field: 'primary' },
    { id: 'area', label: 'Nồng độ {sensor}', field: 'areaSensors' },
  ],
  sources: { sensor: 'Cảm biến (SCADA)', gauge: 'Máy đo cầm tay', both: 'Cả hai' },
  verification: [
    { id: 'leak-found', text: 'Đã xác định nguồn rò rỉ' },
    { id: 'leak-isolated', text: 'Đã cách ly nguồn rò rỉ' },
    { id: 'ventilated', text: 'Khu vực đã thông gió' },
    { id: 'area-normal', text: 'Cảm biến cùng khu bình thường' },
  ],
  issues: ISSUES,
  followUp: { options: FOLLOW_OPTIONS, defaultMinutes: 30, target: 10 },
};

/** Báo cháy: "Đã xử lý" tách thành "Đã xử lý sự cố" / "Báo động giả" (cả hai → Đã xử lý + `resolution`); theo dõi không có mục tiêu số. */
const FIRE_UPDATE: AlertUpdateConfig = {
  kind: 'alert-update',
  title: 'Cập nhật xử lý cảnh báo báo cháy',
  quantity: 'nhiệt độ',
  states: ['inspecting', 'resolving', 'paused', 'needs-support', 'resolved', 'false-alarm'],
  stateLabels: { resolved: 'Đã xử lý sự cố', 'false-alarm': 'Báo động giả' },
  close: { rule: 'fire' },
  readings: [
    { id: 'heat', label: 'Nhiệt độ {device}', field: 'primary' },
    { id: 'smoke', label: 'Đầu báo khói {smoke}', field: 'smoke' },
    { id: 'gas', label: 'Khí gas {gas}', field: 'gas' },
  ],
  verification: [
    { id: 'field-verified', text: 'Đã xác minh qua camera/tại chỗ', role: 'field' },
    { id: 'real-fire', text: 'Có cháy thật', role: 'real-fire' },
    { id: 'detector-restored', text: 'Đầu báo đã phục hồi', role: 'normal' },
    { id: 'fire-team-notified', text: 'Đã thông báo PCCC' },
  ],
  normalHint: 'đầu báo đã phục hồi (hoặc mất tín hiệu và đã kiểm tra tại chỗ)',
  issues: ISSUES,
  followUp: { options: FOLLOW_OPTIONS, defaultMinutes: 30 },
};

/** Bands mặc định của khí gas theo ảnh (27/10/2026): 0–10 bình thường · 10–20 cấp 1 · 20–40 cấp 2 · ≥ 40 ESD – CHỜ chốt với
 * khách (dữ liệu cũ ghi ngưỡng 20 % LEL; docs/questions.md). */
export const GAS_BANDS: readonly AlertBand[] = [
  { level: 'normal', from: 0, to: 10, label: 'Bình thường', tone: 'success' },
  { level: 'level-1', from: 10, to: 20, label: 'Cảnh báo cấp 1', tone: 'warning-dim' },
  { level: 'level-2', from: 20, to: 40, label: 'Cảnh báo cấp 2', tone: 'warning' },
  { level: 'esd', from: 40, label: 'ESD', tone: 'danger' },
];

/** Mặc định của panel một ngưỡng (hành vi drawer áp suất trước khi tách cấu hình). */
const THRESHOLD = { panel: 'threshold', value: 'record', actions: ['assign', 'maintenance'], update: { kind: 'resolve-note' } } as const;

type PlaybookPart = {
  label: string;
  gauge?: boolean;
  numericValue?: false;
  skills?: readonly StaffSkill[];
  causes: readonly string[];
  steps: readonly { id: string; text: string }[];
  /** Ghi đè nút cập nhật (mặc định resolve-note = "Đánh dấu đã xử lý" → Đã xử lý, đóng qua modal "Xác nhận đóng cảnh báo"). */
  update?: AlertKindConfig['update'];
};

const PLAYBOOKS: Readonly<Record<Exclude<AlertKind, 'gas-leak' | 'fire'>, PlaybookPart>> = {
  // Ảnh drawer ALT-00128 (3 nguyên nhân + 3 bước giữ nguyên chữ; "van PR-101" → van an toàn của bồn).
  // Hướng dẫn xử lý (drawer) = Kết quả kiểm tra thiết bị (modal) – MỘT danh sách (28/10/2026): 6 hạng mục theo ảnh modal;
  // giữ id cũ field-gauge / verify-valve / cooling-ready để tick cũ không mất. Ảnh "Kiểm tra bộ điều áp PR-" bị cắt → PR-101.
  'tank-overpressure': {
    label: 'Áp suất bồn vượt ngưỡng',
    skills: ['pressure', 'mechanical'],
    causes: ['Van an toàn kẹt', 'Nhiệt độ tăng cao', 'Hệ thống làm mát không kích hoạt'],
    steps: [
      { id: 'field-gauge', text: 'Đối chiếu {tag} với đồng hồ cơ' },
      { id: 'regulator', text: 'Kiểm tra bộ điều áp {regulator}' },
      { id: 'verify-valve', text: 'Kiểm tra van an toàn {safetyValve}' },
      { id: 'tank-temp', text: 'Kiểm tra nhiệt độ bồn' },
      { id: 'cooling-ready', text: 'Kiểm tra hệ thống làm mát' },
      { id: 'pressure-trend', text: 'Theo dõi xu hướng áp suất sau xử lý' },
    ],
    update: PRESSURE_UPDATE,
  },
  'temperature-low': {
    label: 'Nhiệt độ thấp',
    skills: ['mechanical', 'instrument'],
    causes: ['Nguồn nhiệt cấp không đủ', 'Van điều nhiệt kẹt', 'Lưu lượng vượt công suất'],
    steps: [
      { id: 'heat-source', text: 'Kiểm tra nguồn nhiệt cấp cho {device}' },
      { id: 'reduce-load', text: 'Giảm tải hoặc chuyển sang thiết bị dự phòng' },
      { id: 'confirm', text: 'Theo dõi nhiệt độ 15 phút sau điều chỉnh' },
    ],
  },
  'temperature-high': {
    label: 'Nhiệt độ cao',
    skills: ['mechanical', 'instrument'],
    causes: ['Thông gió kém', 'Thiết bị lân cận quá tải', 'Cảm biến lệch chuẩn'],
    steps: [
      { id: 'ventilation', text: 'Kiểm tra thông gió / làm mát khu vực' },
      { id: 'compare', text: 'Đối chiếu nhiệt kế cầm tay với {device}' },
    ],
  },
  'filter-dp-high': {
    label: 'Chênh áp lọc cao',
    skills: ['mechanical'],
    causes: ['Lõi lọc bám bẩn', 'Lưu lượng tăng đột ngột'],
    steps: [
      { id: 'read-dp', text: 'Đọc đồng hồ chênh áp tại {device}' },
      { id: 'switch-standby', text: 'Chuyển sang bộ lọc dự phòng nếu chênh áp tiếp tục tăng' },
      { id: 'plan-clean', text: 'Lên kế hoạch vệ sinh / thay lõi lọc' },
    ],
  },
  'flow-low': {
    label: 'Lưu lượng thấp',
    skills: ['instrument'],
    causes: ['Van tuyến đóng một phần', 'Bơm giảm công suất', 'Đồng hồ lưu lượng sai số'],
    steps: [
      { id: 'valves', text: 'Kiểm tra trạng thái van trên tuyến' },
      { id: 'pump', text: 'Kiểm tra bơm cấp và áp suất đầu đẩy' },
    ],
  },
  'level-low': {
    label: 'Mức bồn thấp',
    skills: ['operations'],
    causes: ['Xuất hàng vượt kế hoạch', 'Nhập hàng chậm'],
    steps: [
      { id: 'plan', text: 'Đối chiếu kế hoạch nhập / xuất trong ca' },
      { id: 'notify', text: 'Báo điều độ điều chỉnh lịch nhập hàng' },
    ],
  },
  'level-drop': {
    label: 'Mức bồn giảm nhanh',
    skills: ['operations', 'instrument'],
    gauge: false,
    causes: ['Rò rỉ trên tuyến xuất', 'Van xả mở ngoài ý muốn', 'Cảm biến mức nhiễu'],
    steps: [
      { id: 'check-outlets', text: 'Kiểm tra các van xuất / xả của bồn' },
      { id: 'walkdown', text: 'Đi kiểm tra rò rỉ dọc tuyến' },
      { id: 'compare-level', text: 'Đối chiếu ống đo mức tại chỗ với {device}' },
    ],
  },
  'sensor-signal-lost': {
    label: 'Mất tín hiệu cảm biến',
    skills: ['instrument', 'electrical'],
    numericValue: false,
    causes: ['Đứt cáp tín hiệu', 'Mất nguồn cảm biến', 'Lỗi mô-đun I/O'],
    steps: [
      { id: 'field-read', text: 'Đọc giá trị tại chỗ thay cho {device}' },
      { id: 'wiring', text: 'Kiểm tra nguồn và cáp tín hiệu' },
    ],
  },
  'vibration-high': {
    label: 'Rung động cao',
    skills: ['mechanical'],
    causes: ['Mất cân bằng cánh bơm', 'Ổ bi mòn', 'Bu lông chân đế lỏng'],
    steps: [
      { id: 'measure', text: 'Đo rung bằng máy cầm tay tại {device}' },
      { id: 'switch', text: 'Chuyển sang bơm dự phòng nếu vượt mức' },
    ],
  },
  'safety-valve-open': {
    label: 'Van an toàn kích hoạt',
    skills: ['pressure', 'mechanical'],
    causes: ['Áp suất bồn vượt điểm đặt', 'Van an toàn rò sau khi đóng lại'],
    steps: [
      { id: 'pressure', text: 'Xác nhận áp suất bồn đã về dưới ngưỡng' },
      { id: 'reseat', text: 'Kiểm tra {device} đã đóng kín lại' },
    ],
  },
  'pressure-high': {
    label: 'Áp suất cao',
    skills: ['pressure'],
    causes: ['Van điều áp lệch điểm đặt', 'Lưu lượng đầu vào tăng'],
    steps: [
      { id: 'regulator', text: 'Kiểm tra van điều áp trước {device}' },
      { id: 'field-gauge', text: 'Đối chiếu đồng hồ áp suất cơ tại hiện trường' },
    ],
  },
  'battery-low': {
    label: 'Pin cảm biến yếu',
    skills: ['instrument'],
    causes: ['Pin hết tuổi thọ'],
    steps: [{ id: 'replace', text: 'Lên lịch thay pin {device}' }],
  },
  'pump-standby': {
    label: 'Bơm chuyển trạng thái ngoài lịch',
    skills: ['electrical', 'operations'],
    numericValue: false,
    causes: ['Bảo vệ quá tải tác động', 'Thao tác nhầm tại tủ điều khiển'],
    steps: [
      { id: 'panel', text: 'Kiểm tra tủ điều khiển {device}' },
      { id: 'log', text: 'Đối chiếu nhật ký vận hành ca' },
    ],
  },
  generic: {
    label: 'Cảnh báo chung',
    causes: ['Chưa có cấu hình nguyên nhân cho loại cảnh báo này'],
    steps: [
      { id: 'inspect', text: 'Kiểm tra {device} tại hiện trường' },
      { id: 'report', text: 'Ghi nhận kết quả vào ghi chú xử lý' },
    ],
  },
};

type ThresholdKind = Exclude<AlertKind, 'gas-leak' | 'fire'>;
const thresholdKinds = {} as Record<ThresholdKind, AlertKindConfig>;
for (const k of Object.keys(PLAYBOOKS) as ThresholdKind[]) thresholdKinds[k] = { ...THRESHOLD, ...PLAYBOOKS[k] };

export const ALERT_KINDS: Readonly<Record<AlertKind, AlertKindConfig>> = {
  ...thresholdKinds,
  // Ảnh drawer gas (scratch/figma-ref/alert-drawer-gas-*.png): 7 bước giữ nguyên chữ; ảnh không có "Nguyên nhân".
  'gas-leak': {
    label: 'Rò rỉ khí gas',
    skills: ['gas', 'safety'],
    panel: 'gas',
    value: 'live',
    scale: { min: 0, max: 100 },
    bands: GAS_BANDS,
    banner: {
      fromLevel: 'level-2',
      esdLevel: 'esd',
      title: 'Quy trình Khẩn cấp (ESD)',
      beforeEsd: 'Nồng độ hiện tại đang ở mức cảnh báo cấp 2. Nếu đạt hoặc vượt {esd}, thực hiện quy trình ESD và sơ tán theo quy định.',
      afterEsd: 'Đã vượt ngưỡng ESD ({esd}), thực hiện quy trình ESD và sơ tán ngay.',
    },
    causes: [],
    steps: [
      { id: 'verify-sensor', text: 'Xác minh lại giá trị cảm biến {device}' },
      { id: 'compare-nearby', text: 'Đối chiếu với {nearbySensor} và các cảm biến lân cận' },
      { id: 'restrict-access', text: 'Hạn chế người không có nhiệm vụ tiếp cận khu vực' },
      { id: 'notify-safety', text: 'Thông báo người phụ trách ca và bộ phận an toàn' },
      { id: 'check-joints', text: 'Kiểm tra van, mặt bích, khớp nối và đường ống mềm' },
      { id: 'monitor', text: 'Theo dõi nồng độ khí liên tục' },
      { id: 'maintenance-if-leak', text: 'Tạo yêu cầu bảo trì nếu phát hiện điểm rò rỉ thiết bị' },
    ],
    actions: ['support', 'maintenance'],
    update: GAS_UPDATE,
    collapsed: ['progress', 'notes', 'log'],
  },
  // Ảnh drawer báo cháy FIR-00018 (scratch/figma-ref/alert-drawer-fire-*.png): 5 bước giữ nguyên chữ; ảnh không có "Nguyên nhân";
  // Tiến trình + Ghi chú mở sẵn (như ảnh). Chân: Phân công + Xem quy trình khẩn cấp (không có Tạo yêu cầu bảo trì khi đang mở).
  fire: {
    label: 'Báo cháy',
    skills: ['fire', 'safety'],
    panel: 'fire',
    value: 'live',
    causes: [],
    steps: [
      { id: 'verify-camera', text: 'Xác minh vị trí cháy qua camera và trực tiếp' },
      { id: 'notify-fire-team', text: 'Thông báo đội PCCC nội bộ và an toàn nhà máy' },
      { id: 'check-gas', text: 'Kiểm tra các cảm biến gas lân cận' },
      { id: 'restrict-evacuate', text: 'Hạn chế tiếp cận và chuẩn bị phương án sơ tán' },
      { id: 'isolate-gas', text: 'Chuẩn bị cô lập hệ thống gas nếu cần thiết' },
    ],
    actions: ['assign', 'procedure'],
    update: FIRE_UPDATE,
    defaultOwner: 'Trực ca',
    falseAlarmMaintenance: { title: 'Kiểm tra đầu báo {device}' },
    crossConfirmTitle: 'Nhiều tín hiệu cùng báo, nguy cơ cháy cao',
    // BẢN NHÁP do dev soạn – chưa có quy trình chính thức của nhà máy (docs/questions.md). Số nội bộ: chờ khách cung cấp.
    emergency: {
      title: 'Quy trình ứng phó cháy',
      draft: 'Bản nháp, cần bộ phận An toàn duyệt',
      steps: [
        'Xác minh đám cháy qua camera hoặc người tại hiện trường; không đi một mình vào khu vực.',
        'Bấm nút báo cháy gần nhất, thông báo trưởng ca và đội PCCC nội bộ.',
        'Gọi Cứu hỏa 114 khi xác nhận có cháy hoặc không kiểm soát được.',
        'Cô lập nguồn gas cấp vào khu vực (van ngắt khẩn cấp / ESD) theo chỉ đạo trưởng ca.',
        'Dùng phương tiện chữa cháy tại chỗ nếu đám cháy nhỏ và an toàn cho người thao tác.',
        'Sơ tán người không có nhiệm vụ về điểm tập kết, kiểm đếm quân số.',
        'Hướng dẫn lực lượng chữa cháy vào khu vực, cung cấp sơ đồ và vị trí nguồn gas.',
      ],
      contacts: [
        { id: 'fire-114', name: 'Cứu hỏa', role: 'Cảnh sát PCCC & CNCH', phone: '114' },
        { id: 'shift-lead', name: 'Trưởng ca', role: 'Điều hành ca trực' },
        { id: 'fire-team', name: 'Đội PCCC nội bộ', role: 'Chữa cháy tại chỗ' },
        { id: 'hse', name: 'An toàn – HSE', role: 'Bộ phận an toàn nhà máy' },
      ],
    },
  },
};

/** Thay `{device}` / `{safetyValve}` / `{regulator}` / `{tag}` / `{nearbySensor}` / `{sensor}` / `{smoke}` / `{gas}` trong chữ cấu hình. */
export function fillPlaybookText(text: string, device: string, vars: { nearbySensor?: string; tag?: string; sensor?: string; smoke?: string; gas?: string } = {}): string {
  return text
    .replace(/\{sensor\}/g, vars.sensor ?? 'cảm biến')
    .replace(/\{smoke\}/g, vars.smoke ?? '')
    .replace(/\{gas\}/g, vars.gas ?? '')
    .replace(/\{device\}/g, device)
    .replace(/\{safetyValve\}/g, SAFETY_VALVES[device] ?? 'an toàn của thiết bị')
    .replace(/\{regulator\}/g, REGULATORS[device] ?? 'của thiết bị')
    .replace(/\{tag\}/g, vars.tag ?? 'cảm biến áp suất')
    .replace(/\{nearbySensor\}/g, vars.nearbySensor ?? 'cảm biến kề');
}
