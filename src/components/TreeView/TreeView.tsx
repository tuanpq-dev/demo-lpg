import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CaretIcon } from '../Icon';

export type TreeItem = {
  id: string;
  label: string;
  /** Chữ phụ bên phải nhãn (vd loại asset). */
  meta?: string;
  icon?: ReactNode;
  children?: readonly TreeItem[];
  /** Nút nhóm (false) – mở/đóng được nhưng không chọn được. Mặc định: có children → false, lá → true. */
  selectable?: boolean;
  /** Làm mờ (vd object đang ẩn). */
  dimmed?: boolean;
  /** Cho đổi tên tại chỗ (F2/double-click) – mặc định theo `onRename` có hay không. */
  renamable?: boolean;
};

export type TreeViewProps = {
  /** aria-label của cây. */
  label: string;
  items: readonly TreeItem[];
  selected: readonly string[];
  onSelectionChange: (ids: string[]) => void;
  /** Nhánh đang mở (controlled). Không truyền → tự quản lý, mặc định mở hết. */
  expanded?: readonly string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Đổi tên tại chỗ; trả về chuỗi lỗi để giữ ô nhập + báo lỗi, undefined = thành công. */
  onRename?: (id: string, next: string) => string | undefined;
  /** Nút hành động bên phải mỗi dòng (ẩn/hiện, khoá…). Nên dùng tabIndex={-1} – bàn phím đi theo cây. */
  renderActions?: (item: TreeItem) => ReactNode;
  emptyText?: string;
  className?: string;
};

type Row = { item: TreeItem; depth: number; selectable: boolean; parent?: string };

function flatten(items: readonly TreeItem[], open: ReadonlySet<string>, depth = 0, parent?: string): Row[] {
  return items.flatMap((item) => {
    const selectable = item.selectable ?? !item.children?.length;
    const row: Row = { item, depth, selectable, parent };
    return item.children?.length && open.has(item.id) ? [row, ...flatten(item.children, open, depth + 1, item.id)] : [row];
  });
}

const allGroupIds = (items: readonly TreeItem[]): string[] => items.flatMap((i) => (i.children?.length ? [i.id, ...allGroupIds(i.children)] : []));

/**
 * Cây chọn nhiều (ARIA tree, aria-multiselectable) – ⚠ Figma chưa có, style theo token (giống dòng Select/listbox).
 * Chuột: click = chọn · Ctrl/⌘+click = đảo · Shift+click = chọn dải. Bàn phím (roving tabindex): ↑/↓ di chuyển
 * (Shift = mở rộng), ←/→ đóng/mở nhánh, Home/End, Space = đảo, Enter = chọn, F2 = đổi tên (Enter lưu, Esc huỷ).
 */
