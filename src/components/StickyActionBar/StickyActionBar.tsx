import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Chiều cao thanh = `--action-bar-height` (tokens.css – ước lượng từ ảnh MT-00128). */
const HEIGHT = 'var(--action-bar-height)';

export type StickyActionBarProps = {
  /** Tên vùng cho trình đọc màn hình, vd "Thao tác yêu cầu MT-00128". */
  label: string;
  /** Nội dung bên trái (trạng thái, gợi ý…). */
  start?: ReactNode;
  /** Các nút bên phải. */
  children: ReactNode;
  className?: string;
};

/**
 * Thanh hành động dính đáy màn hình – ảnh MT-00128 (Fixed Footer): nền header, viền trên line/30, nút căn phải cách 16px.
 * - Chèn một khoảng đệm cùng chiều cao vào luồng trang → nội dung cuối không bị che.
 * - Đặt `scroll-padding-bottom` cho trang khi đang hiện → phần tử nhận focus bằng Tab được cuộn lên trên thanh.
 * Thanh nằm sau nội dung trong DOM nên thứ tự Tab = nội dung → thanh.
 * Nhóm nút rộng hơn màn (điện thoại) → cuộn ngang trong thanh, mặc định thấy nút CUỐI (hành động chính): khung cuộn
 * `direction: rtl` (vị trí cuộn ban đầu ở mép phải, nội dung vừa thì căn phải), hàng nút bên trong `ltr` giữ thứ tự.
 */
export function StickyActionBar({ label, start, children, className }: StickyActionBarProps) {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `calc(${HEIGHT} + 16px)`;
    return () => {
      root.style.scrollPaddingBottom = prev;
    };
  }, []);
  return (
    <>
      <div aria-hidden="true" style={{ height: HEIGHT }} />
      <div
        role="region"
        aria-label={label}
        className={cn('fixed inset-x-0 bottom-0 z-30 border-t border-line/30 bg-bg-header/95 backdrop-blur-sm', className)}
        style={{ height: HEIGHT }}
      >
        <div className="mx-auto flex h-full max-w-content items-center justify-between gap-4 px-4 sm:px-8">
          {start && <div className="min-w-0 shrink text-sm text-fg-secondary">{start}</div>}
          <div className="min-w-0 flex-1 overflow-x-auto py-1 [direction:rtl] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-center gap-2 px-0.5 [direction:ltr] sm:gap-4">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
