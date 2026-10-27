/**
 * Cấu hình theo LOẠI cảnh báo – MỘT chỗ quyết định drawer chi tiết cảnh báo hiển thị gì:
 * panel thông số (`threshold` một ngưỡng · `gas` nhiều mức), số lớn lấy từ bản ghi hay live, thang + bands mức,
 * banner khẩn cấp, nguyên nhân, hướng dẫn xử lý, nút phụ ở chân drawer, kiểu "cập nhật/đóng", mục thu gọn.
 * Không viết cứng trong UI: drawer đọc `ALERT_KINDS[alert.kind]` (thiếu → `generic`). Thêm loại mới: GUIDE mục 4m.
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
   * Nút chính khi Đang xử lý: resolve-note = "Đánh dấu đã xử lý" (cần ghi chú) · gas-update = "Cập nhật xử lý" (modal: tiếp
   * tục / đã xử lý xong – chỉ đóng khi live < mức `closeBelow`; mất tín hiệu → bắt buộc số đo lại < mức đó) · fire-update =
   * "Cập nhật xử lý" báo cháy (Tiếp tục / Đã xử lý sự cố / Báo động giả; ghi chú bắt buộc cả 3; chỉ đóng khi đầu báo đã phục
   * hồi; mất tín hiệu → xác nhận kiểm tra tại chỗ; kết quả đóng lưu `resolution` – thống kê báo động giả).
   */
  update: { kind: 'resolve-note' } | { kind: 'gas-update'; closeBelow: AlertLevel } | { kind: 'fire-update' };
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

/** Van an toàn theo bồn (ảnh ghi "van PR-101" – dữ liệu dùng PSV-101, CLAUDE.md mục 8). */
export const SAFETY_VALVES: Readonly<Record<string, string>> = { 'V-101': 'PSV-101', 'V-102': 'PSV-102' };

/** Bands mặc định của khí gas theo ảnh (27/10/2026): 0–10 bình thường · 10–20 cấp 1 · 20–40 cấp 2 · ≥ 40 ESD – CHỜ chốt với
 * khách (dữ liệu cũ ghi ngưỡng 20 % LEL; CLAUDE.md mục 7). */
export const GAS_BANDS: readonly AlertBand[] = [
  { level: 'normal', from: 0, to: 10, label: 'Bình thường', tone: 'success' },
  { level: 'level-1', from: 10, to: 20, label: 'Cảnh báo cấp 1', tone: 'warning-dim' },
  { level: 'level-2', from: 20, to: 40, label: 'Cảnh báo cấp 2', tone: 'warning' },
  { level: 'esd', from: 40, label: 'ESD', tone: 'danger' },
];

/** Mặc định của panel một ngưỡng (hành vi drawer áp suất trước khi tách cấu hình). */
const THRESHOLD = { panel: 'threshold', value: 'record', actions: ['assign', 'maintenance'], update: { kind: 'resolve-note' } } as const;

type PlaybookPart = { label: string; gauge?: boolean; numericValue?: false; skills?: readonly StaffSkill[]; causes: readonly string[]; steps: readonly { id: string; text: string }[] };

const PLAYBOOKS: Readonly<Record<Exclude<AlertKind, 'gas-leak' | 'fire'>, PlaybookPart>> = {
  // Ảnh drawer ALT-00128 (3 nguyên nhân + 3 bước giữ nguyên chữ; "van PR-101" → van an toàn của bồn).
  'tank-overpressure': {
    label: 'Áp suất bồn vượt ngưỡng',
    skills: ['pressure', 'mechanical'],
    causes: ['Van an toàn kẹt', 'Nhiệt độ tăng cao', 'Hệ thống làm mát không kích hoạt'],
    steps: [
      { id: 'field-gauge', text: 'Kiểm tra đồng hồ áp suất cơ tại hiện trường' },
      { id: 'verify-valve', text: 'Xác minh trạng thái van {safetyValve}' },
      { id: 'cooling-ready', text: 'Sẵn sàng kích hoạt hệ thống làm mát / xả áp thủ công' },
    ],
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
    update: { kind: 'gas-update', closeBelow: 'level-1' },
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
    update: { kind: 'fire-update' },
    defaultOwner: 'Trực ca',
    falseAlarmMaintenance: { title: 'Kiểm tra đầu báo {device}' },
    crossConfirmTitle: 'Nhiều tín hiệu cùng báo, nguy cơ cháy cao',
    // BẢN NHÁP do dev soạn – chưa có quy trình chính thức của nhà máy (CLAUDE.md mục 7). Số nội bộ: chờ khách cung cấp.
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

/** Thay `{device}` / `{safetyValve}` / `{nearbySensor}` trong chữ cấu hình. */
export function fillPlaybookText(text: string, device: string, vars: { nearbySensor?: string } = {}): string {
  return text
    .replace(/\{device\}/g, device)
    .replace(/\{safetyValve\}/g, SAFETY_VALVES[device] ?? 'an toàn của thiết bị')
    .replace(/\{nearbySensor\}/g, vars.nearbySensor ?? 'cảm biến kề');
}
