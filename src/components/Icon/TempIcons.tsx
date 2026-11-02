/**
 * ⚠ ICON TẠM – chỉ có trong ảnh thiết kế (modal "Tạo yêu cầu bảo trì", trang chi tiết tài sản; chưa có node Figma).
 * Vẽ tối giản theo `currentColor` để màu theo token. Thay bằng asset Figma qua <Icon name="…" /> khi có.
 * Tất cả đều trang trí (aria-hidden); nhãn nằm ở phần tử chứa.
 */
import type { SVGProps } from 'react';

export type TempIconProps = SVGProps<SVGSVGElement> & { size?: number };
type P = TempIconProps;
/** Thuộc tính chung của icon tạm (24×24, nét 1.6, currentColor, aria-hidden). */
export const tempIconBase = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

/** Cờ lê + tua vít – icon header modal bảo trì. */
export const ToolsIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.4 1.4 0 0 0 2 2l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-2-2 2.4-2.4Z" />
    <path d="m13 15 4.5 4.5a1.4 1.4 0 0 0 2-2L15 13" />
    <path d="M17.5 3.5 20.5 6.5 18.5 8.5 15.5 5.5Z" />
  </svg>
);

/** Đám mây + mũi tên lên – vùng tải tệp. */
export const UploadIcon = ({ size = 22, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.9 8.5 4.2 4.2 0 0 1 17 18" />
    <path d="M12 12v8M9 15l3-3 3 3" />
  </svg>
);

/** Tệp tài liệu. */
export const FileIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

/** Kẹp giấy – tiêu đề "Tệp đính kèm". */
export const PaperclipIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m20 11.5-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7" />
  </svg>
);

/** Khiên – tiêu đề "Ghi chú & An toàn". */
export const ShieldIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6Z" />
    <path d="M12 9v4M12 16h.01" />
  </svg>
);

/** Sao lấp lánh – khối "Góp ý từ AI". */
export const SparkleIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

/** Vòng tròn có dấu tick – gợi ý kiểm tra. */
export const CheckCircleIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
  </svg>
);

/** Mũi tên gửi – nút "Tạo yêu cầu". */
export const SendIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M4 12 20 4l-4 16-4-6.5Z" />
    <path d="m12 13.5 8-9.5" />
  </svg>
);

/** 6 chấm – tay kéo sắp xếp. */
export const GripIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, { ...p, stroke: 'none', fill: 'currentColor' })}>
    {[7, 12, 17].map((y) => (
      <g key={y}>
        <circle cx="9" cy={y} r="1.4" />
        <circle cx="15" cy={y} r="1.4" />
      </g>
    ))}
  </svg>
);

/** Người + dấu cộng – ô tìm nhân sự. */
export const PeopleIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20a6 6 0 0 1 12 0M18 8v6M15 11h6" />
  </svg>
);

/** Danh sách mẫu – nút "Chọn checklist mẫu". */
export const TemplateIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </svg>
);

/** Dấu cộng. */
export const PlusIcon = ({ size = 14, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Dấu ×. */
export const CloseIcon = ({ size = 12, ...p }: P) => (
  <svg {...tempIconBase(size, { ...p, strokeWidth: 1.8 })}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** Mũi tên phải – link "Xem cảnh báo →". */
export const ArrowRightIcon = ({ size = 14, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Khiên có dấu × – banner "Quy trình Khẩn cấp (ESD)" (ảnh drawer gas). Icon tạm. */
export const ShieldAlertIcon = ({ size = 22, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z" fill="currentColor" fillOpacity="0.2" />
    <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
  </svg>
);

/** Tam giác cảnh báo (viền) – dải liên kết cảnh báo. */
export const AlertTriangleIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </svg>
);

/** Sóng tín hiệu bị gạch – "Mất tín hiệu" (tag quality bad / không cập nhật). Icon tạm, chưa có trong Figma. */
export const SignalLostIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M2.5 8.5a14 14 0 0 1 5-2.9M12 5a14 14 0 0 1 9.5 3.5M5.5 12a9 9 0 0 1 3.4-2M15 10.4a9 9 0 0 1 3.5 1.6M9 15.5a4.5 4.5 0 0 1 6 0" />
    <circle cx="12" cy="19" r="0.9" fill="currentColor" />
    <path d="M3.5 3.5l17 17" />
  </svg>
);

/** Ba gạch – nút mở menu điều hướng thu gọn (màn hẹp). */
export const MenuIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

// ---- Trang chi tiết tài sản (ảnh "Bồn LPG V-101", chưa có node Figma) ----

/** Vòng tròn có dấu chấm than – cảnh báo liên quan (warning/danger theo màu chữ). */
export const AlertCircleIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);

/** Đồng hồ có mũi tên quay ngược – "Lịch sử cảnh báo", "Bảo trì gần nhất". */
export const HistoryIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
    <path d="M3.5 4.5V8h3.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

/** Bản đồ gấp – "Xem trên bản đồ". */
export const MapIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m3 6.5 6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </svg>
);

/** Khung ngắm 4 góc + chấm giữa – nút toàn màn hình của "Mô hình tài sản". */
export const FocusIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

/** Thông tin (chữ i trong vòng tròn) – nhãn có định nghĩa (KpiCard `hint`). */
export const InfoIcon = ({ size = 14, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </svg>
);

// ---- Trang chi tiết yêu cầu bảo trì (ảnh MT-00128, chưa có node Figma) ----

/** Đồng hồ bấm giờ – "Hạn chót xử lý". */
export const TimerIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 9.5v4l2.5 1.5M10 2.5h4M12 2.5V6" />
  </svg>
);

/** Người + dấu cộng – "Phân công". */
export const UserPlusIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
  </svg>
);

/** Người (ô avatar trống ở ô nhập ghi chú). */
export const UserIcon = ({ size = 14, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);

/** Danh sách có dấu tick – "Checklist công việc". */
export const ListChecksIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="m3 6 1.8 1.8L8 4.5M3 13l1.8 1.8L8 11.5M11.5 6.5H21M11.5 13.5H21M4 19.5h17" />
  </svg>
);

/** 3 dòng kẻ – "Ghi chú kỹ thuật". */
export const NotesIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M4 6.5h16M4 12h16M4 17.5h10" />
  </svg>
);

