import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { SearchInput } from '../SearchInput';
import { Select, type SelectOption } from '../Select';

export type FilterDef = {
  id: string;
  label: string;
  options: readonly SelectOption[];
  /** Thêm lựa chọn "tất cả" (null), ví dụ "Tất cả khu vực". */
  allLabel?: string;
};

export type FilterValues = Record<string, string | null>;

export type FilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: readonly FilterDef[];
  /** Giá trị đang chọn của từng filter theo `id`; thiếu key = null. */
  values: FilterValues;
  onValuesChange: (values: FilterValues) => void;
  /** Nút lọc nâng cao (70:3028). Bỏ trống → ẩn nút. */
  onAdvancedFilter?: () => void;
  /** Đánh dấu nút lọc nâng cao đang bật. */
  advancedActive?: boolean;
  /** aria-label của nút icon (mặc định "Bộ lọc nâng cao"); ví dụ "Xoá bộ lọc" khi dùng làm nút reset. */
  advancedLabel?: string;
  /** Nội dung chèn thêm bên phải, sau các Select. */
  extra?: ReactNode;
  className?: string;
};

/**
 * Thanh lọc phía trên bảng – SearchInput + nhiều Select + nút lọc (Figma 70:3015, 70:5320).
 * Hoàn toàn controlled: trạng thái nằm ở component cha.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm sự kiện, mã thiết bị...',
  filters,
  values,
  onValuesChange,
  onAdvancedFilter,
  advancedActive,
  advancedLabel = "Bộ lọc nâng cao",
  extra,
  className,
}: FilterBarProps) {
  return (
    <div
      role="search"
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line/20 bg-surface-muted/10 px-4 pb-[13px] pt-3',
        className,
      )}
    >
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        className="w-full max-w-[567px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Select
            key={f.id}
            label={f.label}
            options={f.options}
            allLabel={f.allLabel}
            value={values[f.id] ?? null}
            onChange={(v) => onValuesChange({ ...values, [f.id]: v })}
            align="end"
          />
        ))}
        {extra}
        {onAdvancedFilter && (
          <Button
            variant="toolbar"
            aria-label={advancedLabel}
            title={advancedLabel}
            pressed={advancedActive}
            onClick={onAdvancedFilter}
            icon={<Icon name="filter" box={16} />}
          />
        )}
      </div>
    </div>
  );
}
