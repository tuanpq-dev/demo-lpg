import { cn } from '@/lib/cn';
import { AlertCircleIcon, CheckCircleIcon, CloseIcon, InfoIcon } from '../Icon/StatusIcons';

export type ToastListItem = { id: number; text: string; tone: 'info' | 'success' | 'error' };

export type ToastListProps = {
  items: readonly ToastListItem[];
  onDismiss: (id: number) => void;
  /** Tên vùng (landmark) – mặc định "Thông báo". */
  label?: string;
};

const TONE: Record<ToastListItem['tone'], { box: string; icon: string; Icon: typeof InfoIcon }> = {
  info: { box: 'border-info/40', icon: 'text-info', Icon: InfoIcon },
  success: { box: 'border-success/40', icon: 'text-success', Icon: CheckCircleIcon },
  // eslint-disable-next-line no-restricted-syntax -- icon, không phải chữ
  error: { box: 'border-danger/60', icon: 'text-danger', Icon: AlertCircleIcon },
};

/**
 * Thông báo nổi góc trên phải, dưới header (chưa có thiết kế – dựng theo token): nền `surface-raised`, viền theo loại,
 * icon + chữ 14px + nút × đóng. Dưới `sm` trải ngang (lề 16px). Không phải vùng aria-live – câu đã được đọc qua
 * `announce()` (xem `lib/toast.ts`); danh sách rỗng → không render.
 */
export function ToastList({ items, onDismiss, label = 'Thông báo' }: ToastListProps) {
  if (!items.length) return null;
  return (
    <section
      aria-label={label}
      className="pointer-events-none fixed inset-x-4 top-[calc(var(--header-height)+16px)] z-[60] flex flex-col items-stretch gap-2 sm:left-auto sm:right-6 sm:w-[360px]"
    >
      {items.map((t) => {
        const { box, icon, Icon } = TONE[t.tone];
        return (
          <div key={t.id} className={cn('pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface-raised px-4 py-3 shadow-card', box)}>
            <Icon size={18} className={cn('mt-0.5 shrink-0', icon)} />
            <p className="min-w-0 flex-1 text-base text-fg">{t.text}</p>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => onDismiss(t.id)}
              className="-mr-1 shrink-0 rounded-sm p-1 text-fg-secondary hover:text-fg"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </section>
  );
}
