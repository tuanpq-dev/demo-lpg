import { cn } from '@/lib/cn';

export type SceneLoadingProps = {
  label?: string;
  /** Đã sẵn sàng: mờ dần (250 ms, tắt khi giảm chuyển động) – giữ trong DOM để không nhảy layout. */
  hidden?: boolean;
  /** Ảnh lần vẽ trước của chính cảnh này (mở lại trong phiên) → hiện ảnh thay vòng xoay, mờ sang cảnh khi vẽ xong. */
  snapshot?: string;
  className?: string;
};

/**
 * Lớp chờ DUY NHẤT của cảnh 3D – cùng nền với canvas (`bg-app` = màu sàn cảnh) nên mọi giai đoạn tải (dữ liệu cảnh →
 * code three.js → dựng canvas → khung hình đầu) trông như một màn hình chờ liền mạch, rồi mờ sang cảnh khi đã vẽ xong
 * (không nháy ô xám → nền tối → canvas đen → cảnh). Phủ kín khối cha (`absolute inset-0`), trên nhãn 3D (z ≤ 21).
 */
export function SceneLoading({ label = 'Đang tải mô hình 3D…', hidden = false, snapshot, className }: SceneLoadingProps) {
  return (
    <div
      role={hidden ? undefined : 'status'}
      aria-hidden={hidden || undefined}
      className={cn(
        'pointer-events-none absolute inset-0 z-[25] grid place-items-center bg-bg-app transition-opacity duration-[250ms] ease-out motion-reduce:transition-none',
        hidden ? 'opacity-0' : 'opacity-100',
        className,
      )}
    >
      {snapshot && <img src={snapshot} alt="" decoding="sync" className="absolute inset-0 size-full object-cover" />}
      <span className={cn('flex flex-col items-center gap-3 text-sm text-fg-muted', snapshot && 'sr-only')}>
        <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-line/30 border-t-accent motion-reduce:animate-none" />
        {label}
      </span>
    </div>
  );
}
