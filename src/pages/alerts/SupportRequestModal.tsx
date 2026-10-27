import { useMemo, useState } from 'react';
import { Button, Modal, StaffList, Textarea, type StaffPickerItem } from '@/components';
import type { AlertRecord } from '@/data/alerts';
import { STAFF } from '@/mocks/maintenance';

/**
 * Người nhận "Yêu cầu hỗ trợ" (cảnh báo gas): trưởng ca / quản lý (role manager) + bộ phận An toàn – HSE, lấy từ `STAFF`.
 * TODO(backend): danh mục theo vai trò trực ca.
 */
export const SUPPORT_STAFF = STAFF.filter((p) => p.role === 'manager' || p.department === 'An toàn – HSE');

/**
 * "Yêu cầu hỗ trợ" (chưa có thiết kế; dựng theo token, modal TRÊN drawer): chọn MỘT người (StaffList compact) + lý do bắt buộc.
 * Người được chọn thành người phối hợp + một dòng lịch sử. Thông báo thật chưa gửi được (TODO backend) – ghi rõ, không giả vờ
 * đã gửi. Chỉ mount khi mở.
 */
export function SupportRequestModal({ alert: a, onClose, onConfirm }: { alert: AlertRecord; onClose: () => void; onConfirm: (people: string[], reason: string) => void }) {
  const [person, setPerson] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const items = useMemo<StaffPickerItem[]>(
    () =>
      SUPPORT_STAFF.map((p) => ({
        id: p.name,
        name: p.name,
        subtitle: `${p.title} • ${p.department}`,
        shiftLabel: '',
        busy: false,
        active: 0,
        overdue: 0,
        meta: a.collaborators?.includes(p.name) ? 'Đang phối hợp' : undefined,
      })),
    [a.collaborators],
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Yêu cầu hỗ trợ"
      description={`${a.code} – ${a.message}`}
      dismissOnBackdrop={!reason}
      onSubmit={(e) => {
        e.preventDefault();
        if (!person) return;
        if (!reason.trim()) {
          setError('Nhập lý do cần hỗ trợ.');
          return;
        }
        onConfirm([person], reason);
      }}
      footerStart={
        <Button variant="plain" onClick={onClose}>
          Hủy
        </Button>
      }
      footer={
        <Button type="submit" variant="primary" disabled={!person}>
          Gửi yêu cầu hỗ trợ
        </Button>
      }
    >
      <StaffList compact label="Người / bộ phận hỗ trợ" items={items} value={person} onChange={setPerson} />
      <Textarea
        label="Lý do"
        required
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(undefined);
        }}
        rows={3}
        maxLength={500}
        error={error}
        placeholder="Vd: nồng độ tăng nhanh, cần bộ phận an toàn hỗ trợ khoanh vùng"
      />
      <p className="text-sm text-fg-secondary">Người được chọn thêm vào danh sách phối hợp của cảnh báo. Thông báo đẩy/SMS chưa gửi được – chờ backend.</p>
    </Modal>
  );
}
