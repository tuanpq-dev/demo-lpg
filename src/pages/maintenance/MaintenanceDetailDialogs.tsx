import { useId, useRef, useState } from 'react';
import { Badge, Button, FileIcon, FormField, Modal, Select, Textarea } from '@/components';
import { DEPARTMENTS, PEOPLE, SHIFTS, type MaintenanceAttachment, type MaintenanceRecord, type ShiftId } from '@/data/maintenance';
import type { AssignInput } from '@/features/maintenance/workflow';

/**
 * Phân công người xử lý – ⚠ Figma CHƯA có thiết kế (ảnh MT-00128 chỉ có nút): modal tối giản theo token, 3 trường
 * Người phụ trách / Phòng ban / Ca trực. Chọn người → tự điền phòng ban của người đó (sửa được). Cần designer duyệt.
 */
export function AssignMaintenanceModal({
  record,
  onClose,
  onSubmit,
}: {
  record: MaintenanceRecord;
  onClose: () => void;
  onSubmit: (input: AssignInput) => Promise<void>;
}) {
  const [assignee, setAssignee] = useState<string | null>(() => record.assignee);
  const [department, setDepartment] = useState<string | null>(() => record.department ?? null);
  const [shift, setShift] = useState<ShiftId | null>(() => record.shift ?? null);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!assignee) return setError('Chọn người phụ trách.');
    await onSubmit({ assignee, department: department ?? undefined, shift: shift ?? undefined });
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Phân công người xử lý"
      description={`${record.code} – ${record.title}`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary">
            Phân công
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Người phụ trách chính" required error={error || undefined}>
          {({ id, labelId, describedBy, invalid }) => (
            <Select
              variant="field"
              id={id}
              labelledBy={labelId}
              describedBy={describedBy}
              invalid={invalid}
              label="Người phụ trách chính"
              placeholder="Chọn kỹ thuật viên"
              options={PEOPLE.map((p) => ({ value: p.name, label: `${p.name} – ${p.department}` }))}
              value={assignee}
              onChange={(v) => {
                setAssignee(v);
                setError('');
                const dept = PEOPLE.find((p) => p.name === v)?.department;
                if (dept) setDepartment(dept);
              }}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Phòng ban">
            {({ id, labelId }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                label="Phòng ban"
                placeholder="Chọn phòng ban"
                options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                value={department}
                onChange={setDepartment}
              />
            )}
          </FormField>
          <FormField label="Ca trực">
            {({ id, labelId }) => (
              <Select variant="field" id={id} labelledBy={labelId} label="Ca trực" placeholder="Chọn ca" options={SHIFTS} value={shift} onChange={setShift} />
            )}
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

/** Xác nhận hủy yêu cầu – lý do không bắt buộc, ghi vào lịch sử xử lý. */
export function CancelMaintenanceModal({
  record,
  onClose,
  onConfirm,
}: {
  record: MaintenanceRecord;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      dismissOnBackdrop={false}
      title={`Hủy yêu cầu ${record.code}?`}
      description="Yêu cầu sẽ chuyển sang “Đã hủy”, không tính vào KPI và không thể tiếp tục xử lý. Thao tác được ghi vào lịch sử."
      onSubmit={(e) => {
        e.preventDefault();
        void onConfirm(reason);
      }}
      footer={
        <>
          <Button onClick={onClose}>Giữ yêu cầu</Button>
          <Button type="submit" variant="primary">
            Xác nhận hủy
          </Button>
        </>
      }
    >
      <Textarea label="Lý do hủy (không bắt buộc)" value={reason} onChange={setReason} maxLength={300} showCount rows={3} />
    </Modal>
  );
}

/**
 * "Nghiệm thu đạt" (chờ nghiệm thu → hoàn thành) – hộp xác nhận. Đường DUY NHẤT sang "Hoàn thành".
 * Quyền: `maintenance:review` (kỹ sư / quản trị) – UX; TODO(backend) kiểm tra lại ở API.
 */
export function AcceptReviewModal({ record, onClose, onConfirm }: { record: MaintenanceRecord; onClose: () => void; onConfirm: () => Promise<void> }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Nghiệm thu đạt ${record.code}?`}
      description="Yêu cầu chuyển sang “Hoàn thành”, ghi ngày hoàn thành và lịch sử. Không thể chỉnh tiến độ sau khi nghiệm thu."
      onSubmit={(e) => {
        e.preventDefault();
        void onConfirm();
      }}
      footer={
        <>
          <Button onClick={onClose}>Để sau</Button>
          <Button type="submit" variant="primary">
            Xác nhận nghiệm thu đạt
          </Button>
        </>
      }
    >
      <p className="text-base text-fg-secondary">{record.title}</p>
    </Modal>
  );
}

/** "Yêu cầu làm lại" – lý do BẮT BUỘC; yêu cầu lùi về "Đang thực hiện", lý do ghi vào lịch sử. */
export function ReworkModal({ record, onClose, onConfirm }: { record: MaintenanceRecord; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <Modal
      open
      onClose={onClose}
      dismissOnBackdrop={false}
      title={`Yêu cầu làm lại ${record.code}`}
      description="Yêu cầu quay về “Đang thực hiện” để người phụ trách xử lý tiếp. Lý do được ghi vào lịch sử xử lý."
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) {
          setError('Nhập lý do yêu cầu làm lại.');
          wrapRef.current?.querySelector('textarea')?.focus();
          return;
        }
        void onConfirm(reason);
      }}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary">
            Gửi yêu cầu làm lại
          </Button>
        </>
      }
    >
      <div ref={wrapRef}>
        <Textarea
          label="Lý do làm lại"
          required
          value={reason}
          onChange={(v) => {
            setReason(v);
            if (error) setError('');
          }}
          error={error || undefined}
          maxLength={500}
          showCount
          rows={3}
        />
      </div>
    </Modal>
  );
}

/**
 * "Xem" tệp khi chưa có backend: modal giữ chỗ. Tệp mẫu → nhãn "Dữ liệu mẫu" + tải bản .txt; tệp tạm (`isTemp`, thêm ở
 * modal cập nhật tiến độ) → nhãn "Chưa tải lên máy chủ", không có nội dung để tải.
 */
export function ViewAttachmentModal({
  attachment,
  meta,
  onClose,
  onDownload,
}: {
  attachment: MaintenanceAttachment;
  meta: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  const descId = useId();
  const temp = !!attachment.isTemp;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={attachment.name}
      footer={
        <>
          {!temp && <Button onClick={onDownload}>Tải bản mẫu (.txt)</Button>}
          <Button variant="primary" onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="tag" tone={temp ? 'warning' : 'neutral'}>
            {temp ? 'Chưa tải lên máy chủ' : 'Dữ liệu mẫu'}
          </Badge>
          <span className="text-sm text-fg-secondary">{meta}</span>
        </div>
        <div className="grid min-h-[240px] place-items-center rounded-md border border-dashed border-line bg-surface-sunken/40 p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <FileIcon size={32} className="text-fg-secondary" />
            <p id={descId} className="max-w-[420px] text-base text-fg-secondary">
              {temp
                ? 'Tệp được thêm khi cập nhật tiến độ nhưng chưa tải lên máy chủ (bản demo chưa nối kho lưu trữ) – chỉ còn tên và dung lượng.'
                : 'Chưa có tệp thật – bản demo chưa nối kho lưu trữ. Xem trước sẽ hiện ở đây khi có backend.'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
