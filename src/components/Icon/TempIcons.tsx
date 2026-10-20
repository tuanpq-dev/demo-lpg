/**
 * ⚠ ICON TẠM – chỉ có trong ảnh thiết kế modal "Tạo yêu cầu bảo trì" (chưa có node Figma / MCP bị giới hạn).
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
