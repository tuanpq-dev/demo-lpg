import { cn } from '@/lib/cn';
import { ShieldAlertIcon } from '../Icon';

export type EmergencyBannerProps = {
  title: string;
  text: string;
  /**
   * Khoá mức (vd 'before-esd' / 'after-esd'). Trình đọc màn hình chỉ được báo khi banner MỚI xuất hiện hoặc `stage` đổi:
   * vùng `role="alert"` (ẩn) remount theo `stage`; số live đổi mỗi 2 s không làm đọc lại (chữ không chứa số live).
   */
  stage: string;
  className?: string;
};

/**
 * Banner khẩn cấp không đóng được – "Quy trình Khẩn cấp (ESD)" ở drawer cảnh báo gas (ảnh 27/10/2026): khung viền + nền
 * danger nhạt, icon khiên, tiêu đề đậm + câu hướng dẫn chữ `danger-text`. Phần nhìn thấy `aria-hidden`; nội dung cho trình
 * đọc nằm trong `role="alert"` (một bản, không lặp).
 */
export function EmergencyBanner({ title, text, stage, className }: EmergencyBannerProps) {
  return (
    <div className={cn('rounded-md border border-danger/60 bg-danger/10 px-4 py-3.5', className)}>
      <div key={stage} role="alert" className="sr-only">
        {`${title}. ${text}`}
      </div>
      <div aria-hidden="true" className="flex items-start gap-3">
        {/* eslint-disable-next-line no-restricted-syntax -- icon */}
        <ShieldAlertIcon size={24} className="mt-0.5 shrink-0 text-danger-strong" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-md font-semibold text-danger-text">{title}</p>
          <p className="text-base text-danger-text">{text}</p>
        </div>
      </div>
    </div>
  );
}
