import { useId } from 'react';
import { Button, Textarea } from '@/components';
import { alertKind } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { canAddAlertNote } from '@/features/alerts/workflow';
import { runAction } from '@/lib/actionError';
import { announce } from '@/lib/announce';
import type { AlertDrawerHandlers } from './AlertDetailDrawer';
import { Collapsible, fmtAt } from './drawerParts';
import { NOTE_FIELD_ID, type NoteDraft } from './alertNote';

/**
 * "Ghi chú xử lý": ghi chú đã lưu (trên) + ô nhập + "Lưu ghi chú". Chưa có ghi chú → nhãn ô = tiêu đề mục (như ảnh);
 * có rồi → tiêu đề riêng + danh sách + ô "Thêm ghi chú". Đã hoàn thành / không có quyền → chỉ xem.
 */
export function NotesSection({
  alert: a,
  note,
  canAct,
  onAddNote,
  collapsed,
}: {
  alert: AlertRecord;
  note: NoteDraft;
  canAct: boolean;
  onAddNote: AlertDrawerHandlers['onAddNote'];
  /** Thu gọn trong `<details>` "Ghi chú xử lý (n)" (loại gas – ảnh không có mục này). */
  collapsed?: boolean;
}) {
  const notes = a.notes ?? [];
  const editable = canAct && canAddAlertNote(a);
  const headingId = useId();
  if (collapsed) {
    return (
      <Collapsible title={`Ghi chú xử lý (${notes.length})`}>
        <NotesBody alert={a} note={note} notes={notes} editable={editable} onAddNote={onAddNote} labelAsHeading={false} />
      </Collapsible>
    );
  }
  const showHeading = notes.length > 0 || !editable;
  return (
    <section
      aria-labelledby={showHeading ? headingId : undefined}
      aria-label={showHeading ? undefined : 'Ghi chú xử lý'}
      className="flex flex-col gap-3"
    >
      {showHeading && (
        <h3 id={headingId} className="text-lg font-semibold text-fg-secondary">
          Ghi chú xử lý
        </h3>
      )}
      <NotesBody alert={a} note={note} notes={notes} editable={editable} onAddNote={onAddNote} labelAsHeading />
    </section>
  );
}

function NotesBody({
  alert: a,
  note,
  notes,
  editable,
  onAddNote,
  labelAsHeading,
}: {
  alert: AlertRecord;
  note: NoteDraft;
  notes: NonNullable<AlertRecord['notes']>;
  editable: boolean;
  onAddNote: AlertDrawerHandlers['onAddNote'];
  /** true: chưa có ghi chú thì nhãn ô = tiêu đề mục (như ảnh áp suất). */
  labelAsHeading: boolean;
}) {
  return (
    <>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Ghi chú đã lưu">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md bg-surface-muted/60 px-3 py-2">
              <p className="text-sm text-fg-secondary">
                {n.author} · {fmtAt(n.at).slice(0, 5)}
              </p>
              <p className="whitespace-pre-wrap text-base text-fg">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <div id={NOTE_FIELD_ID(a.id)} className="flex flex-col gap-2">
          <Textarea
            label={notes.length > 0 || !labelAsHeading ? 'Thêm ghi chú' : 'Ghi chú xử lý'}
            labelVariant={notes.length > 0 || !labelAsHeading ? 'field' : 'section'}
            value={note.text}
            onChange={note.set}
            rows={4}
            maxLength={1000}
            placeholder="Nhập tình trạng kiểm tra..."
            error={note.error}
            hint={
              a.status === 'in-progress' && alertKind(a).update.kind === 'resolve-note'
                ? 'Bắt buộc khi đánh dấu đã xử lý – nội dung trong ô được lưu kèm.'
                : undefined
            }
          />
          <Button
            variant="subtle"
            size="sm"
            className="self-end"
            disabled={!note.text.trim()}
            onClick={() =>
              void runAction(
                async () => {
                  await onAddNote(a.id, note.text);
                  note.clear();
                  announce('Đã lưu ghi chú.');
                },
                (text) => {
                  note.fail(text);
                  announce(text);
                },
              )
            }
          >
            Lưu ghi chú
          </Button>
        </div>
      ) : (
        notes.length === 0 && <p className="text-base text-fg-secondary">Chưa có ghi chú.</p>
      )}
    </>
  );
}
