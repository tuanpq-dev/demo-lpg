/**
 * Icon tải từ Figma (Digital-Twin_2026_Foxconn) qua MCP.
 * Giữ nguyên file SVG gốc – không vẽ lại, không sửa path. Màu nằm sẵn trong SVG.
 */
import add from './icon-add-circle.svg';
import bell from './icon-bell.svg';
import dangerLg from './icon-danger-lg.svg';
import logo from './icon-logo.svg';
import settings from './icon-settings.svg';
import calendar from './icon-calendar.svg';
import check from './icon-check.svg';
import chevronDown from './icon-chevron-down.svg';
import clock from './icon-clock.svg';
import danger from './icon-danger.svg';
import download from './icon-download.svg';
import eye from './icon-eye.svg';
import filter from './icon-filter.svg';
import refresh from './icon-refresh.svg';
import refreshAccent from './icon-refresh-accent.svg';
import search from './icon-search.svg';
import navAlert from './nav-alert.svg';
import navAlertActive from './nav-alert-active.svg';
import navChevronDown from './nav-chevron-down.svg';
import navMaintenance from './nav-maintenance.svg';
import navMaintenanceActive from './nav-maintenance-active.svg';
import navMap from './nav-map.svg';
import navOperation from './nav-operation.svg';
import navOverview from './nav-overview.svg';
import navOverviewActive from './nav-overview-active.svg';
import navReport from './nav-report.svg';

import kpiAlertCritical from './kpi-alert-critical.svg';
import kpiAlertDone from './kpi-alert-done.svg';
import kpiAlertProgress from './kpi-alert-progress.svg';
import kpiAlertUnack from './kpi-alert-unack.svg';
import kpiDanger from './kpi-danger.svg';
import kpiDash from './kpi-dash.svg';
import kpiFlow from './kpi-flow.svg';
import kpiInventory from './kpi-inventory.svg';
import kpiMtDone from './kpi-mt-done.svg';
import kpiMtDoneSm from './kpi-mt-done-sm.svg';
import kpiMtOverdue from './kpi-mt-overdue.svg';
import kpiMtOverdueSm from './kpi-mt-overdue-sm.svg';
import kpiMtPending from './kpi-mt-pending.svg';
import kpiMtReview from './kpi-mt-review.svg';
import kpiMtTimer from './kpi-mt-timer.svg';
import kpiMtTotal from './kpi-mt-total.svg';
import kpiTrendUp from './kpi-trend-up.svg';
import shield from './icon-shield.svg';

import mapConnectorWarning from './map-connector-warning.svg';
import mtDeviceGas from './mt-device-gas.svg';
import mtDeviceValve from './mt-device-valve.svg';
import mtDeviceVaporizer from './mt-device-vaporizer.svg';
import mtDue from './mt-due.svg';
import mtDueOverdue from './mt-due-overdue.svg';
import sectionTimer from './section-timer.svg';
import sectionWarning from './section-warning.svg';
import mapFullscreen from './map-fullscreen.svg';
import mapPinAccent from './map-pin-accent.svg';
import mapPinDanger from './map-pin-danger.svg';
import mapPinSuccess from './map-pin-success.svg';
import mapZoomIn from './map-zoom-in.svg';
import mapZoomOut from './map-zoom-out.svg';

// Chi tiết báo cáo ngày – file A88YJ2BRhICDDdeu2rtRg1 (bản sao), frame 117:4250.
import reportProgress from './report-progress.svg';
import reportConfirmed from './report-confirmed.svg';
import reportAbnormalNone from './report-abnormal-none.svg';
import reportMissing from './report-missing.svg';
import reportSignature from './report-signature.svg';
import reportRecordEdit from './report-record-edit.svg';
import tableGroupChevron from './report-group-chevron.svg';
import reportReadingAuto from './report-reading-auto.svg';
import logArrowUp from './log-arrow-up.svg';
import logAlert from './log-alert.svg';
import logLinkOff from './log-link-off.svg';

export { default as avatarAdmin } from './avatar-admin.png';
/** 53:244 – ảnh bản đồ 2.5D (2730×1536, KHÔNG có nhãn – nhãn là overlay HTML). */
export { default as plantMapImage } from './plant-map.png';
/** Ảnh tĩnh bồn V-101 (chụp từ SceneViewer cảnh v-101, góc isometric) – dự phòng khi WebGL lỗi ở trang chi tiết. */
export { default as assetV101Image } from './asset-v101.webp';

