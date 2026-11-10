import { useState } from 'react';
import { Button, SearchInput, StaffFilters, StaffList, type StaffPickerItem } from '@/components';
import { alertRecords } from '@/mocks/alerts';
import type { AlertRecord } from '@/features/alerts/types';
import { AlertAssignModal } from '../alerts/AlertAssignModal';
import { AlertAssignSummary } from '../alerts/AlertAssignSummary';
import { Demo } from './Demo';

/** Ảnh thiết kế chỉ ở máy dev (`scratch/figma-ref/`, gitignore); bản build: undefined (không đóng gói). */
const REF = import.meta.env.DEV ? '/scratch/figma-ref/alert-assign-modal-design.png' : undefined;

/** 10:45 giờ nhà máy như ảnh (Ca 1 đang làm) – để thấy đủ Sẵn sàng / Bận / Ngoài ca bất kể giờ máy. */
const NOW = new Date(`${new Date().toISOString().slice(0, 10)}T10:45:00+07:00`);

const find = (id: string) => alertRecords.find((a) => a.id === id)!;
/** Tải việc mẫu theo ảnh: Trần Bình ("Trần Minh B" trong ảnh) đang có 3 cảnh báo → Bận. */
const LOAD: AlertRecord[] = [
  ...alertRecords,
  { ...find('ALT-00119'), id: 'PG-1', code: 'PG-1', assignee: 'Trần Bình' },
  { ...find('ALT-00119'), id: 'PG-2', code: 'PG-2', assignee: 'Trần Bình', status: 'in-progress' },
  { ...find('ALT-00119'), id: 'PG-3', code: 'PG-3', assignee: 'Trần Bình' },
];

const SAMPLES: Record<string, { label: string; alerts: AlertRecord[] }> = {
  single: { label: 'ALT-00128 – chưa phân công (theo ảnh)', alerts: [find('ALT-00128')] },
  reassign: { label: 'ALT-00127 – đổi người (đang giao Nguyễn Văn A)', alerts: [find('ALT-00127')] },
  noValue: { label: 'ALT-00122 – mất tín hiệu (ẩn "Lúc cảnh báo")', alerts: [find('ALT-00122')] },
  bulk: { label: 'Hàng loạt – 4 cảnh báo (1 hoàn thành, 2 đang có người)', alerts: ['ALT-00128', 'ALT-00125', 'ALT-00124', 'ALT-00127'].map(find) },
};

const CARD_ITEMS: StaffPickerItem[] = [
  {
    id: 'a',
    name: 'Nguyễn Văn A',
    subtitle: 'Kỹ sư cơ khí • Chuyên gia Van/Bồn',
    shiftLabel: 'Ca 1',
    shiftMatch: true,
    busy: false,
    active: 1,
    overdue: 0,
    availability: 'available',
    loadLabel: '1 cảnh báo đang xử lý',
    suggestion: 'Cùng khu · Đúng chuyên môn',
  },
  {
    id: 'b',
    name: 'Trần Bình',
    subtitle: 'Kỹ thuật viên cơ khí • Thiết bị áp lực',
    shiftLabel: 'Ca 1',
    shiftMatch: true,
    busy: true,
    active: 3,
    overdue: 1,
    availability: 'busy',
    loadLabel: '3 cảnh báo đang xử lý (1 nghiêm trọng)',
  },
  {
    id: 'c',
    name: 'Lê Thị C',
    subtitle: 'Kỹ thuật viên đo lường • Cảm biến',
    shiftLabel: 'Ca 2',
    busy: false,
    active: 0,
    overdue: 0,
    availability: 'off-shift',
    loadLabel: '0 cảnh báo đang xử lý',
  },
];

/**
 * Mục 16 – modal "Phân công xử lý cảnh báo" (dữ liệu mẫu, KHÔNG ghi store) cạnh ảnh, thẻ đầu (một / hàng loạt),
 * StaffPickerCard có xét ca (Sẵn sàng / Bận / Ngoài ca), StaffFilters.
 */
export function AlertAssignSection() {
  const [open, setOpen] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [pick, setPick] = useState<string | null>('a');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<string | null>(null);
  const [shift, setShift] = useState<string | null>(null);
  const [onShift, setOnShift] = useState(false);
  return (
    <>
      <Demo title="Modal phân công xử lý cảnh báo (dữ liệu mẫu, giờ cố định 10:45, không ghi store)" refImg={REF}>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SAMPLES).map(([k, s]) => (
            <Button key={k} onClick={() => setOpen(k)}>
              {s.label}
            </Button>
          ))}
        </div>
        <p role="status" className="text-sm text-fg-secondary">
          {result || 'Ảnh thiết kế chỉ hiện trên máy dev. Xác nhận ở đây chỉ hiện form đã gửi.'}
        </p>
      </Demo>
      {open && (
        <AlertAssignModal
          alerts={SAMPLES[open]!.alerts}
          allAlerts={LOAD}
          now={NOW}
          onClose={() => setOpen(null)}
          onConfirm={(form) => {
            setResult(`Đã gửi (mẫu): ${JSON.stringify(form)}`);
            setOpen(null);
          }}
        />
      )}
      <Demo title="Thẻ đầu: một cảnh báo · không có giá trị số · hàng loạt">
        <div className="flex flex-col gap-4">
          <AlertAssignSummary alerts={[find('ALT-00128')]} now={NOW} />
          <AlertAssignSummary alerts={[find('ALT-00122')]} now={NOW} />
          <AlertAssignSummary alerts={SAMPLES.bulk!.alerts} now={NOW} />
        </div>
      </Demo>
      <Demo title="StaffPickerCard có xét ca (Sẵn sàng / Bận / Ngoài ca – vẫn chọn được) · StaffFilters">
        <div className="flex max-w-xl flex-col gap-3">
          <StaffFilters
            search={<SearchInput value={q} onChange={setQ} placeholder="Tìm kiếm theo tên..." label="Tìm kiếm nhân sự (mẫu)" />}
            departments={[{ value: 'co-khi', label: 'Bảo trì Cơ khí' }]}
            department={dept}
            onDepartmentChange={setDept}
            shifts={[
              { value: 'shift-1', label: 'Ca 1' },
              { value: 'shift-2', label: 'Ca 2' },
            ]}
            shift={shift}
            onShiftChange={setShift}
            onShiftOnly={onShift}
            onShiftOnlyChange={setOnShift}
          />
          <StaffList label="Nhân sự (mẫu)" items={CARD_ITEMS} value={pick} onChange={setPick} />
        </div>
      </Demo>
    </>
  );
}
