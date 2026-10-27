import { useMemo, useState } from 'react';
import { Button, Modal, StaffList, type StaffPickerItem } from '@/components';
import { ALERT_STAFF } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';

/** Số cảnh báo Đang xử lý mà mỗi người đang phụ trách (chip phụ trên thẻ). */
export function alertWorkloads(alerts: readonly AlertRecord[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of alerts) if (a.status === 'in-progress' && a.assignee) m.set(a.assignee, (m.get(a.assignee) ?? 0) + 1);
  return m;
}

/**
 * "Phân công xử lý" cảnh báo – mở TRÊN drawer (chưa có thiết kế; dựng theo token). Danh sách = TOÀN BỘ STAFF bản gọn
 * (`StaffList compact`: tên, chức danh • phòng ban, số cảnh báo đang xử lý). Chọn sẵn người phụ trách hiện tại; chọn lại
 * đúng người đó thì nút khoá. Phân công KHÔNG đổi trạng thái cảnh báo.
 * Chỉ mount khi mở (state khởi tạo bằng hàm).
 */
export function AlertAssignModal({
  alert,
  allAlerts,
  onClose,
  onConfirm,
}: {
  alert: AlertRecord;
  allAlerts: readonly AlertRecord[];
  onClose: () => void;
  onConfirm: (assignee: string) => void;
}) {
  const [value, setValue] = useState<string | null>(() => alert.assignee);
  const items = useMemo<StaffPickerItem[]>(() => {
    const load = alertWorkloads(allAlerts);
    return ALERT_STAFF.map((p) => {
      const n = load.get(p.name) ?? 0;
      return { id: p.name, name: p.name, subtitle: `${p.title} • ${p.department}`, shiftLabel: '', busy: false, active: n, overdue: 0, meta: n > 0 ? `${n} đang xử lý` : undefined };
    });
  }, [allAlerts]);
  const unchanged = !value || value === alert.assignee;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={alert.assignee ? 'Đổi người phụ trách' : 'Phân công xử lý'}
      description={`${alert.code} – ${alert.message}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!unchanged && value) onConfirm(value);
      }}
      footerStart={
        <Button variant="plain" onClick={onClose}>
          Hủy
        </Button>
      }
      footer={
        <Button type="submit" variant="primary" disabled={unchanged}>
          {alert.assignee ? 'Đổi người phụ trách' : 'Phân công'}
        </Button>
      }
    >
      <p className="text-sm text-fg-secondary">
        Người phụ trách hiện tại: <span className="text-fg">{alert.assignee ?? 'Chưa có'}</span>. Phân công không đổi trạng thái cảnh báo.
      </p>
      <StaffList compact label="Chọn người phụ trách" items={items} value={value} onChange={setValue} />
    </Modal>
  );
}
