import type { IconName } from '@/assets/digital-twin';
import type { KpiSubTone, KpiTone, KpiVariant } from '@/components';

/**
 * Dạng dữ liệu KPI thuần (serializable, giống payload API) – trang/playground map sang <KpiCard>.
 * Icon khai báo bằng tên, không phải ReactNode, để mock có thể thay bằng JSON.
 */
export type KpiMock = {
  id: string;
  label: string;
  icon?: IconName;
  iconBox?: 16 | 18 | 24;
  iconPosition?: 'start' | 'end';
  value: string;
  unit?: string;
  sub?: string;
  subTone?: KpiSubTone;
  subIcon?: IconName;
  subDim?: boolean;
  variant?: KpiVariant;
  tone?: KpiTone;
  toneLabel?: boolean;
  outlined?: boolean;
  strongBorder?: boolean;
  /** Giá trị ProgressBar (0–100) cho variant with-progress. */
  progress?: number;
  progressTone?: 'success' | 'info';
  /** Nhãn link cuối thẻ. */
  action?: string;
  /** Lấy giá trị từ số liệu trực tiếp (thay `value`); không có → giá trị tĩnh. */
  live?: LiveBinding;
};

/**
 * Gắn một ô hiển thị với tag trực tiếp. `transform: 'tank-volume'` = tag mức theo chiều cao (%) → % thể tích bồn
 * trụ nằm (features/tank/volume). `digits` = số lẻ (định dạng en-US như Figma: 152,340 · 76.02).
 */
export type LiveBinding = { tag: string; digits?: number; transform?: 'tank-volume' };
