import { useId, useState, type ReactNode } from 'react';
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
  /** Class thêm cho ô thân (màu chữ, cắt dòng…); hàm → theo từng dòng (vd nền ô "thiếu dữ liệu"). */
  className?: string | ((row: T) => string | undefined);
};

/** Nhóm của một dòng – dòng liền nhau cùng `id` chung một dòng tiêu đề nhóm. */
export type DataTableGroup = { id: string; label: ReactNode };

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Câu tóm tắt; mặc định "Hiển thị {from}-{to} của {total} mục". */
  summary?: (from: number, to: number, total: number) => ReactNode;
  /** Ô chọn số dòng mỗi trang ("Rows per page" – màn Báo cáo). Cần cả `onPageSizeChange`. */
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
};

export type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** Tên bảng – thành <caption> ẩn (tên truy cập). */
  label: string;

  /** Bật cột checkbox. Controlled: `selectedIds` + `onSelectionChange`. */
  selectable?: boolean;
  selectedIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;

  /** Nội dung cột "Thao tác" cuối hàng. Bỏ trống → không có cột. */
  rowActions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;
  /**
   * Bấm vào vùng trống của hàng (chuột) → mở bản ghi. Bỏ qua khi bấm vào nút/link/ô chọn trong hàng.
   * Chỉ là tiện ích chuột: bàn phím dùng nút trong hàng (cột mã / "Xem chi tiết") – hàng không nhận focus.
   */
  onRowClick?: (row: T) => void;

  /** Hiển thị khi `rows` rỗng. */
  emptyState?: ReactNode;
  /**
   * comfortable = hàng cao 76px (Figma), compact = 48px, dense = tối thiểu 38px + đệm dọc 8px (bảng số liệu báo cáo ngày
   * 117:4609 – dòng có ghi chú tự cao hơn).
   */
  density?: 'comfortable' | 'compact' | 'dense';
  /**
   * Gom dòng theo nhóm (dòng phải xếp sẵn theo nhóm): mỗi nhóm có một dòng tiêu đề trải hết bảng, nút ▾ thu gọn/mở
   * (`aria-expanded`) – Figma 117:4603 "Bồn chứa LPG – V-101".
   */
  groupBy?: (row: T) => DataTableGroup;
  /** Kẻ dọc giữa các ô (bảng lưới số liệu – Figma 117:4609). */
  gridLines?: boolean;
  /** Chữ tiêu đề cột: label = 11px đậm (mặc định, Figma) · plain = 14px thường (bảng tham chiếu màn cấu hình kịch bản). */
  headerStyle?: 'label' | 'plain';
  /** Giới hạn chiều cao vùng cuộn để header dính (sticky). */
  maxHeight?: number | string;
  pagination?: DataTablePagination;
  /**
   * Bề rộng tối thiểu (px) của bảng: khung hẹp hơn → cuộn ngang TRONG khung (trang không tràn), cột không bị ép gãy chữ.
   */
  minWidth?: number;
  /** Cố định ô chọn + cột dữ liệu đầu tiên (mã) khi cuộn ngang. */
  stickyFirst?: boolean;
  /** Cố định cột thao tác ở mép phải khi cuộn ngang (luôn mở được chi tiết). */
  stickyActions?: boolean;
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
  onRowClick,
  actionsHeader = 'Thao tác',
  emptyState = 'Không có dữ liệu',
  density = 'comfortable',
  maxHeight,
  pagination,
  minWidth,
  stickyFirst,
  stickyActions,
  groupBy,
  gridLines,
  headerStyle = 'label',
  className,
}: DataTableProps<T>) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = (id: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const grid = gridLines && 'border-r border-line/30 last:border-r-0';
  const th = cn(
    'sticky top-0 z-[1] bg-surface-raised px-3 py-3 text-fg-secondary',
    headerStyle === 'plain' ? 'text-base font-normal' : 'text-xs font-semibold tracking-label',
    grid,
  );
  /** Cột đầu cố định: nằm sau ô chọn (w-14 = 56px). */
  const firstLeft = cn('z-[3]', selectable ? 'left-14' : 'left-0');
  const rowH = density === 'comfortable' ? 'h-[76px]' : density === 'compact' ? 'h-12' : 'h-[38px]';
  const cellPadY = density === 'dense' && 'py-2';

  const from = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const to = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : 0;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          {/* caption = tên truy cập của bảng (ẩn hiển thị). */}
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="border-b border-line/30">
              {selectable && (
                <th scope="col" className={cn(th, 'w-14 pl-7 text-left', stickyFirst && 'left-0 z-[3]')}>
                  <Checkbox
                    label={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={ids.length === 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col, i) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(th, 'whitespace-nowrap', alignClass[col.align ?? 'center'], stickyFirst && i === 0 && firstLeft)}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className={cn(th, 'w-[71px] whitespace-nowrap pr-4 text-center', stickyActions && 'right-0 z-[3]')}>
                  {actionsHeader}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center text-base text-fg-muted/65">
                  {emptyState}
                </td>
              </tr>
            ) : (
              // Dòng nhóm có key riêng, ổn định khi thu gọn/mở → nút không bị gắn lại (giữ focus bàn phím).
              rows.flatMap((row, rowIndex) => {
                const id = getRowId(row);
                const isSel = selected.has(id);
                const group = groupBy?.(row);
                const groupStart = !!group && (rowIndex === 0 || groupBy!(rows[rowIndex - 1]!).id !== group.id);
                const groupOpen = !group || !collapsed.has(group.id);
                const groupRow = group && groupStart && (
                  <tr key={`group-${group.id}`} className="border-y border-line/30 bg-bg-app">
                    <th scope="colgroup" colSpan={colCount} className="px-3 py-1.5 text-left font-normal">
                      {/* Nút dính mép trái để tên nhóm không trôi mất khi cuộn ngang. */}
                      <button
                        type="button"
                        aria-expanded={groupOpen}
                        onClick={() => toggleGroup(group.id)}
                        className="sticky left-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold leading-[18px] text-primary"
                      >
                        <Icon
                          name="tableGroupChevron"
                          box={14}
                          className={cn('transition-transform motion-reduce:transition-none', !groupOpen && '-rotate-90')}
                        />
                        {group.label}
                      </button>
                    </th>
                  </tr>
                );
                const out = groupRow ? [groupRow] : [];
                if (!groupOpen) return out;
                return [
                  ...out,
                  <tr
                    key={id}
                    aria-selected={selectable ? isSel : undefined}
                    onClick={
                      onRowClick
                        ? (e) => {
                            if ((e.target as HTMLElement).closest('button, a, input, label, select, textarea')) return;
                            onRowClick(row);
                          }
                        : undefined
                    }
                    className={cn(
                      rowH,
                      onRowClick && 'cursor-pointer',
                      'border-b border-line/20 transition-colors last:border-b-0',
                      isSel ? 'bg-info/5' : 'hover:bg-surface-muted/10',
                    )}
                  >
                    {selectable && (
                      <td className={cn('pl-7 pr-3', stickyFirst && 'sticky left-0 z-[1] bg-surface')}>
                        <Checkbox label={`Chọn hàng ${id}`} checked={isSel} onChange={(on) => toggleOne(id, on)} />
                      </td>
                    )}
                    {columns.map((col, i) => (
                      <td
                        key={col.id}
                        className={cn(
                          'px-3 text-fg-secondary',
                          cellPadY,
                          grid,
                          alignClass[col.align ?? 'center'],
                          typeof col.className === 'function' ? col.className(row) : col.className,
                          stickyFirst && i === 0 && cn('sticky z-[1] bg-surface', selectable ? 'left-14' : 'left-0'),
                        )}
                      >
                        {col.cell ? col.cell(row) : String((row as Record<string, unknown>)[col.id] ?? '')}
                      </td>
                    ))}
                    {rowActions && <td className={cn('pr-4 text-center', stickyActions && 'sticky right-0 z-[1] bg-surface')}>{rowActions(row)}</td>}
                  </tr>,
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/30 bg-surface-raised px-4 py-3">
          <span className="text-md text-fg-secondary">
            {pagination.summary ? pagination.summary(from, to, pagination.total) : `Hiển thị ${from}-${to} của ${pagination.total} mục`}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            {pagination.pageSizeOptions && pagination.onPageSizeChange && (
              <PageSizeSelect value={pagination.pageSize} options={pagination.pageSizeOptions} onChange={pagination.onPageSizeChange} />
            )}
            <Pagination page={pagination.page} pageCount={Math.ceil(pagination.total / pagination.pageSize)} onPageChange={pagination.onPageChange} />
          </div>
        </div>
      )}
    </div>
  );
}

/** "Số dòng mỗi trang" – <select> gốc (bàn phím + trình đọc màn hình sẵn có), style theo token. */
function PageSizeSelect({ value, options, onChange }: { value: number; options: readonly number[]; onChange: (size: number) => void }) {
  const id = useId();
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-fg-secondary">
        Số dòng mỗi trang
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md border border-line bg-surface-sunken px-2 text-sm text-fg [color-scheme:dark] hover:border-accent/40 focus-visible:border-accent/60 focus-visible:outline-none"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Nút icon cuối hàng (mặc định icon "eye" – Figma 70:3082). */
export function TableActionButton({ label, onClick, icon = 'eye' }: { label: string; onClick?: () => void; icon?: 'eye' }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="inline-flex rounded-sm p-1 opacity-90 transition-opacity hover:opacity-100">
      <Icon name={icon} box={18} />
    </button>
  );
}
