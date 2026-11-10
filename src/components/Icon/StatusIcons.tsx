/** Icon trạng thái dùng ở Toast (chunk chính) – cùng khuôn với TempIcons. Trang trí (aria-hidden). */
import { tempIconBase, type TempIconProps as P } from './iconBase';

/** Vòng tròn có dấu tick – gợi ý kiểm tra. */
export const CheckCircleIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
  </svg>
);

/** Dấu ×. */
export const CloseIcon = ({ size = 12, ...p }: P) => (
  <svg {...tempIconBase(size, { ...p, strokeWidth: 1.8 })}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** Vòng tròn có dấu chấm than – cảnh báo liên quan (warning/danger theo màu chữ). */
export const AlertCircleIcon = ({ size = 16, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);

/** Thông tin (chữ i trong vòng tròn) – nhãn có định nghĩa (KpiCard `hint`). */
export const InfoIcon = ({ size = 14, ...p }: P) => (
  <svg {...tempIconBase(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </svg>
);
