import { useId } from 'react';
import { cn } from '@/lib/cn';
import { useRovingFocus } from '@/lib/useRovingFocus';
import { Badge, type CountTone } from '../Badge';

export type TabItem = {
  id: string;
  label: string;
  /** Số lượng hiển thị cạnh label (chip 18px – 70:5556). undefined → ẩn. */
  count?: number;
  /** neutral (mặc định), info ("Đang thực hiện"), danger ("Quá hạn"). */
  countTone?: CountTone;
  /** Số tối đa trước khi thành "99+" (mặc định 99; màn Báo cáo hiện đủ "176"). */
  countMax?: number;
  disabled?: boolean;
};

export type TabsProps = {
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** aria-label của tablist. */
  label: string;
  /** id của panel mà tab điều khiển, để gắn aria-controls. Mặc định không gắn. */
  panelId?: string;
  className?: string;
};

/**
 * Tabs gạch chân – "Tất cả / Chưa xác nhận / Đang xử lý / Đã hoàn thành" (Figma 70:3006, 70:5311).
 * ←/→/Home/End vừa di chuyển vừa chọn (automatic activation).
 */
export function Tabs({ items, value, onChange, label, panelId, className }: TabsProps) {
  const { setRef, onKeyDown, getTabIndex } = useRovingFocus({ items, value, onChange });
  const uid = useId();

  return (
    <div role="tablist" aria-label={label} className={cn('flex items-start border-b border-line/30 bg-surface-raised px-2 pb-px', className)}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={setRef(item.id)}
            type="button"
            role="tab"
            id={`${uid}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            disabled={item.disabled}
            tabIndex={getTabIndex(item.id)}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, item.id)}
            className={cn(
              '-mb-px flex items-center gap-1 whitespace-nowrap border-b-2 px-4 pb-3.5 pt-3 text-base transition-colors disabled:opacity-50',
              selected ? 'border-info text-info' : 'border-transparent text-fg-secondary hover:text-fg',
            )}
          >
            {item.label}
            {item.count !== undefined && <Badge variant="count" value={item.count} tone={item.countTone} max={item.countMax} />}
          </button>
        );
      })}
    </div>
  );
}
