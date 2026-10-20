/**
 * ⚠ ICON TẠM cho Scene Editor (/editor) – Figma chưa có thiết kế. Vẽ tối giản theo `currentColor` (màu theo token),
 * cùng khuôn với TempIcons. Thay bằng asset Figma khi có. Trang trí (aria-hidden); nhãn nằm ở phần tử chứa.
 */
import { tempIconBase as base, type TempIconProps as P } from './TempIcons';

/** Con trỏ – công cụ Chọn. */
export const CursorIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 3l14 7-6 2-2 6Z" />
  </svg>
);

/** 4 mũi tên – Di chuyển. */
export const MoveIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
  </svg>
);

/** Mũi tên vòng – Xoay. */
export const RotateIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v4h-4" />
  </svg>
);

/** Ô vuông + mũi tên chéo – Scale. */
export const ScaleIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="3" y="11" width="10" height="10" rx="1" />
    <path d="M13 11l8-8M15 3h6v6" />
  </svg>
);

/** Nam châm – Snap. */
export const MagnetIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M6 3v8a6 6 0 0 0 12 0V3" />
    <path d="M6 7h4M14 7h4M10 3v8a2 2 0 0 0 4 0V3" />
  </svg>
);

/** Lưới. */
export const GridIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

/** 4 góc khung – Khung hình vừa. */
export const FitIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />
    <rect x="8" y="8" width="8" height="8" rx="1" />
  </svg>
);

export const UndoIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const RedoIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);

export const EyeIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export const LockIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const UnlockIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.5-2" />
  </svg>
);

/** Mũi tên tam giác – mở/đóng nhánh cây (xoay 90° khi mở). */
export const CaretIcon = ({ size = 12, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const FilePlusIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6M12 12v6M9 15h6" />
  </svg>
);

export const FolderIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);

export const SaveIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M7 3v5h8M7 21v-7h10v7" />
  </svg>
);

/** Mũi tên vào khay – Import. */
export const ImportIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

/** Mũi tên ra khay – Export. */
export const ExportIcon = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const TrashIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

/** Hai tờ chồng – Nhân bản / Copy. */
export const DuplicateIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="8" y="8" width="13" height="13" rx="2" />
    <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
  </svg>
);

/** Máy ảnh – lưu góc nhìn. */
export const CameraIcon = ({ size = 14, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
