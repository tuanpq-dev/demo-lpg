import { useState } from 'react';
import { Avatar, Button, StaffList, Switch, type StaffPickerItem } from '@/components';
import { useMaintenance, type MaintenanceRecord } from '@/data/maintenance';
import { isoDay } from '@/mocks/maintenance';
import { AssignModal } from '../maintenance/AssignModal';
import { Demo } from './Demo';

/** Ảnh Figma chỉ ở máy dev (`scratch/figma-ref/`, gitignore); bản build: undefined (không đóng gói). */
const REF_ASSIGN = import.meta.env.DEV ? '/scratch/figma-ref/mt-assign-modal-design.png' : undefined;

/** Bản ghi mẫu theo ảnh (tiêu đề PSV-101) – không ghi vào store. */
const sample = (patch: Partial<MaintenanceRecord> = {}): MaintenanceRecord => ({
  id: 'PG-ASSIGN',
  code: 'MT-00128',
  title: 'Kiểm tra van an toàn PSV-101',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'pending',
  assignee: null,
  createdAt: isoDay(0),
  dueAt: `${isoDay(0)}T16:00`,
  completedAt: null,
  progress: 0,
  ...patch,
});

const ITEMS: StaffPickerItem[] = [
  {
    id: 'a',
    name: 'Nguyễn Văn A',
    subtitle: 'Cơ khí • Chuyên gia Van/Bồn',
    shiftLabel: 'Ca 2',
    shiftMatch: true,
    busy: false,
    active: 1,
    overdue: 0,
  },
  { id: 'b', name: 'Trần Bình', subtitle: 'Cơ khí • Thiết bị áp lực', shiftLabel: 'Ca 1', busy: true, active: 3, overdue: 1 },
  { id: 'c', name: 'Lê Thị C', subtitle: 'Đo lường • Cảm biến', shiftLabel: 'Ca 2', shiftMatch: true, busy: false, active: 0, overdue: 0 },
];

/** Mục 14 – modal "Phân công người xử lý" + StaffList/StaffPickerCard, Switch, Avatar. */
export function AssignSection() {
  const [open, setOpen] = useState<'assign' | 'reassign' | null>(null);
  const [log, setLog] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const { data } = useMaintenance();
  return (
    <>
      <Demo title="Modal Phân công người xử lý (dữ liệu mẫu – không ghi vào store; tải việc tính từ mock)" refImg={REF_ASSIGN}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setOpen('assign')}>
            Phân công (Chờ tiếp nhận)
          </Button>
          <Button variant="subtle" onClick={() => setOpen('reassign')}>
            Đổi người (Đang thực hiện)
          </Button>
          <span role="status" className="text-sm text-fg-secondary">
            {log}
          </span>
        </div>
      </Demo>
      <Demo title="StaffList (radiogroup, không chọn sẵn) · StaffPickerCard (Sẵn sàng / Bận / quá hạn)">
        <div className="max-w-[520px]">
          <StaffList label="Nhân sự mẫu" items={ITEMS} value={picked} onChange={setPicked} />
        </div>
      </Demo>
      <Demo title="Switch · Avatar (sm / md / lg)">
        <div className="flex flex-col gap-4">
          <Switch
            label="Gửi thông báo đẩy và SMS cho người được phân công"
            description="Chưa gửi được – chờ backend."
            checked={notify}
            onChange={setNotify}
          />
          <div className="flex items-center gap-3">
            <Avatar name="Nguyễn Văn A" size="sm" />
            <Avatar name="Trần Bình" size="md" />
            <Avatar name="Lê Thị C" size="lg" />
          </div>
        </div>
      </Demo>
      {open && (
        <AssignModal
          record={open === 'assign' ? sample() : sample({ status: 'in-progress', assignee: 'Trần Bình', shift: 'shift-1' })}
          records={data ?? []}
          onClose={() => setOpen(null)}
          onSubmit={async (f) => {
            setOpen(null);
            setLog(`Xác nhận: ${f.assignee}${f.collaborators.length ? ` + ${f.collaborators.join(', ')}` : ''}, hạn ${f.dueAt.slice(11)}`);
          }}
        />
      )}
    </>
  );
}
