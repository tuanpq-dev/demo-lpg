import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useRovingFocus } from '@/lib/useRovingFocus';
import { Avatar } from '../../Avatar';
import { Badge } from '../../Badge';
import { AVAILABILITY_LABEL, type Availability } from './availability';

export type StaffPickerItem = {
  /** Khoá + giá trị chọn (hiện là tên nhân sự). */
  id: string;
  name: string;
  /** "Cơ khí • Chuyên gia Van/Bồn". */
  subtitle: string;
  /** "Ca 2". */
  shiftLabel: string;
  /** Ca của người này khớp ca đang chọn → chip xanh. */
  shiftMatch?: boolean;
  busy: boolean;
  /** "1 đang làm" / "3 đang làm" (phần quá hạn tách riêng `overdue`). */
  active: number;
  overdue: number;
  /** Giải thích cách tính số việc (tooltip + đọc kèm). */
  workloadHint?: string;
  /** compact: một chip phụ bên phải (vd "2 cảnh báo đang xử lý"); thay cho hàng chip ca/Bận/số việc. */
  meta?: string;
  /**
   * Trạng thái có xét ca (modal phân công cảnh báo): Sẵn sàng (xanh) / Bận (vàng) / Ngoài ca (thẻ viền đứt, chữ phụ – VẪN chọn
   * được). Không truyền (modal bảo trì) → chip Sẵn sàng/Bận theo `busy` như cũ.
   */
  availability?: Availability;
  /** Chữ chip tải việc thay "x đang làm (y quá hạn)" – vd "3 cảnh báo đang xử lý (1 nghiêm trọng)". `overdue` > 0 vẫn tô danger. */
  loadLabel?: string;
  /** Chip gợi ý ("Cùng khu · Đúng chuyên môn") – người được đưa lên đầu danh sách. */
  suggestion?: string;
};

export type StaffPickerCardProps = {
  item: StaffPickerItem;
  checked: boolean;
  tabIndex?: number;
  onSelect?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef?: (el: HTMLElement | null) => void;
  /** Gọn: avatar 32px, tên + "chức danh • phòng ban" một dòng, chip `meta` (phân công cảnh báo). */
  compact?: boolean;
};

/** Icon cặp hồ sơ nhỏ trong chip "đang làm" (trang trí). */
const BriefcaseIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

/** Icon chip trạng thái (trang trí, theo ảnh phân công cảnh báo). */
const CheckCircleIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" />
  </svg>
);
const MoonIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);
const AVAILABILITY_CHIP: Record<Availability, { tone: 'success' | 'warning' | 'neutral'; icon: ReactNode }> = {
  available: { tone: 'success', icon: <CheckCircleIcon /> },
  busy: { tone: 'warning', icon: <BriefcaseIcon /> },
  'off-shift': { tone: 'neutral', icon: <MoonIcon /> },
};

/**
 * Thẻ nhân sự trong modal "Phân công người xử lý" (ảnh thiết kế, chưa có node): avatar chữ cái đầu 40px, tên 16px đậm,
 * "phòng ban • chuyên môn" 12px, hàng chip: ca (khớp ca đang chọn = xanh) · Sẵn sàng / Bận (warning) · "x đang làm (y quá hạn)"
 * (có quá hạn → chip danger).
 * `role="radio"` trong `StaffList` (radiogroup). Được chọn = viền primary + nền primary/10.
 */
