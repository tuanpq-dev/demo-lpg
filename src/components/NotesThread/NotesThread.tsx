import { useId, useState, type FormEvent } from 'react';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { Button } from '../Button';
import { inputClass } from '../FormField/FormField';
import { UserIcon } from '../Icon';

export type NoteView = {
  id: string;
  author: string;
  /** Đã định dạng, vd "Hôm nay 10:50". */
  time: string;
  text: string;
};

export type NotesThreadProps = {
  notes: readonly NoteView[];
  /** Thêm ghi chú (nội dung đã trim, không rỗng). Không truyền = chỉ đọc (ẩn ô nhập). */
  onAdd?: (text: string) => void;
  /** Tên cho danh sách, vd "Ghi chú kỹ thuật". */
  label?: string;
  className?: string;
};

/** Chữ cái đầu – avatar tạm. TODO(backend): ảnh đại diện thật (URL từ hồ sơ người dùng) khi có API. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Luồng ghi chú – ảnh MT-00128 (số đo ước lượng): avatar `--note-avatar-size` + bong bóng nền surface-muted/60 (pixel ảnh #232A34) viền line/30 (tên đậm,
 * giờ bên phải, nội dung chữ phụ); dưới cùng ô nhập (avatar trống + textarea ~64px) và nút "Thêm ghi chú" căn phải.
 * Thêm xong: ô nhập trống, ghi chú mới hiện cuối luồng, trình đọc màn hình nghe "Đã thêm ghi chú".
 */
export function NotesThread({ notes, onAdd, label = 'Ghi chú kỹ thuật', className }: NotesThreadProps) {
  const [text, setText] = useState('');
  const inputId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !onAdd) return;
    onAdd(t);
    setText('');
    announce('Đã thêm ghi chú');
  };
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {notes.length ? (
        <ol aria-label={label} className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="grid size-[var(--note-avatar-size)] shrink-0 place-items-center rounded-full bg-info/20 text-2xs font-semibold text-info">
                {initials(n.author)}
              </span>
              <article className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-line/30 bg-surface-muted/60 px-3 py-2.5">
                <header className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-base font-semibold text-fg">{n.author}</span>
                  <time className="text-sm text-fg-secondary">{n.time}</time>
                </header>
                <p className="whitespace-pre-wrap break-words text-base text-fg-secondary">{n.text}</p>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-fg-secondary">Chưa có ghi chú.</p>
      )}
      {onAdd && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <span aria-hidden="true" className="grid size-[var(--note-avatar-size)] shrink-0 place-items-center rounded-md bg-surface-muted text-fg-secondary">
              <UserIcon size={14} />
            </span>
            <label htmlFor={inputId} className="sr-only">
              Ghi chú mới
            </label>
            <textarea
              id={inputId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
              }}
              rows={3}
              maxLength={2000}
              placeholder="Nhập ghi chú mới..."
              className={cn(inputClass(false), 'min-h-16 flex-1 resize-y py-2 leading-5')}
            />
          </div>
          <Button type="submit" variant="subtle" disabled={!text.trim()} className="self-end">
            Thêm ghi chú
          </Button>
        </form>
      )}
    </div>
  );
}
