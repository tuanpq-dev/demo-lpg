/** ⚠ ICON TẠM – thiết bị, vận hành, mô phỏng (cùng khuôn TempIcons; thay bằng asset Figma khi có). Trang trí (aria-hidden). */
import { tempIconBase, type TempIconProps as P } from './iconBase';

/** Nhiệt kế + vạch – "Nhiệt độ đầu ra", cảm biến nhiệt trên sơ đồ. */
export const ThermometerIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M9 14.8V4.5a2.5 2.5 0 0 1 5 0v10.3a4 4 0 1 1-5 0Z" />
    <path d="M11.5 10v6.5" />
    <path d="M17 5h3M17 8.5h3" />
  </svg>
);

/** Đồng hồ áp suất – "Áp suất đầu ra". */
export const GaugeIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M4.5 18a9 9 0 1 1 15 0" />
    <path d="m12 14 4-5" />
    <circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

/** Tia sét – "Hiệu suất hóa hơi". */
export const BoltIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />
  </svg>
);

/** Chip vi xử lý – trạng thái PLC. */
export const CpuIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
    <path d="M9.5 2.5v3.5M14.5 2.5v3.5M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5" />
  </svg>
);

/** Ghim vị trí – "Khu vực". */
export const MapPinIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 21.5s7-6.2 7-11.5a7 7 0 0 0-14 0c0 5.3 7 11.5 7 11.5Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

/** Tệp PDF xếp chồng – "Biểu mẫu báo cáo bản nháp" (modal ký báo cáo). */
export const PdfFileIcon = ({ size = 32, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M3.5 7.5v12a1 1 0 0 0 1 1h12" />
    <rect x="7" y="3.5" width="13.5" height="13.5" rx="1.2" />
    <path
      d="M9.6 13.2v-5h1.4a1.3 1.3 0 0 1 0 2.6H9.6M13.2 13.2v-5h.9a1.6 1.6 0 0 1 1.6 1.6v1.8a1.6 1.6 0 0 1-1.6 1.6h-.9ZM17.9 8.2h-1.4v5M16.5 10.6h1.2"
      strokeWidth={1.2}
    />
  </svg>
);

/** Bút ký có nét chữ ký – nút "Ký xác nhận báo cáo". */
export const SignaturePenIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m14.5 5.5 4 4M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" />
    <path d="M3 21c1.5-1.3 2.6-1.3 3.5 0s2 1.3 3.5 0 2.4-1.3 3.5 0" />
  </svg>
);

/** Sóng phát – nút "Bồn LPG V-101" (sơ đồ kết nối PLC/SCADA). */
export const BroadcastIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="1.6" />
    <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
  </svg>
);

/** Sơ đồ nhánh – nút "E-101A/B". */
export const NetworkIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="9" y="3" width="6" height="5" rx="1" />
    <rect x="3" y="16" width="6" height="5" rx="1" />
    <rect x="15" y="16" width="6" height="5" rx="1" />
    <path d="M12 8v4M6 16v-4h12v4" />
  </svg>
);

/** Thanh trượt – nút "PR-101" (điều áp). */
export const SlidersIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M6 4v16M12 4v16M18 4v16" />
    <path d="M4 9h4M10 14h4M16 8h4" />
  </svg>
);

/** Ống chữ U – nút "Line 0/1/2". */
export const PipeLineIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M7 3v10a5 5 0 0 0 10 0V3" />
    <path d="M4 6h6M14 6h6" />
  </svg>
);

/** Ngọn lửa – nút "Báo cháy". */
export const FlameIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8-1 2-2 2.5-3 2.5 0-2-1-4-3-6 .5 3-3.5 5.5-3.5 11a6 6 0 0 0 7 6.5Z" />
    <path d="M12 21a2.5 2.5 0 0 0 2.5-2.5c0-1.5-1-2.2-1.5-3.3-.5 1-1.3 1.3-2 1.3a2.5 2.5 0 0 0 1 4.5Z" />
  </svg>
);

/** Màn hình – khối "SCADA / HMI". */
export const MonitorIcon = ({ size = 24, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M9 20h6M12 16v4" />
  </svg>
);

// ---- AI mô phỏng sự cố (ảnh `scratch/figma-ref/ai-sim/`, chưa có node Figma đọc được) ----

/** Hai sao 4 cánh – tiêu đề "Góp ý từ AI". */
export const AiSparklesIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M10 4.5c.6 3.3 2.2 4.9 5.5 5.5-3.3.6-4.9 2.2-5.5 5.5-.6-3.3-2.2-4.9-5.5-5.5 3.3-.6 4.9-2.2 5.5-5.5Z" />
    <path d="M18 2.8c.3 1.4.9 2 2.2 2.2-1.3.3-1.9.9-2.2 2.2-.3-1.3-.9-1.9-2.2-2.2 1.3-.2 1.9-.8 2.2-2.2ZM18 15.5c.3 1.4.9 2 2.2 2.2-1.3.3-1.9.9-2.2 2.2-.3-1.3-.9-1.9-2.2-2.2 1.3-.2 1.9-.8 2.2-2.2Z" />
  </svg>
);

