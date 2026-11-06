import { useState, type RefObject } from 'react';
import {
  AttachmentCard,
  Card,
  Checklist,
  checklistSummary,
  ClipboardCheckIcon,
  ClipboardClockIcon,
  EventTimeline,
  FileIcon,
  FolderIcon,
  HistoryIcon,
  ListChecksIcon,
  NotesIcon,
  NotesThread,
} from '@/components';
import { formatDate, type MaintenanceAttachment, type MaintenanceRecord } from '@/data/maintenance';
import { formatFileSize, historyEvents, relativeDayTime } from '@/data/maintenanceDetail';
import { CHECKLIST_LOCK_HINT, checklistLock, checklistProgress } from '@/features/maintenance/checklist';
import { downloadSampleAttachment } from '../attachments';
import { ViewAttachmentModal } from '../MaintenanceDetailDialogs';
import { MaintenanceResult } from '../MaintenanceResult';

const ICON = 'text-fg-secondary';

/** "Nội dung công việc": mô tả sự cố + mục tiêu xử lý. */
export function WorkContentCard({ record: r }: { record: MaintenanceRecord }) {
  return (
    <Card title="Nội dung công việc" icon={<FileIcon size={18} className={ICON} />} headerVariant="divided" radius="lg">
      <h4 className="mb-2 text-base text-fg-secondary">Mô tả sự cố</h4>
      <p className="rounded-md border border-line/30 bg-surface-sunken/40 px-3 py-2.5 text-base leading-6 text-fg">{r.description ?? 'Chưa có mô tả.'}</p>
      <h4 className="mb-2 mt-5 text-base text-fg-secondary">Mục tiêu xử lý</h4>
      {r.objectives?.length ? (
        <ul className="flex flex-col gap-1.5 pl-3 text-base text-fg">
          {r.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-fg-secondary">Chưa có mục tiêu.</p>
      )}
    </Card>
  );
}

export type ChecklistCardProps = {
  record: MaintenanceRecord;
  canWrite: boolean;
  /** Khung nhận focus khi vào `#checklist`. */
  focusRef: RefObject<HTMLDivElement>;
  onToggle: (itemId: string) => void;
};

/** "Checklist công việc": tick theo bước (khoá + lý do khi chưa được sửa / chỉ xem). */
export function ChecklistCard({ record: r, canWrite, focusRef, onToggle }: ChecklistCardProps) {
  const progress = checklistProgress(r.checklist);
  const lock = canWrite ? checklistLock(r.status) : 'readonly';
  return (
    <div ref={focusRef} id="checklist" tabIndex={-1} className="scroll-mt-24 rounded-lg">
      <Card
        title="Checklist công việc"
        icon={<ListChecksIcon size={18} className={ICON} />}
        headerVariant="divided"
        radius="lg"
        headerEnd={r.checklist?.length ? <span className="text-sm text-fg-secondary">{checklistSummary(progress)}</span> : undefined}
      >
        {r.checklist?.length ? (
          <Checklist
            items={r.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done, na: c.na, active: c.active, time: c.doneAt?.slice(11, 16) }))}
            progress={progress}
            lockHint={lock ? (canWrite ? CHECKLIST_LOCK_HINT[lock] : 'Bạn chỉ có quyền xem checklist.') : null}
            onToggle={lock ? undefined : onToggle}
          />
        ) : (
          <p className="text-base text-fg-secondary">Yêu cầu chưa có checklist.</p>
        )}
      </Card>
    </div>
  );
}

/** "Ghi chú kỹ thuật": luồng ghi chú; `onAdd` (async, lỗi = reject) thiếu = chỉ đọc. */
export function NotesCard({ record: r, now, onAdd }: { record: MaintenanceRecord; now: Date; onAdd: ((text: string) => Promise<unknown>) | undefined }) {
  return (
    <Card title="Ghi chú kỹ thuật" icon={<NotesIcon size={18} className={ICON} />} headerVariant="divided" radius="lg">
      <NotesThread notes={(r.notes ?? []).map((n) => ({ id: n.id, author: n.author, time: relativeDayTime(n.at, now), text: n.text }))} onAdd={onAdd} />
    </Card>
  );
}

/** "Ảnh và tài liệu": tệp mẫu (xem = hộp thoại giữ chỗ, tải bản .txt) / tệp tạm (chưa tải lên máy chủ). */
export function AttachmentsCard({ record: r }: { record: MaintenanceRecord }) {
  const [viewing, setViewing] = useState<MaintenanceAttachment | null>(null);
  const download = (a: MaintenanceAttachment) => downloadSampleAttachment(a, r.code);
  return (
    <Card title="Ảnh và tài liệu" icon={<FolderIcon size={18} className={ICON} />} headerVariant="divided" radius="lg">
      {/* TODO(backend): tải tệp lên khi có API lưu trữ – hiện chỉ xem/tải bản mẫu; tệp thêm ở modal cập nhật tiến độ chỉ giữ tên/kích thước (isTemp). */}
      {r.attachments?.length ? (
        <div className="flex flex-wrap gap-3">
          {r.attachments.map((a) => (
            <AttachmentCard
              key={a.id}
              id={a.id}
              name={a.name}
              kind={a.kind}
              notice={a.isTemp ? 'Chưa tải lên máy chủ' : undefined}
              onView={() => setViewing(a)}
              onDownload={a.isTemp ? undefined : () => download(a)}
            />
          ))}
        </div>
      ) : (
        <p className="text-base text-fg-secondary">Chưa có ảnh hoặc tài liệu.</p>
      )}
      {viewing && <ViewAttachmentModal attachment={viewing} meta={formatFileSize(viewing.size)} onClose={() => setViewing(null)} onDownload={() => download(viewing)} />}
    </Card>
  );
}

/** "Lịch sử xử lý". */
export function HistoryCard({ record: r, now }: { record: MaintenanceRecord; now: Date }) {
  return (
    <Card title="Lịch sử xử lý" icon={<HistoryIcon size={18} className={ICON} />} headerVariant="divided" radius="lg">
      {r.history?.length ? <EventTimeline variant="history" events={historyEvents(r, now)} /> : <p className="text-base text-fg-secondary">Chưa có lịch sử.</p>}
    </Card>
  );
}

/** "Kết quả bảo trì": khối kết quả khi nghiệm thu đạt; hoàn thành / đã hủy / chờ. */
export function ResultCard({ record: r }: { record: MaintenanceRecord }) {
  return (
    <Card title="Kết quả bảo trì" icon={<ClipboardCheckIcon size={18} className={ICON} />} headerVariant="divided" radius="lg">
      {r.status === 'done' && r.review?.result === 'pass' ? (
        <MaintenanceResult record={r} />
      ) : r.status === 'done' ? (
        <p className="text-base text-fg">
          Hoàn thành ngày {r.completedAt ? formatDate(r.completedAt) : '—'} · tiến độ {r.progress}%.
        </p>
      ) : r.status === 'cancelled' ? (
        <p className="text-base text-fg-secondary">Yêu cầu đã hủy{r.cancelReason ? ` – lý do: ${r.cancelReason}` : ''}.</p>
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <ClipboardClockIcon size={40} className={ICON} />
          <p className="text-base text-fg-secondary">Kết quả bảo trì sẽ được cập nhật sau khi công việc hoàn thành.</p>
        </div>
      )}
    </Card>
  );
}
