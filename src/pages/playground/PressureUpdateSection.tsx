import { useState } from 'react';
import { BeforeAfterReadings, Button, Checkbox, InspectionTable } from '@/components';
import { liveSimulator } from '@/data/live';
import { INSPECTION_STATUSES, INSPECTION_STATUS_LABEL, type InspectionStatus } from '@/features/alerts/inspection';
import { pressureUpdate } from '@/features/alerts/pressure';
import { V101_TAGS } from '@/features/live/tags';
import { alertRecords, type AlertRecord } from '@/mocks/alerts';
import PressureUpdateModal from '../alerts/PressureUpdateModal';
import { Demo } from './Demo';

/** Ảnh thiết kế chỉ ở máy dev (`scratch/figma-ref/`, gitignore); bản build: undefined (không đóng gói). */
const REF = import.meta.env.DEV ? '/scratch/figma-ref/alert-pressure-update-modal-design.png' : undefined;
const base = alertRecords.find((a) => a.id === 'ALT-00128')!;
const at = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00+07:00`).toISOString();
/** Như ảnh: Đang xử lý, 2 hạng mục đã kiểm tra (Đạt / Có vấn đề), bộ điều áp bất thường. */
const SAMPLE: AlertRecord = {
  ...base,
  status: 'in-progress',
  phase: 'resolving',
  assignee: 'Nguyễn Văn A',
  acknowledgedAt: at('10:48'),
  guide: {
    'field-gauge': { status: 'pass', by: 'Nguyễn Văn A', at: at('10:50'), note: 'Khớp nhau' },
    regulator: { status: 'issue', by: 'Nguyễn Văn A', at: at('10:55'), note: 'Kẹt cơ cấu' },
  },
  verification: ['regulator-fault'],
};
const FIXED_NOW = new Date(at('14:06'));

const STATUS_OPTIONS = INSPECTION_STATUSES.map((s) => ({ value: s, label: INSPECTION_STATUS_LABEL[s] }));

/**
 * Mục 17 – modal "Cập nhật xử lý cảnh báo áp suất" (ảnh 28/10/2026): modal đầy đủ cạnh ảnh (dữ liệu mẫu, giờ cố định 14:06,
 * KHÔNG ghi store) + component mới InspectionTable, BeforeAfterReadings, Checkbox card. Nút mô phỏng PT-101 (dev).
 */
export function PressureUpdateSection() {
  const [open, setOpen] = useState(false);
  const [rec, setRec] = useState<AlertRecord>(SAMPLE);
  const [log, setLog] = useState('');
  const [rows, setRows] = useState<Record<string, { status: InspectionStatus; note: string }>>({
    a: { status: 'pass', note: 'Khớp nhau' },
    b: { status: 'issue', note: '' },
  });
  const [after, setAfter] = useState<number | undefined>(10.8);
  const [checks, setChecks] = useState<string[]>(['b']);
  return (
    <>
      <Demo title="Modal cập nhật xử lý áp suất (dữ liệu mẫu ALT-00128, không ghi store)" refImg={REF}>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setRec(SAMPLE);
              setOpen(true);
            }}
          >
            Mở modal (Đang xử lý, theo ảnh)
          </Button>
          <Button onClick={() => liveSimulator.rampTo(V101_TAGS.pressure, 9.2)}>PT-101 về 9.2 bar (dưới ngưỡng)</Button>
          <Button onClick={() => liveSimulator.rampTo(V101_TAGS.pressure, 11.2)}>PT-101 tăng tới 11.2 bar</Button>
          <Button onClick={() => liveSimulator.setBad([V101_TAGS.pressure], !liveSimulator.state.bad.includes(V101_TAGS.pressure))}>Bật/tắt mất tín hiệu PT-101</Button>
        </div>
        {log && (
          <p role="status" className="text-sm text-fg-secondary">
            {log}
          </p>
        )}
      </Demo>
      {open && (
        <PressureUpdateModal
          alert={rec}
          actor="Playground"
          fixedNow={FIXED_NOW}
          onClose={() => setOpen(false)}
          onSubmit={(input, check) => {
            const res = pressureUpdate(rec, input, check, { by: 'Playground', at: FIXED_NOW });
            if (res.ok) {
              setRec(res.record);
              setOpen(false);
              setLog(`Đã lưu (không ghi store): ${res.record.history?.at(-1)?.text ?? ''}`);
            }
            return res;
          }}
        />
      )}

      <Demo title="InspectionTable – trạng thái theo hạng mục, ghi chú inline, lỗi &quot;Có vấn đề&quot; thiếu ghi chú">
        <InspectionTable<InspectionStatus>
          caption="Bảng mẫu hạng mục kiểm tra"
          statusOptions={STATUS_OPTIONS}
          rows={[
            { id: 'a', text: 'Đối chiếu PT-101 với đồng hồ cơ', by: 'Nguyễn Văn A', time: '10:50', ...rows.a! },
            { id: 'b', text: 'Kiểm tra bộ điều áp PR-101', by: 'Nguyễn Văn A', time: '10:55', ...rows.b!, error: rows.b!.status === 'issue' && !rows.b!.note ? 'Nhập ghi chú cho hạng mục có vấn đề.' : undefined },
          ]}
          onStatusChange={(id, status) => setRows((r) => ({ ...r, [id]: { ...r[id]!, status } }))}
          onNoteChange={(id, note) => setRows((r) => ({ ...r, [id]: { ...r[id]!, note } }))}
        />
      </Demo>

      <Demo title="BeforeAfterReadings – trước (lúc cảnh báo) → sau (live / đo tay), màu theo ngưỡng">
        <BeforeAfterReadings
          label="Thông số mẫu"
          rows={[
            { id: 'p', label: 'Áp suất V-101', limit: 'Giới hạn: 10.5 bar', unit: 'bar', before: 11.8, after, beforeTone: 'warning', afterTone: after !== undefined && after >= 10.5 ? 'warning' : 'normal', editable: true },
            { id: 'r', label: 'Áp suất sau PR-101', unit: 'bar', after: 4.2, editable: false },
            { id: 't', label: 'Nhiệt độ bồn', unit: '°C', before: 31.6, editable: false, afterPlaceholder: 'Mất tín hiệu' },
          ]}
          onAfterChange={(_, val) => setAfter(val)}
        />
      </Demo>

      <Demo title="Checkbox variant=&quot;card&quot; – chọn nhiều, mục khoá bằng aria-disabled">
        <div className="flex max-w-xl flex-col gap-3">
          {[
            { id: 'a', label: 'Xác nhận áp suất thực tế vượt ngưỡng' },
            { id: 'b', label: 'Bộ điều áp PR-101 có bất thường' },
            { id: 'c', label: 'Hệ thống đã trở về bình thường (khoá)', locked: true },
          ].map((c) => (
            <Checkbox
              key={c.id}
              variant="card"
              label={c.label}
              checked={checks.includes(c.id)}
              aria-disabled={c.locked || undefined}
              onChange={(on) => setChecks((cur) => (on ? [...cur, c.id] : cur.filter((x) => x !== c.id)))}
            />
          ))}
        </div>
      </Demo>
    </>
  );
}