export const icons = {
  /** 70:5215 – nút "Tạo yêu cầu bảo trì", 16.125×16.125 trong khung 18 */
  add,
  /** 53:81 – chuông thông báo trên AppHeader, 20×22 trong khung 24 */
  bell,
  /** 53:16 – logo nhà máy trong ô 40px của AppHeader, 20×20 */
  logo,
  /** 53:82 – cài đặt trên AppHeader, ~21.5×20.4 trong khung 24 */
  settings,
  /** 70:5231 – nút "Hôm nay", 18×18 */
  calendar,
  /** 70:5577 – pill "Hoàn thành", 8×6 */
  check,
  /** 65:1600 – chevron của Select "Options", 20×20 */
  chevronDown,
  /** 53:129 – nút ngày giờ, 16.5×16.5 trong khung 18 */
  clock,
  /** 53:461 – header "Cảnh báo ưu tiên", ~15.7×14.7 trong khung 18 */
  danger,
  /** 70:2903 – tiêu đề section "CẢNH BÁO ƯU TIÊN" (đỏ #D34957), ~20.9×19.6 trong khung 24 */
  dangerLg,
  /** 70:5212 – nút "Xuất báo cáo", 18×18 */
  download,
  /** 70:3083 – cột "Thao tác" bảng, 16.5×11.25 */
  eye,
  /** 70:3029 – nút lọc nâng cao trong FilterBar, 13.5×9 */
  filter,
  /** 70:4046 – nút làm mới (nền tối), 12×12 */
  refresh,
  /** 70:2891 – nút làm mới (nền accent), 12×12 */
  refreshAccent,
  /** 70:3022 – kính lúp trong SearchInput, 13.5×13.5 */
  search,

  /** 53:431 – khiên "Độ tin cậy hệ thống", 10.7×13.3 (xanh) */
  shield,

  // ---- KpiCard – Tổng quan (53:166) ----
  /** 53:171 Tồn kho, 15×15 */
  kpiInventory,
  /** 53:193 Tiêu thụ, 15×12.5 */
  kpiFlow,
  /** 53:218 Cảnh báo (đỏ), ~20.9×19.6 trong khung 24 */
  kpiDanger,
  /** 53:239 gạch ngang "—" xanh trước "Đang chạy", 9.3×1.2 */
  kpiDash,

  // ---- KpiCard compact – Cảnh báo (70:2957), khung 18 ----
  kpiAlertCritical,
  kpiAlertUnack,
  kpiAlertProgress,
  kpiAlertDone,

  // ---- KpiCard compact – Bảo trì (70:5207), khung 24 / dòng phụ 18 ----
  kpiMtTotal,
  kpiMtPending,
  kpiMtTimer,
  kpiMtReview,
  kpiMtOverdue,
  kpiMtOverdueSm,
  kpiMtDone,
  kpiMtDoneSm,
  /** 70:4516 mũi tên tăng "+12% vs tháng trước", 18×18 */
  kpiTrendUp,

  // ---- PlantMap (53:242) ----
  /** 53:311 phóng to, 13.5×13.5 */
  mapZoomIn,
  /** 53:314 thu nhỏ, 13.5×13.5 */
  mapZoomOut,
  /** 53:317 toàn màn hình, 15×12 */
  mapFullscreen,
  /** 53:253 chốt dọc 11×54 dưới callout – xanh / accent / đỏ */
  mapPinSuccess,
  mapPinAccent,
  mapPinDanger,
  /** 53:297 đường nối ngang ~70×10.7 của nhãn "Khu nạp LPG" (vàng) */
  mapConnectorWarning,

  // ---- Bảo trì (70:3964) ----
  /** 70:5223 tiêu đề "Công việc cần ưu tiên" (viền vàng), ~19.7×21.5 trong khung 24 */
  sectionWarning,
  /** 70:5602 tiêu đề "Danh sách yêu cầu bảo trì", 19×21.5 trong khung 24 */
  sectionTimer,
  /** 70:4592 thiết bị van/bồn (V-, PSV-), 18×18 */
  mtDeviceValve,
  /** 70:4612 cảm biến gas (GS-), 18×18 */
  mtDeviceGas,
  /** 70:4632 máy hóa hơi (E-), 18×18 */
  mtDeviceVaporizer,
  /** 70:4616 đồng hồ hạn xử lý, 18×18 */
  mtDue,
  /** 70:4596 đồng hồ quá hạn (đỏ), 18×18 */
  mtDueOverdue,

  // ---- NavTabs (53:23) – inactive xám, active cyan; khung 24 ----
  navOverview,
  navOverviewActive,
  navMap,
  navOperation,
  navChevronDown,
  navAlert,
  navAlertActive,
  navMaintenance,
  navMaintenanceActive,
  navReport,

  // ---- Chi tiết báo cáo ngày (117:4250) ----
  /** 117:4371 thẻ "Tiến độ kiểm tra" – biểu đồ cột cyan, 18×18 */
  reportProgress,
  /** 117:4388 thẻ "Dữ liệu đã xác nhận" – ô tick xanh, 18×18 */
  reportConfirmed,
  /** 117:4399 thẻ "Dữ liệu bất thường" khi = 0 – tam giác XANH, 18×18 (> 0 dùng `danger`) */
  reportAbnormalNone,
  /** 117:4411 thẻ "Dữ liệu còn thiếu" – tròn chấm than vàng, 18×18 */
  reportMissing,
  /** 117:4423 thẻ "Xác nhận báo cáo" – hai người (xám #4A6880), 18×18 */
  reportSignature,
  /** 126:8067 – bút chì "Nhập giá trị đồng hồ cơ" (modal Ghi nhận mốc kiểm tra), 10.5×10.5 */
  reportRecordEdit,
  /** 117:4605 dòng tiêu đề nhóm của DataTable (nhóm thiết bị) – mũi tên xuống cyan, 14×14 */
  tableGroupChevron,
  /** 117:4619 ô giờ – sóng tín hiệu cyan = số đo tự động (SCADA), 9×9 */
  reportReadingAuto,

  // ---- Nhật ký vận hành (64:418) ----
  /** 64:883 KPI "Tổng sự kiện hôm nay" – mũi tên tăng xanh cạnh số chênh lệch, 9.33×9.33 */
  logArrowUp,
  /** 64:895 KPI "Cảnh báo phát sinh" – tam giác viền đỏ, 12.83×11.08 */
  logAlert,
  /** 64:911 KPI "Thiết bị kết nối" – liên kết đứt vàng, 12.02×11.55 */
  logLinkOff,
} as const;

export type IconName = keyof typeof icons;
