import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '../../Button';
import { Select, type SelectOption } from '../../Select';
import { Switch } from '../../Switch';

/** Icon bộ lọc 3 vạch (ảnh phân công cảnh báo – nút vuông cạnh ô tìm kiếm). */
const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h16M7 12h10M10 17h4" />
  </svg>
);

export type StaffFiltersProps<D extends string, S extends string> = {
  /** Ô tìm kiếm (SearchInput) – đặt cùng hàng, nút lọc bên phải. */
  search: ReactNode;
  departments: readonly SelectOption<D>[];
  department: D | null;
  onDepartmentChange: (v: D | null) => void;
  shifts: readonly SelectOption<S>[];
  shift: S | null;
  onShiftChange: (v: S | null) => void;
  /** "Chỉ người trong ca" (theo giờ hiện tại). */
  onShiftOnly: boolean;
  onShiftOnlyChange: (v: boolean) => void;
  className?: string;
};

/**
 * Hàng tìm kiếm + nút lọc nhân sự (modal phân công cảnh báo; ảnh chỉ có nút icon – vùng lọc chưa có thiết kế, dựng theo token).
 * Nút = disclosure (`aria-expanded` + `aria-controls`), tên đọc kèm số bộ lọc đang bật; vùng lọc mở ngay dưới, không phải
 * popup nên không cần bẫy focus: phòng ban · ca · công tắc "Chỉ người trong ca".
 */
export function StaffFilters<D extends string, S extends string>({
  search,
  departments,
  department,
  onDepartmentChange,
  shifts,
  shift,
  onShiftChange,
  onShiftOnly,
  onShiftOnlyChange,
  className,
}: StaffFiltersProps<D, S>) {
  const uid = useId();
  const active = Number(!!department) + Number(!!shift) + Number(onShiftOnly);
  const [open, setOpen] = useState(active > 0);
  const panelId = `${uid}-panel`;
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">{search}</div>
        <Button
          variant="toolbar"
          className={cn('relative h-auto min-h-9 px-3', (open || active > 0) && 'border-primary/60 text-primary')}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Bộ lọc nhân sự${active ? ` (${active} đang bật)` : ''}`}
          onClick={() => setOpen((o) => !o)}
          icon={
            <>
              <FilterIcon />
              {active > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-primary text-2xs font-semibold text-fg-inverse"
                >
                  {active}
                </span>
              )}
            </>
          }
        />
      </div>
      <div id={panelId} hidden={!open} className="rounded-md border border-line/30 bg-surface-sunken/40 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <span id={`${uid}-dept`} className="sr-only">
            Lọc phòng ban
          </span>
          <span id={`${uid}-shift`} className="sr-only">
            Lọc ca
          </span>
          <Select
            variant="field"
            labelledBy={`${uid}-dept`}
            label="Lọc phòng ban"
            placeholder="Tất cả phòng ban"
            allLabel="Tất cả phòng ban"
            options={departments}
            value={department}
            onChange={onDepartmentChange}
          />
          <Select
            variant="field"
            labelledBy={`${uid}-shift`}
            label="Lọc ca"
            placeholder="Tất cả ca"
            allLabel="Tất cả ca"
            options={shifts}
            value={shift}
            onChange={onShiftChange}
          />
        </div>
        <Switch className="mt-3" label="Chỉ người đang trong ca" checked={onShiftOnly} onChange={onShiftOnlyChange} />
      </div>
    </div>
  );
}
