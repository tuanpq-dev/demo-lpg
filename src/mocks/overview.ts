/** Mock data màn Tổng quan – nội dung lấy nguyên văn từ Figma 53:11. */
import type {
  AlertItemData,
  AssetRowData,
  CategoryBarItem,
  DonutSegment,
  HealthStat,
  MapMarkerData,
  MapView,
  TimelineEvent,
  TrendPoint,
} from '@/components';
import { SYSTEM_TAGS, V101_TAGS, VAPORIZER_TAGS } from '@/features/live/tags';
import type { KpiMock } from './types';

export const overviewKpis: KpiMock[] = [
  {
    id: 'inventory',
    label: 'Tồn kho',
    icon: 'kpiInventory',
    iconBox: 16,
    value: '152,340',
    unit: 'Nm³',
    sub: '+2.5%',
    subTone: 'success',
    live: { tag: SYSTEM_TAGS.inventory, digits: 0 },
  },
  // Figma 53:241 "Đang chạy" có opacity-0 (ẩn) → chỉ hiện "—". Giá trị = % THỂ TÍCH quy đổi từ mức chiều cao LT-101.
  {
    id: 'tank-level',
    label: 'Mức bồn V-101',
    value: '76.02',
    unit: '%',
    subTone: 'success',
    subIcon: 'kpiDash',
    subDim: true,
    live: { tag: V101_TAGS.level, digits: 2, transform: 'tank-volume' },
  },
  {
    id: 'pressure',
    label: 'Áp suất hệ thống',
    value: '1.82',
    unit: 'bar',
    sub: 'Ổn định',
    subTone: 'success',
    subDim: true,
    live: { tag: SYSTEM_TAGS.pressure, digits: 2 },
  },
  {
    id: 'consumption',
    label: 'Tiêu thụ',
    icon: 'kpiFlow',
    iconBox: 16,
    value: '203',
    unit: 'Nm³/h',
    sub: 'Bình thường',
    subTone: 'warning-soft',
    subDim: true,
    live: { tag: SYSTEM_TAGS.consumption, digits: 0 },
  },
  { id: 'alerts', label: 'Cảnh báo', icon: 'kpiDanger', iconBox: 24, value: '2', unit: 'Active', variant: 'danger', action: 'Xem chi tiết' },
  { id: 'health', label: 'Sức khỏe thiết bị', value: '98.7', unit: '%', variant: 'with-progress', tone: 'success', progress: 98.7 },
];

export const systemHealth: { value: number; caption: string; stats: HealthStat[] } = {
  value: 98.7,
  caption: 'Hoạt động tối ưu',
  stats: [
    { label: 'Cảm biến', ok: 42, total: 45 },
    { label: 'Van', ok: 24, total: 28 },
    { label: 'Bơm', ok: 4, total: 4 },
  ],
};

export const priorityAlarms: AlertItemData[] = [
  // Figma 53:470 ghi PT-101; PT-101 nay là áp suất bồn V-101 → áp suất đầu vào hóa hơi là PT-201 (docs/figma-diffs.md).
  { id: 'a1', code: VAPORIZER_TAGS.inletPressure, message: 'Áp suất đầu vào hóa hơi cao.', time: '10 phút trước', severity: 'critical' },
  { id: 'a2', code: 'TT-302', message: 'Nhiệt độ tiệm cận giới hạn trên.', time: '24 phút trước', severity: 'high' },
  { id: 'a3', code: V101_TAGS.level, message: 'Mức bồn V-101 giảm nhanh bất thường.', time: '1 giờ trước', severity: 'high' },
];

/** `live`: tag quyết định dòng (mất tín hiệu → "Mất tín hiệu"; trạng thái chuỗi xấu → nhãn + tone theo FIELD_META). */
export const watchlist: (AssetRowData & { live?: { tag: string; field: string } })[] = [
  { id: 'pr-101', name: 'PR-101', statusLabel: 'Bình thường', tone: 'success', live: { tag: VAPORIZER_TAGS.inletPressure, field: 'pressure' } },
  { id: 'f-101', name: 'F-101', statusLabel: 'Bình thường', tone: 'success', live: { tag: 'PDT-101', field: 'pressure' } },
  { id: 'p-101a', name: 'P-101A', statusLabel: 'Đang chạy', tone: 'success', live: { tag: 'P-101A.STATE', field: 'state' } },
  { id: 'v-101', name: 'V-101', statusLabel: 'Ổn định', tone: 'success', live: { tag: V101_TAGS.level, field: 'level' } },
];

export const recentEvents: TimelineEvent[] = [
  { id: 'e1', title: 'Bắt đầu nạp LPG từ xe bồn', time: '08:15 AM', active: true },
  { id: 'e2', title: 'Bơm P-101B chuyển sang Standby', time: '07:30 AM' },
  { id: 'e3', title: 'Hoàn thành kiểm tra ca sáng', time: '06:00 AM' },
];

// ---------------- Chart (53:319) ----------------

