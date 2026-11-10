import { cn } from '@/lib/cn';

/** "Nguyễn Văn A" → "NA" (chữ đầu họ + chữ đầu tên). */
export function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? (w[w.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

const sizeClass = { sm: 'size-6 text-2xs', md: 'size-8 text-xs', lg: 'size-10 text-sm' } as const;

/**
 * Avatar chữ cái đầu (trang trí – `aria-hidden`, tên luôn có chữ bên cạnh). Ảnh Figma vẽ ô trắng giữ chỗ → dùng chữ cái đầu
 * theo token. TODO(backend): ảnh đại diện thật khi có hồ sơ người dùng.
 * sm 24px (Combobox) · md 32px · lg 40px (thẻ nhân sự – modal Phân công).
 */
export function Avatar({ name, size = 'sm', className }: { name: string; size?: keyof typeof sizeClass; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-surface-chip font-bold text-primary',
        sizeClass[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
