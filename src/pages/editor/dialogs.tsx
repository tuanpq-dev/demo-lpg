import { useState, type ReactNode } from 'react';
import { Button, Modal, TextField, TrashIcon } from '@/components';
import { isSampleScene, useSceneList } from '@/data/scene';
import type { EditorDraft } from '@/features/scene-editor/draft';

const fmtTime = (iso: string) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

/** Xác nhận đơn giản (rời trang khi chưa lưu, bỏ thay đổi…). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footerStart={
        <Button variant="link" onClick={onClose}>
          Huỷ
        </Button>
      }
      footer={
        <Button variant={danger ? 'ghost' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      }
    >
      <div className="text-base text-fg-secondary">{children}</div>
    </Modal>
  );
}

/** Nhập một tên (vd tên view mới). */
export function NameDialog({
  open,
  title,
  label,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  // Chỉ mount khi mở – khởi tạo state bằng hàm (quy ước modal có form).
  return open ? <NameForm {...{ title, label, initial, submitLabel, onSubmit, onClose }} /> : null;
}

function NameForm({ title, label, initial, submitLabel, onSubmit, onClose }: Omit<Parameters<typeof NameDialog>[0], 'open'>) {
  const [name, setName] = useState(() => initial);
  const [error, setError] = useState<string>();
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError('Nhập tên');
        onSubmit(name.trim());
      }}
      footerStart={
        <Button type="button" variant="link" onClick={onClose}>
          Huỷ
        </Button>
      }
      footer={<Button type="submit">{submitLabel}</Button>}
    >
      <TextField label={label} value={name} onChange={setName} error={error} required />
    </Modal>
  );
}

/** Danh sách cảnh: đã lưu (kho trình duyệt) + mẫu (chỉ đọc). Xoá được cảnh đã lưu. */
export function OpenSceneDialog({
  open,
  dirty,
  onOpen,
  onRemove,
  onClose,
}: {
  open: boolean;
  dirty: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  return open ? <OpenSceneList {...{ dirty, onOpen, onRemove, onClose }} /> : null;
}

function OpenSceneList({ dirty, onOpen, onRemove, onClose }: Omit<Parameters<typeof OpenSceneDialog>[0], 'open'>) {
  const { items, refetch } = useSceneList();
  return (
    <Modal open onClose={onClose} title="Mở cảnh" size="lg" description="Cảnh đã lưu trong trình duyệt và cảnh mẫu (mẫu chỉ đọc – Lưu sẽ hỏi id mới).">
      {dirty && <p className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">Cảnh đang sửa có thay đổi chưa lưu – mở cảnh khác sẽ bỏ các thay đổi đó.</p>}
      {!items ? (
        <p className="text-base text-fg-muted">Đang tải…</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line/30">
          {items.map((s) => (
            <li key={`${s.sample}-${s.id}`} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-fg">
                  {s.sample ? s.id : s.name}
                  {s.sample && <span className="ml-2 rounded-xs bg-surface-chip px-1.5 py-0.5 text-2xs font-semibold text-fg-muted">Mẫu</span>}
                </p>
                <p className="text-sm text-fg-muted">
                  {s.sample ? 'src/mocks/scenes – chỉ đọc' : `${s.id} · v${s.version} · ${s.objectCount} object · lưu ${fmtTime(s.updatedAt)}`}
                </p>
              </div>
              <Button size="sm" onClick={() => onOpen(s.id)}>
                Mở
              </Button>
              {!s.sample && (
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={`Xoá cảnh ${s.id}`}
                  icon={<TrashIcon />}
                  onClick={() => void onRemove(s.id).then(refetch)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Lưu thành bản mới: id + tên; id cảnh mẫu bị chặn, id đã có → cảnh báo ghi đè. */
export function SaveAsDialog({
  open,
  initialId,
  initialName,
  existingIds,
  onSave,
  onClose,
}: {
  open: boolean;
  initialId: string;
  initialName: string;
  existingIds: readonly string[];
  onSave: (id: string, name: string) => void;
  onClose: () => void;
}) {
  return open ? <SaveAsForm {...{ initialId, initialName, existingIds, onSave, onClose }} /> : null;
}

function SaveAsForm({ initialId, initialName, existingIds, onSave, onClose }: Omit<Parameters<typeof SaveAsDialog>[0], 'open'>) {
  const [id, setId] = useState(() => initialId);
  const [name, setName] = useState(() => initialName);
  const idErr = !/^[a-z0-9-]+$/.test(id)
    ? 'Chỉ chữ thường không dấu, số và "-"'
    : isSampleScene(id)
      ? 'Trùng id cảnh mẫu (chỉ đọc) – chọn id khác'
      : undefined;
  const [touched, setTouched] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title="Lưu thành bản mới"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!idErr && name.trim()) onSave(id, name.trim());
      }}
      footerStart={
        <Button type="button" variant="link" onClick={onClose}>
          Huỷ
        </Button>
      }
      footer={<Button type="submit">Lưu</Button>}
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="id cảnh"
          value={id}
          onChange={setId}
          required
          error={touched ? idErr : undefined}
          hint={existingIds.includes(id) ? `Đã có cảnh "${id}" – Lưu sẽ ghi đè (version tăng).` : `Mở ở Viewer: /overview?scene=${id}`}
        />
        <TextField label="Tên cảnh" value={name} onChange={setName} required error={touched && !name.trim() ? 'Nhập tên' : undefined} />
      </div>
    </Modal>
  );
}

/** Lỗi Import JSON (cú pháp hoặc zod) – liệt kê đủ "đường dẫn: thông báo". */
export function ImportErrorDialog({ file, errors, onClose }: { file: string; errors: string[] | null; onClose: () => void }) {
  return (
    <Modal
      open={!!errors}
      onClose={onClose}
      title="Không import được cảnh"
      description={`${file}: ${errors?.length ?? 0} lỗi – cảnh hiện tại giữ nguyên.`}
      size="lg"
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto font-mono text-sm text-fg-secondary">
        {errors?.map((e, i) => (
          <li key={i} className="rounded-sm bg-danger/10 px-2 py-1">
            {e}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Có bản nháp tự lưu từ phiên trước → khôi phục hay bỏ. */
export function RestoreDraftDialog({
  draft,
  onRestore,
  onDiscard,
}: {
  draft: EditorDraft | null;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal
      open={!!draft}
      onClose={onDiscard}
      dismissOnBackdrop={false}
      title="Khôi phục bản nháp?"
      footerStart={
        <Button variant="link" onClick={onDiscard}>
          Bỏ bản nháp
        </Button>
      }
      footer={<Button onClick={onRestore}>Khôi phục</Button>}
    >
      {draft && (
        <p className="text-base text-fg-secondary">
          Có thay đổi chưa lưu của cảnh <b className="text-fg">{draft.scene.name}</b> ({draft.scene.id}, {draft.scene.objects.length}{' '}
          object), tự lưu lúc {fmtTime(draft.savedAt)}.
        </p>
      )}
    </Modal>
  );
}