const hours = Array.from({ length: 25 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

/** Xu hướng tồn kho 24h – Figma vẽ gần như phẳng ở ~60% chiều cao (53:325 cao 144/240). */
export const inventoryTrend: TrendPoint[] = hours.map((label, h) => ({
  label,
  value: Math.round(151_600 + 350 * Math.sin(h / 3) + 30 * h),
}));
/** Miền trục Y để đường tồn kho nằm ở ~60% chiều cao như Figma. */
export const inventoryDomain: [number, number] = [143_000, 157_000];

/** Áp suất 24h – dạng sóng theo path SVG 53:380 (dao động quanh 1.8 bar). */
export const pressureTrend: TrendPoint[] = hours.map((label, h) => ({
  label,
  value: +(1.8 + 0.06 * Math.sin(h / 2.2) - 0.05 * Math.sin(h / 1.3) + (h > 19 ? 0.08 * Math.sin((h - 19) / 1.6) : 0)).toFixed(2),
}));

/** Tiêu thụ theo khu vực – max 170 để tỉ lệ thanh khớp Figma (68 → 40%). */
export const consumptionByArea: { max: number; items: CategoryBarItem[] } = {
  max: 170,
  items: [
    { id: 'x1', label: 'Xưởng 1', value: 68, tone: 'accent' },
    { id: 'x2', label: 'Xưởng 2', value: 52, tone: 'warning' },
    { id: 'kb', label: 'Khu bếp', value: 45, tone: 'success' },
    { id: 'lh', label: 'Lò hơi', value: 38, tone: 'neutral' },
  ],
};

export const deviceStatus: DonutSegment[] = [
  { id: 'online', label: 'Online', value: 126, tone: 'success' },
  { id: 'warning', label: 'Cảnh báo', value: 2, tone: 'danger' },
  { id: 'offline', label: 'Offline', value: 2, tone: 'offline' },
];

// ---------------- Bản đồ 2.5D (53:242) ----------------
/**
 * Toạ độ marker = phân số trên ảnh gốc (0–1). Quy đổi từ Figma, (X, Y) là điểm neo
 * (đáy chốt / đầu đường nối / tâm nhãn), ảnh hiển thị cỡ 1287×828.5 với top -78.16:
 * - Marker là con của layer ảnh 53:244 (callout, side): fx = X / 1287
 * - Marker là con của khung 53:243 (tag "Khu sản xuất"): fx = (X + 70.5) / 1287  (layer ảnh lệch -70.5)
 * - fy = (Y + 78.16) / 828.5 cho cả hai (layer ảnh và khung cùng top 0).
 */
/** `live`: giá trị nhãn lấy từ tag (định dạng theo trường); tone giữ như Figma, mất tín hiệu → xám + "Mất tín hiệu". */
export const mapMarkers: (MapMarkerData & { live?: { tag: string; field: string } })[] = [
  {
    id: 'pump',
    variant: 'callout',
    tone: 'success',
    title: 'Cụm bơm & lọc',
    value: 'Hoạt động',
    showDot: true,
    x: 0.4934,
    y: 0.4625,
    live: { tag: 'P-101A.STATE', field: 'state' },
  },
  {
    id: 'ft-101',
    variant: 'callout',
    tone: 'accent',
    title: 'FT-101',
    value: '203  m³/h',
    x: 0.6364,
    y: 0.6616,
    live: { tag: 'FT-101', field: 'flow' },
  },
  { id: 'v-101', variant: 'callout', tone: 'accent', title: 'Khu bồn LPG', value: 'V- 101', x: 0.366, y: 0.6194 },
  {
    id: 'vaporizer',
    variant: 'callout',
    tone: 'danger',
    title: 'Hóa hơi và điều áp',
    value: '45.6 °C',
    showWarningIcon: true,
    x: 0.7879,
    y: 0.6387,
    live: { tag: 'TT-201', field: 'temperature' },
  },
  {
    id: 'loading',
    variant: 'side',
    tone: 'warning',
    title: 'Khu nạp LPG',
    value: 'Đang nạp',
    x: 0.3081,
    y: 0.4251,
    live: { tag: 'LOAD-01.STATE', field: 'state' },
  },
  { id: 'production', variant: 'tag', title: 'Khu sản xuất', x: 0.7805, y: 0.1909 },
];

export const mapViews: MapView[] = [
  { id: 'all', label: 'Toàn cảnh' },
  { id: 'tanks', label: 'Bồn chứa', focus: { x: 0.37, y: 0.64, zoom: 1.8 } }, // quanh marker V-101
  { id: 'pumps', label: 'Bơm & Lọc', focus: { x: 0.52, y: 0.38, zoom: 1.8 } }, // quanh cụm bơm & lọc
];

/** Trạng thái hệ thống ở hàng status (53:125). */
export const systemStatus: { tone: 'success' | 'warning' | 'danger'; label: string } = {
  tone: 'success',
  label: 'Hệ thống bình thường',
};
