import { cn } from '@/lib/cn';
import { AlertTriangleIcon, ShieldAlertIcon } from '../../Icon';

export type EmergencyBannerProps = {
  title: string;
  text: string;
  /**
   * Khoá mức (vd 'before-esd' / 'after-esd'). Trình đọc màn hình chỉ được báo khi banner MỚI xuất hiện hoặc `stage` đổi:
   * vùng `role="alert"` (ẩn) remount theo `stage`; số live đổi mỗi 2 s không làm đọc lại (chữ không chứa số live).
   * Bỏ trống = banner TĨNH (thông báo cố định của trang, vd "Chế độ mô phỏng"): không `role="alert"`, đọc như nội dung thường.
   */
  stage?: string;
  /** danger (mặc định – ESD) · warning (khung + nền vàng nhạt, icon tam giác – "Chế độ mô phỏng", ảnh AI mô phỏng sự cố). */
  tone?: 'danger' | 'warning';
  className?: string;
};

const TONE = {
  danger: { box: 'border-danger/60 bg-danger/10', text: 'text-danger-text' },
  warning: { box: 'border-warning/60 bg-warning/10', text: 'text-warning' },
} as const;

/**
 * Banner không đóng được – "Quy trình Khẩn cấp (ESD)" ở drawer cảnh báo gas (ảnh): khung viền + nền nhạt theo
 * tone, icon, tiêu đề đậm + câu hướng dẫn. Có `stage`: phần nhìn thấy `aria-hidden`, nội dung cho trình đọc nằm trong
 * `role="alert"` (một bản, không lặp).
 */
export function EmergencyBanner({ title, text, stage, tone = 'danger', className }: EmergencyBannerProps) {
  const t = TONE[tone];
  const live = stage !== undefined;
  return (
    <div className={cn('rounded-md border px-4 py-3.5', t.box, className)}>
      {live && (
        <div key={stage} role="alert" className="sr-only">
          {`${title}. ${text}`}
        </div>
      )}
      <div aria-hidden={live ? true : undefined} className="flex items-start gap-3">
        {tone === 'danger' ? (
          // eslint-disable-next-line no-restricted-syntax -- icon
          <ShieldAlertIcon size={24} className="mt-0.5 shrink-0 text-danger-strong" />
        ) : (
          <AlertTriangleIcon size={24} className="mt-0.5 shrink-0 text-warning" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cn('text-md font-semibold', t.text)}>{title}</p>
          <p className={cn('text-base', t.text)}>{text}</p>
        </div>
      </div>
    </div>
  );
}