function StaffPickerCard({ item, checked, tabIndex, onSelect, onKeyDown, buttonRef, compact }: StaffPickerCardProps) {
  const descId = useId();
  if (compact) {
    return (
      <button
        ref={buttonRef}
        type="button"
        role="radio"
        aria-checked={checked}
        aria-describedby={descId}
        tabIndex={tabIndex}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        className={cn(
          'flex w-full min-w-0 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
          checked ? 'border-primary bg-primary/10' : 'border-line/30 bg-surface-sunken/30 hover:border-line',
        )}
      >
        <Avatar name={item.name} size="md" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-semibold text-fg">{item.name}</span>
          <span id={descId} className="truncate text-sm text-fg-secondary">
            {item.subtitle}
            {item.meta && <span className="sr-only">. {item.meta}</span>}
          </span>
        </span>
        {item.meta && (
          <span aria-hidden="true" className="shrink-0">
            <Badge variant="tag" tone="neutral">
              {item.meta}
            </Badge>
          </span>
        )}
      </button>
    );
  }
  const offShift = item.availability === 'off-shift';
  const avail = item.availability ? AVAILABILITY_CHIP[item.availability] : null;
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-describedby={descId}
      tabIndex={tabIndex}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'flex w-full min-w-0 items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors',
        checked
          ? 'border-primary bg-primary/10'
          : // Ngoài ca: "mờ" bằng viền đứt + nền trong + tên chữ phụ – KHÔNG dùng opacity (giữ tương phản AA).
            offShift
            ? 'border-dashed border-line/30 bg-transparent hover:border-line'
            : 'border-line/30 bg-surface-sunken/30 hover:border-line',
      )}
    >
      <Avatar name={item.name} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('truncate text-md font-semibold', offShift && !checked ? 'text-fg-secondary' : 'text-fg')}>{item.name}</span>
          {item.suggestion && (
            <span className="shrink-0">
              <Badge variant="tag" tone="primary">
                {item.suggestion}
              </Badge>
            </span>
          )}
        </span>
        <span className="truncate text-sm text-fg-secondary">{item.subtitle}</span>
        <span id={descId} className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="sr-only">{item.subtitle}. </span>
          {avail ? (
            <>
              <Badge variant="tag" tone={avail.tone}>
                {avail.icon}
                <span className="ml-1">{AVAILABILITY_LABEL[item.availability!]}</span>
              </Badge>
              <Badge variant="tag" tone={item.shiftMatch ? 'success' : 'neutral'}>
                {item.shiftLabel}
              </Badge>
            </>
          ) : (
            <>
              <Badge variant="tag" tone={item.shiftMatch ? 'success' : 'neutral'}>
                {item.shiftLabel}
              </Badge>
              <Badge variant="tag" tone={item.busy ? 'warning' : 'neutral'}>
                {AVAILABILITY_LABEL[item.busy ? 'busy' : 'available']}
              </Badge>
            </>
          )}
          {/* Lót nền đặc: chip trong mờ không bị trộn với nền primary/10 của thẻ đang chọn (giữ tương phản chữ đỏ ≥ 4.5:1). */}
          <span title={item.workloadHint} className="rounded-sm bg-surface">
            {/* Có việc quá hạn → cả chip tone danger (chữ danger-text trên nền đỏ nhạt – đủ tương phản; ảnh: chip viền đỏ). */}
            <Badge variant="tag" tone={item.overdue > 0 ? 'danger' : 'neutral'}>
              <BriefcaseIcon />
              <span className="ml-1">{item.loadLabel ?? `${item.active} đang làm${item.overdue > 0 ? ` (${item.overdue} quá hạn)` : ''}`}</span>
            </Badge>
          </span>
          {item.workloadHint && <span className="sr-only">. {item.workloadHint}</span>}
        </span>
      </span>
    </button>
  );
}

export type StaffListProps = {
  /** Tên nhóm (radiogroup). */
  label: string;
  labelledBy?: string;
  items: readonly StaffPickerItem[];
  /** null = chưa chọn ai (Tab vào mục đầu tiên, chưa chọn). */
  value: string | null;
  onChange: (id: string) => void;
  /** Hiện khi `items` rỗng (sau khi lọc). */
  emptyState?: ReactNode;
  /** Thẻ gọn (`StaffPickerCard compact`) – phân công cảnh báo. */
  compact?: boolean;
  className?: string;
};

/**
 * Danh sách nhân sự = `role="radiogroup"` dọc: ↑/↓ chuyển + chọn, Home/End, Space/Enter chọn (useRovingFocus auto).
 * KHÔNG chọn sẵn: chưa chọn thì Tab vào mục đầu tiên mà không chọn.
 */
export function StaffList({ label, labelledBy, items, value, onChange, emptyState, compact, className }: StaffListProps) {
  const roving = useRovingFocus({ items, value: value ?? '', onChange, orientation: 'vertical' });
  if (!items.length) {
    return (
      <div className={cn('rounded-md border border-dashed border-line/30 px-4 py-8 text-center text-base text-fg-secondary', className)}>
        {emptyState ?? 'Không có nhân sự phù hợp.'}
      </div>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3', className)}
    >
      {items.map((it) => (
        <StaffPickerCard
          key={it.id}
          item={it}
          compact={compact}
          checked={it.id === value}
          tabIndex={roving.getTabIndex(it.id)}
          buttonRef={roving.setRef(it.id)}
          onSelect={() => onChange(it.id)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onChange(it.id);
              return;
            }
            roving.onKeyDown(e, it.id);
          }}
        />
      ))}
    </div>
  );
}
