import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Checkbox } from '../Checkbox';
import { Icon } from '../Icon';
import { Pagination } from '../Pagination';

export type ColumnAlign = 'start' | 'center' | 'end';

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  /** Nội dung ô. Bỏ trống → hiển thị `row[id]`. */
  cell?: (row: T) => ReactNode;
  /** Độ rộng cột (px hoặc CSS). Bỏ trống → co giãn. */
  width?: number | string;
  /** Mặc định "center" như Figma 70:3034 (trừ cột nội dung dùng "start"). */
  align?: ColumnAlign;
  /** Class thêm cho ô thân (màu chữ, cắt dòng…). */
  className?: string;
};

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Câu tóm tắt; mặc định "Hiển thị {from}-{to} của {total} mục". */
  summary?: (from: number, to: number, total: number) => ReactNode;
};

export type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** aria-label của bảng. */
  label: string;

  /** Bật cột checkbox. Controlled: `selectedIds` + `onSelectionChange`. */
  selectable?: boolean;
  selectedIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;

  /** Nội dung cột "Thao tác" cuối hàng. Bỏ trống → không có cột. */
  rowActions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;

  /** Hiển thị khi `rows` rỗng. */
  emptyState?: ReactNode;
  /** comfortable = hàng cao 76px (Figma), compact = 48px. */
  density?: 'comfortable' | 'compact';
  /** Giới hạn chiều cao vùng cuộn để header dính (sticky). */
  maxHeight?: number | string;
  pagination?: DataTablePagination;
  className?: string;
};

const alignClass: Record<ColumnAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

/**
 * Bảng dữ liệu (Figma 70:3032 – bảng cảnh báo; 70:5337 – bảng bảo trì).
 * Header nền surface-raised, chữ 11px semibold; hàng cao 76px, chữ 12px; đường kẻ line/20.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  label,
  selectable,
  selectedIds = [],
  onSelectionChange,
  rowActions,
  actionsHeader = 'Thao tác',
  emptyState = 'Không có dữ liệu',
  density = 'comfortable',
  maxHeight,
  pagination,
  className,
}: DataTableProps<T>) {
  const ids = rows.map(getRowId);
  const selected = new Set(selectedIds);
  const selectedOnPage = ids.filter((id) => selected.has(id)).length;
  const allSelected = ids.length > 0 && selectedOnPage === ids.length;
  const someSelected = selectedOnPage > 0 && !allSelected;
  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  const toggleAll = (on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onSelectionChange?.([...next]);
  };
  const toggleOne = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelectionChange?.([...next]);
  };

  const th = 'sticky top-0 z-[1] bg-surface-raised px-3 py-3 text-xs font-semibold tracking-label text-fg-secondary';
  const rowH = density === 'comfortable' ? 'h-[76px]' : 'h-12';

  const from = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-auto" style={{ maxHeight }}>
        <table aria-label={label} className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line/30">
              {selectable && (
                <th scope="col" className={cn(th, 'w-14 pl-7 text-left')}>
                  <Checkbox
                    label={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={ids.length === 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(th, 'whitespace-nowrap', alignClass[col.align ?? 'center'])}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className={cn(th, 'w-[71px] whitespace-nowrap pr-4 text-center')}>
                  {actionsHeader}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center text-base text-fg-muted/60">
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                const isSel = selected.has(id);
                return (
                  <tr
                    key={id}
                    aria-selected={selectable ? isSel : undefined}
                    className={cn(
                      rowH,
                      'border-b border-line/20 transition-colors last:border-b-0',
                      isSel ? 'bg-info/5' : 'hover:bg-surface-muted/10',
                    )}
                  >
                    {selectable && (
                      <td className="pl-7 pr-3">
                        <Checkbox label={`Chọn hàng ${id}`} checked={isSel} onChange={(on) => toggleOne(id, on)} />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn('px-3 text-fg-secondary', alignClass[col.align ?? 'center'], col.className)}
                      >
                        {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.id] ?? '')}
                      </td>
                    ))}
                    {rowActions && <td className="pr-4 text-center">{rowActions(row)}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/30 bg-surface-raised px-4 py-3">
          <span className="text-md text-fg-secondary">
            {pagination.summary
              ? pagination.summary(from, to, pagination.total)
              : `Hiển thị ${from}-${to} của ${pagination.total} mục`}
          </span>
          <Pagination
            page={pagination.page}
            pageCount={Math.ceil(pagination.total / pagination.pageSize)}
            onPageChange={pagination.onPageChange}
          />
        </div>
      )}
    </div>
  );
}

/** Nút icon cuối hàng (mặc định icon "eye" – Figma 70:3082). */
export function TableActionButton({
  label,
  onClick,
  icon = 'eye',
}: {
  label: string;
  onClick?: () => void;
  icon?: 'eye';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex rounded-sm p-1 opacity-90 transition-opacity hover:opacity-100"
    >
      <Icon name={icon} box={18} />
    </button>
  );
}
