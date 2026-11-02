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
  /** Ô chèn ngay sau ô tìm kiếm (vd ô chọn ngày – màn Báo cáo). */
  leading?: ReactNode;
  /** Nội dung chèn thêm bên phải, sau các Select. */
  extra?: ReactNode;
  /** Link chữ "Xóa bộ lọc" cuối hàng (màn Báo cáo). Bỏ trống → ẩn. Tắt (`clearDisabled`) khi không có bộ lọc nào. */
  onClear?: () => void;
  clearLabel?: string;
  clearDisabled?: boolean;
  /**
   * - split (mặc định): tìm kiếm bên trái, bộ lọc dồn phải (Cảnh báo 70:3015, Bảo trì 70:5320)
   * - inline: mọi ô xếp liền từ trái, ô tìm kiếm hẹp (~255px), ô lọc chưa chọn chỉ hiện nhãn – thanh lọc màn Báo cáo
   *   (ảnh thiết kế)
   */
  layout?: 'split' | 'inline';
  /** Thanh lọc đứng riêng (không có bảng ngay dưới – danh sách thẻ kịch bản AI mô phỏng): bỏ vạch kẻ dưới. */
  standalone?: boolean;
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
  advancedLabel = 'Bộ lọc nâng cao',
  leading,
  extra,
  onClear,
  clearLabel = 'Xóa bộ lọc',
  clearDisabled,
  layout = 'split',
  standalone,
  className,
}: FilterBarProps) {
  const inline = layout === 'inline';
  return (
    <div
      role="search"
      className={cn(
        'flex flex-wrap bg-surface-muted/10 px-4 pb-[13px] pt-3',
        !standalone && 'border-b border-line/20',
        inline ? 'items-center gap-2' : 'items-start justify-between gap-3',
        className,
      )}
    >
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        className={inline ? 'w-full sm:w-[255px]' : 'w-full max-w-[567px]'}
      />
      {leading}
      <div className={cn('flex flex-wrap items-center gap-2', inline && 'contents')}>
        {filters.map((f) => (
          <Select
            key={f.id}
            label={f.label}
            options={f.options}
            allLabel={f.allLabel}
            hideAllInTrigger={inline}
            value={values[f.id] ?? null}
            onChange={(v) => onValuesChange({ ...values, [f.id]: v })}
            align={inline ? 'start' : 'end'}
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
        {onClear && (
          <Button variant="link" size="lg" onClick={onClear} disabled={clearDisabled} className="px-1">
            {clearLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