/** Hai khối máy chủ chồng – "Dữ liệu PLC/SCADA". */
export const ServerIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="3.5" y="4" width="17" height="7" rx="1.2" />
    <rect x="3.5" y="13" width="17" height="7" rx="1.2" />
    <path d="M7 7.5h.01M7 16.5h.01" strokeWidth={2.2} />
  </svg>
);

/** Khiên có dấu cộng – "Quy tắc an toàn". */
export const ShieldPlusIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6Z" />
    <path d="M12 9v6M9 12h6" />
  </svg>
);

/** Tam giác "phát" – nút "Chạy mô phỏng". */
export const PlayIcon = ({ size = 14, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M7 4.5v15l12-7.5Z" />
  </svg>
);

/** Bình gas có đầu dò – kịch bản rò rỉ LPG. */
export const GasCylinderIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M9 3.5h6M10 3.5v3M14 3.5v3" />
    <rect x="6" y="6.5" width="12" height="14" rx="3" />
    <circle cx="12" cy="14" r="2.2" />
  </svg>
);

/** Khung vuông có quạt – máy hóa hơi. */
export const FanBoxIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 7v10M7 12h10M8.5 8.5l7 7M15.5 8.5l-7 7" />
  </svg>
);

/** Dấu tick nét – danh sách "Quy tắc an toàn". */
export const CheckIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

// ---- Cấu hình kịch bản mô phỏng (ảnh 03/11/2026 – scratch/figma-ref/ai-sim-config/) ----

/** Mũi tên trái – nút "Quay lại danh sách". */
export const ArrowLeftIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

/** Bóng đèn – khung mô tả kịch bản. */
export const LightbulbIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2V16h5v-.1c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" />
  </svg>
);

/** Huy hiệu răng cưa có dấu tick – danh sách "Quy tắc an toàn" (màn cấu hình). */
export const BadgeCheckIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 2.8 14.3 4.5 17.1 4.3 18 7 20.4 8.5 19.5 11.2 20.4 14 18 15.5 17.1 18.2 14.3 18 12 19.7 9.7 18 6.9 18.2 6 15.5 3.6 14 4.5 11.2 3.6 8.5 6 7 6.9 4.3 9.7 4.5Z" />
    <path d="m8.6 11.4 2.3 2.3 4.5-4.6" />
  </svg>
);

/** Ô vuông có dấu tick – danh sách "Kết quả mong đợi của mô phỏng". */
export const CheckSquareIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="m8 12.2 2.8 2.8L16.2 9.5" />
  </svg>
);

/** Vòng tròn đặc (currentColor) + tam giác khoét – sau chữ "Bắt đầu chạy mô phỏng". */
export const PlayCircleSolidIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)} stroke="none">
    <path fill="currentColor" fillRule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19ZM10 8.3v7.4l5.8-3.7Z" />
  </svg>
);

// ---- Màn "Theo dõi diễn biến mô phỏng" (ảnh `ai-sim-monitor/`) ----

/** Bình thí nghiệm – huy hiệu "Đang chạy mô phỏng". */
export const FlaskIcon = ({ size = 14, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M9 3h6M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3" />
    <path d="M7.2 15h9.6" />
  </svg>
);

/** Đầu dò gas (hộp có lỗ cảm biến) – KPI "Nồng độ hiện tại". */
export const DetectorIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="6" y="3.5" width="12" height="17" rx="2" />
    <path d="M9.5 3.5V2M14.5 3.5V2" />
    <circle cx="12" cy="10" r="2.2" />
    <path d="M9.5 16h5" />
  </svg>
);

/** Chuông có sóng – KPI "Cảnh báo mô phỏng". */
export const BellRingIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
    <path d="M3.5 8.5A8 8 0 0 1 6 4.5M20.5 8.5A8 8 0 0 0 18 4.5" />
  </svg>
);

/** Mũi tên xu hướng tăng (xoay 180° … dùng `TrendDownIcon` cho giảm). */
export const TrendUpIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </svg>
);

export const TrendDownIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m3 7 6 6 4-4 8 8" />
    <path d="M15 17h6v-6" />
  </svg>
);

/** Đường gấp khúc có điểm – tiêu đề "Timeline diễn biến". */
export const ActivityLineIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m3 16 5-6 4 4 6-7" />
    <circle cx="3" cy="16" r="1.4" fill="currentColor" />
    <circle cx="21" cy="5.5" r="1.4" fill="currentColor" />
  </svg>
);

/** Ô vuông trong vòng tròn – nút "Dừng mô phỏng". */
export const StopCircleIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
  </svg>
);

// ---- Màn "Kết quả mô phỏng" (ảnh `ai-sim-result/`) ----

/** Hai mũi tên vòng – "Đã đồng bộ dữ liệu thời gian thực làm nền". */
export const SyncIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M7 6.5A7 7 0 0 1 19 12" />
    <path d="M17 17.5A7 7 0 0 1 5 12" />
    <path d="M7 3v3.5h3.5M17 21v-3.5h-3.5" />
  </svg>
);

/** Bảng tính – nút "Xuất Excel". */
export const SheetIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M4 9h16M10 9v11M15 9v11" />
  </svg>
);

/** Mắt trong khung – nút "Xem trước". */
export const PreviewIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M3.5 8h17" />
    <path d="M7 14s2-3 5-3 5 3 5 3-2 3-5 3-5-3-5-3Z" />
    <circle cx="12" cy="14" r="1.2" fill="currentColor" />
  </svg>
);
