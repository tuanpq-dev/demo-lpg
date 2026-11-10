import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { CloseIcon, GripIcon, PlusIcon, TemplateIcon } from '../Icon';
import { Select } from '../Select';

export type ChecklistItem = { id: string; text: string; done: boolean };
export type ChecklistTemplate = { id: string; label: string; items: readonly string[] };

export type ChecklistEditorProps = {
  title?: string;
  items: readonly ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  /** Mẫu checklist – chọn sẽ THÊM các bước chưa có vào cuối danh sách. */
  templates?: readonly ChecklistTemplate[];
  emptyText?: string;
  className?: string;
};

let seq = 0;
export const newChecklistItem = (text = ''): ChecklistItem => ({ id: `ck-${Date.now().toString(36)}-${seq++}`, text, done: false });

/**
 * "Các bước công việc (Checklist)" – kéo thả (tay kéo ⠿) hoặc Alt+↑/↓ để đổi thứ tự,
 * sửa nội dung trực tiếp, đánh dấu xong, xoá; "Chọn checklist mẫu" và "+ Thêm công việc".
 * ⚠ Theo ảnh thiết kế modal (chưa có node Figma).
 */
export function ChecklistEditor({
  title = 'Các bước công việc (Checklist)',
  items,
  onChange,
  templates,
  emptyText = 'Chưa có bước nào. Thêm công việc hoặc chọn checklist mẫu.',
  className,
}: ChecklistEditorProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const hintId = useId();
  /** Dòng vừa thêm – focus ngay sau lần render kế tiếp (không chờ requestAnimationFrame). */
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingFocus) return;
    inputs.current.get(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus, items]);

  const update = (id: string, patch: Partial<ChecklistItem>) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    if (!it) return;
    next.splice(to, 0, it);
    onChange(next);
  };

  const add = () => {
    const it = newChecklistItem();
    onChange([...items, it]);
    setPendingFocus(it.id);
  };

  const applyTemplate = (tplId: string | null) => {
    const tpl = templates?.find((t) => t.id === tplId);
    if (!tpl) return;
    const existing = new Set(items.map((i) => i.text.trim().toLowerCase()));
    onChange([...items, ...tpl.items.filter((t) => !existing.has(t.toLowerCase())).map((t) => newChecklistItem(t))]);
  };

  const onRowKey = (e: KeyboardEvent<HTMLInputElement>, index: number, id: string) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(index, index + (e.key === 'ArrowUp' ? -1 : 1));
      requestAnimationFrame(() => inputs.current.get(id)?.focus());
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (index === items.length - 1) add();
      else {
        const following = items[index + 1];
        if (following) inputs.current.get(following.id)?.focus();
      }
    }
  };

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-fg">{title}</h3>
        <div className="flex items-center gap-2">
          {templates && templates.length > 0 && (
            <Select
              variant="button"
              label="Chọn checklist mẫu"
              icon={<TemplateIcon />}
              options={templates.map((t) => ({ value: t.id, label: t.label }))}
              value={null}
              onChange={applyTemplate}
              align="end"
            />
          )}
          <Button icon={<PlusIcon />} onClick={add}>
            Thêm công việc
          </Button>
        </div>
      </div>

      <ol className="flex flex-col overflow-hidden rounded-lg border border-line/30">
        {items.length === 0 && <li className="px-4 py-4 text-sm text-fg-muted/65">{emptyText}</li>}
        {items.map((it, i) => (
          <li
            key={it.id}
            draggable
            onDragStart={(e) => {
              setDragId(it.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(it.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = items.findIndex((x) => x.id === dragId);
              if (from >= 0) move(from, i);
              setDragId(null);
              setOverId(null);
            }}
            className={cn(
              'group flex items-center gap-3 border-b border-line/20 bg-surface-raised/40 px-3 py-2 last:border-b-0',
              dragId === it.id && 'opacity-50',
              overId === it.id && dragId !== it.id && 'bg-info/10',
            )}
          >
            <span className="cursor-grab text-fg-secondary/70 active:cursor-grabbing" title="Kéo để sắp xếp (hoặc Alt + ↑/↓)" aria-hidden="true">
              <GripIcon />
            </span>
            <Checkbox label={`Đánh dấu xong: ${it.text || `bước ${i + 1}`}`} checked={it.done} onChange={(done) => update(it.id, { done })} />
            <input
              ref={(el) => {
                if (el) inputs.current.set(it.id, el);
                else inputs.current.delete(it.id);
              }}
              value={it.text}
              onChange={(e) => update(it.id, { text: e.target.value })}
              onKeyDown={(e) => onRowKey(e, i, it.id)}
              placeholder="Nhập nội dung công việc…"
              aria-label={`Bước ${i + 1}`}
              aria-describedby={hintId}
              className={cn(
                'min-w-0 flex-1 rounded-sm bg-transparent px-1 py-0.5 text-base text-fg placeholder:text-fg-secondary/60 focus:bg-surface-sunken focus:outline-none',
                it.done && 'text-fg-secondary line-through',
              )}
            />
            <button
              type="button"
              aria-label={`Xoá bước ${i + 1}`}
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
              className="inline-flex size-6 items-center justify-center rounded-sm text-fg-secondary opacity-0 hover:bg-surface-muted hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ol>
      <span id={hintId} className="sr-only">
        Alt + mũi tên lên/xuống để đổi thứ tự
      </span>
    </section>
  );
}