export function TreeView({
  label,
  items,
  selected,
  onSelectionChange,
  expanded,
  onExpandedChange,
  onRename,
  renderActions,
  emptyText = 'Không có mục nào',
  className,
}: TreeViewProps) {
  // Không controlled: nhớ nhánh ĐÓNG (nhánh mới xuất hiện sau vẫn mở mặc định).
  const [ownClosed, setOwnClosed] = useState<string[]>([]);
  const open = new Set(expanded ?? allGroupIds(items).filter((id) => !ownClosed.includes(id)));
  const setOpen = (ids: string[]) => (onExpandedChange ? onExpandedChange(ids) : setOwnClosed(allGroupIds(items).filter((id) => !ids.includes(id))));
  const rows = flatten(items, open);
  const selectableRows = rows.filter((r) => r.selectable);
  const sel = new Set(selected);
  const [focusId, setFocusId] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; text: string; error?: string } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const wantFocus = useRef(false);

  const focusRow = rows.find((r) => r.item.id === focusId) ?? rows.find((r) => sel.has(r.item.id)) ?? rows[0];
  // Focus sau render (đổi dòng bằng phím) – effect, không rAF.
  useEffect(() => {
    if (wantFocus.current && focusRow) {
      wantFocus.current = false;
      rowRefs.current.get(focusRow.item.id)?.focus();
    }
  });

  const moveFocus = (id: string) => {
    wantFocus.current = true;
    setFocusId(id);
  };
  const range = (a: string, b: string) => {
    const ids = selectableRows.map((r) => r.item.id);
    const [i, j] = [ids.indexOf(a), ids.indexOf(b)];
    if (i < 0 || j < 0) return [b];
    return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
  };
  const choose = (row: Row, how: 'replace' | 'toggle' | 'range') => {
    if (!row.selectable) return;
    const id = row.item.id;
    if (how === 'range' && anchor.current) return onSelectionChange(range(anchor.current, id));
    anchor.current = id;
    if (how === 'toggle') onSelectionChange(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else onSelectionChange([id]);
  };
  const toggleOpen = (id: string) => setOpen(open.has(id) ? [...open].filter((x) => x !== id) : [...open, id]);
  const canRename = (item: TreeItem) => !!onRename && (item.renamable ?? true);
  const startRename = (item: TreeItem) => canRename(item) && setRenaming({ id: item.id, text: item.label });
  const finishRename = (commit: boolean) => {
    if (!renaming) return;
    if (!commit || renaming.text === rows.find((r) => r.item.id === renaming.id)?.item.label) {
      setRenaming(null);
      moveFocus(renaming.id);
      return;
    }
    const error = onRename?.(renaming.id, renaming.text.trim());
    if (error) return setRenaming({ ...renaming, error });
    setRenaming(null);
    moveFocus(renaming.text.trim());
  };

  const onRowClick = (e: MouseEvent, row: Row) => {
    setFocusId(row.item.id);
    if (!row.selectable) return toggleOpen(row.item.id);
    choose(row, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'replace');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: Row) => {
    if (renaming) return;
    const i = rows.indexOf(row);
    const go = (next?: Row) => {
      if (!next) return;
      moveFocus(next.item.id);
      if (e.shiftKey && next.selectable) choose(next, 'range');
    };
    const hasKids = !!row.item.children?.length;
    switch (e.key) {
      case 'ArrowDown':
        go(rows[i + 1]);
        break;
      case 'ArrowUp':
        go(rows[i - 1]);
        break;
      case 'Home':
        go(rows[0]);
        break;
      case 'End':
        go(rows.at(-1));
        break;
      case 'ArrowRight':
        if (hasKids && !open.has(row.item.id)) toggleOpen(row.item.id);
        else if (hasKids) go(rows[i + 1]);
        break;
      case 'ArrowLeft':
        if (hasKids && open.has(row.item.id)) toggleOpen(row.item.id);
        else if (row.parent) moveFocus(row.parent);
        break;
      case ' ':
        if (row.selectable) choose(row, 'toggle');
        else toggleOpen(row.item.id);
        break;
      case 'Enter':
        if (row.selectable) choose(row, 'replace');
        else toggleOpen(row.item.id);
        break;
      case 'F2':
        startRename(row.item);
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  if (!rows.length) return <p className={cn('px-3 py-2 text-sm text-fg-muted', className)}>{emptyText}</p>;

  return (
    <div role="tree" aria-label={label} aria-multiselectable="true" className={cn('flex flex-col py-1', className)}>
      {rows.map((row) => {
        const { item, depth } = row;
        const hasKids = !!item.children?.length;
        const isSel = sel.has(item.id);
        const isRenaming = renaming?.id === item.id;
        return (
          <div
            key={item.id}
            ref={(el) => {
              if (el) rowRefs.current.set(item.id, el);
              else rowRefs.current.delete(item.id);
            }}
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={row.selectable ? isSel : undefined}
            aria-expanded={hasKids ? open.has(item.id) : undefined}
            tabIndex={focusRow?.item.id === item.id ? 0 : -1}
            onClick={(e) => onRowClick(e, row)}
            onDoubleClick={() => row.selectable && startRename(item)}
            onKeyDown={(e) => onKeyDown(e, row)}
            className={cn(
              'group flex h-7 cursor-default items-center gap-1.5 rounded-sm pr-1 text-sm outline-offset-[-2px]',
              isSel ? 'bg-accent/15 text-fg' : 'text-fg-secondary hover:bg-surface-muted/60',
              !row.selectable && 'font-semibold text-fg-muted',
              // 70 % để chữ mờ (object ẩn) vẫn đạt 4.5:1 (WCAG AA).
              item.dimmed && 'opacity-70',
            )}
            style={{ paddingLeft: 6 + depth * 14 }}
          >
            <span className="inline-flex w-3 shrink-0 justify-center text-fg-muted" aria-hidden="true">
              {hasKids && (
                <CaretIcon
                  className={cn('transition-transform', open.has(item.id) && 'rotate-90')}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOpen(item.id);
                  }}
                />
              )}
            </span>
            {item.icon && <span className="inline-flex shrink-0 text-fg-muted">{item.icon}</span>}
            {isRenaming ? (
              <RenameInput label={item.label} renaming={renaming} onText={(text) => setRenaming({ id: item.id, text })} onFinish={finishRename} />
            ) : (
              <span className="max-w-full shrink-0 truncate">{item.label}</span>
            )}
            {/* Nhãn chính không bị cắt; chữ phụ co lại trước. */}
            {!isRenaming && <span className="min-w-0 flex-1 truncate text-right text-xs text-fg-muted">{item.meta}</span>}
            {!isRenaming && renderActions && (
              <span role="presentation" className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                {renderActions(item)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Ô đổi tên tại chỗ: Enter / rời ô = lưu, Esc = huỷ; lỗi → viền đỏ + đọc qua role="alert". */
function RenameInput({
  label,
  renaming,
  onText,
  onFinish,
}: {
  label: string;
  renaming: { text: string; error?: string };
  onText: (text: string) => void;
  onFinish: (commit: boolean) => void;
}) {
  return (
    <>
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- ô đổi tên vừa mở
        autoFocus
        aria-label={`Đổi tên ${label}`}
        aria-invalid={!!renaming.error || undefined}
        title={renaming.error}
        value={renaming.text}
        onChange={(e) => onText(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') onFinish(true);
          else if (e.key === 'Escape') onFinish(false);
        }}
        onBlur={() => onFinish(true)}
        className={cn(
          'h-6 min-w-0 flex-1 rounded-xs border bg-surface-sunken px-1.5 text-sm text-fg focus-visible:outline-none',
          renaming.error ? 'border-danger' : 'border-accent/60',
        )}
      />
      {renaming.error && (
        <span role="alert" className="sr-only">
          {renaming.error}
        </span>
      )}
    </>
  );
}