/** Ảnh (khung + núi + mặt trời) – tệp ảnh. */
export const ImageIcon = ({ size = 22, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="m4 18 5-5 3.5 3.5L15 14l5 4.5" />
  </svg>
);

/** Sách mở – tài liệu hướng dẫn (manual). */
export const BookIcon = ({ size = 22, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z" />
    <path d="M12 6.5v13M6 8.5c1.5 0 2.8.3 4 .8M6 12c1.5 0 2.8.3 4 .8M14 9.3c1.2-.5 2.5-.8 4-.8M14 12.8c1.2-.5 2.5-.8 4-.8" />
  </svg>
);

/** Mũi tên ra ngoài – link mở trang khác (Thiết bị "V-101 ↗"). */
export const ExternalLinkIcon = ({ size = 12, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

/** Cánh tay robot – "Thiết bị liên quan". */
export const DeviceArmIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M4 20.5h9M6 20.5v-3h5v3M8.5 17.5 6.5 10.5l7-4M13.5 6.5 18 4" />
    <circle cx="6.5" cy="10.5" r="1.6" />
    <circle cx="13.5" cy="6.5" r="1.6" />
    <path d="m18 4 2.5 2.5M18 4l-.5 3.5" />
  </svg>
);

/** Bảng kẹp giấy + đồng hồ – trạng thái trống "Kết quả bảo trì". */
export const ClipboardClockIcon = ({ size = 40, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M15 4.5h2.5a2 2 0 0 1 2 2V11M10.5 21H6.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2H9" />
    <rect x="9" y="3" width="6" height="3" rx="1" />
    <circle cx="16.5" cy="17" r="4.5" />
    <path d="M16.5 15v2.2l1.4.9" />
  </svg>
);

/** Bảng kẹp giấy có dấu tick – "Kết quả bảo trì". */
export const ClipboardCheckIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <rect x="4.5" y="4.5" width="15" height="16.5" rx="2" />
    <rect x="9" y="3" width="6" height="3" rx="1" />
    <path d="m9 13.5 2 2 4-4" />
  </svg>
);


// ---- Modal "Cập nhật tiến độ bảo trì" (ảnh thiết kế, chưa có node Figma) ----

/** Vòng tròn + tam giác phát – "Đang thực hiện". */
export const PlayCircleIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.6v6.8l5.4-3.4Z" />
  </svg>
);

/** Vòng tròn + hai vạch – "Tạm dừng". */
export const PauseCircleIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9v6M14 9v6" />
  </svg>
);

/** Bát giác có dấu chấm than – "Gặp sự cố". */
export const AlertOctagonIcon = ({ size = 20, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3Z" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);

/** Khay + mũi tên lên – ô "Tải tệp lên". */
export const UploadTrayIcon = ({ size = 22, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
  </svg>
);

// ---- Màn Báo cáo (ảnh thiết kế, chưa có node Figma) ----

/** Ba chấm dọc – menu thao tác cuối hàng bảng báo cáo. */
export const MoreVerticalIcon = ({ size = 18, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

// ---- Màn Vận hành – chi tiết thiết bị (ảnh `scratch/figma-ref/op-device-*.png`, chưa có node Figma) ----

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
    <path d="M9.6 13.2v-5h1.4a1.3 1.3 0 0 1 0 2.6H9.6M13.2 13.2v-5h.9a1.6 1.6 0 0 1 1.6 1.6v1.8a1.6 1.6 0 0 1-1.6 1.6h-.9ZM17.9 8.2h-1.4v5M16.5 10.6h1.2" strokeWidth={1.2} />
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
