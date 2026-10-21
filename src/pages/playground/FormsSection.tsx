import { useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  DetailDrawer,
  EventTimeline,
  FormField,
  Modal,
  PriorityTaskCard,
  Select,
  TextField,
  Textarea,
  type WorkStatus,
} from '@/components';
import { derivePriorityTasks, deriveSchedule, PRIORITY_OPTIONS } from '@/data/maintenance';
import { isoDay, maintenanceRecords } from '@/mocks/maintenance';
import { FigmaRef } from './FigmaRef';
import { ModalPartsDemo } from './ModalPartsDemo';

const MAINT = '/figma-ref/70-3964-maintenance.png';

function Demo({ title, node, children }: { title: string; node: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h3 className="text-md font-semibold">{title}</h3>
        <span className="font-mono text-xs text-fg-muted/60">Figma {node}</span>
      </div>
      <div className="flex flex-col gap-4 overflow-x-auto rounded-lg border border-dashed border-line/30 p-4">{children}</div>
    </div>
  );
}

const statuses: WorkStatus[] = ['pending', 'assigned', 'in-progress', 'review', 'done'];

export function FormsSection() {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [prio, setPrio] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [clicked, setClicked] = useState('—');

  return (
    <div className="flex flex-col gap-10">
      <Demo title="PriorityTaskCard" node="70:4581 · 70:4601 · 70:4621">
        <div className="grid w-[1503px] grid-cols-3 gap-3">
          {derivePriorityTasks(maintenanceRecords, new Date()).map((t) => (
            <PriorityTaskCard key={t.id} {...t} onDetail={(id) => setClicked(id)} />
          ))}
        </div>
        <FigmaRef src={MAINT} x={31} y={394} w={1503} h={150} />
        <p className="font-mono text-xs text-fg-muted/60">Chi tiết: {clicked}</p>
      </Demo>

      <div className="grid gap-10 xl:grid-cols-2">
        <Demo title="EventTimeline variant=schedule (Lịch sắp tới)" node="70:4889 (màu đọc từ ảnh chụp)">
          <div className="flex flex-wrap items-start gap-6">
            <Card title="Lịch sắp tới" headerVariant="plain" action={{ label: 'Xem lịch' }} className="w-[346px]">
              <EventTimeline variant="schedule" events={deriveSchedule(maintenanceRecords, new Date())} />
            </Card>
            <FigmaRef src={MAINT} x={1187} y={621} w={346} h={216} />
          </div>
        </Demo>

        <Demo title="Badge status – thêm assigned / review" node="70:5563 · 70:5433">
          <div className="flex flex-wrap gap-3">
            {statuses.map((s) => (
              <Badge key={s} variant="status" value={s} withIcon />
            ))}
          </div>
        </Demo>
      </div>

      <Demo title="Modal Tạo yêu cầu bảo trì – thành phần (Combobox · SegmentedControl field · ChecklistEditor · FileDropzone · TempIcons)" node="ảnh thiết kế người dùng gửi">
        <div className="flex flex-wrap items-start gap-6">
          <a href="/maintenance?create=1" className="rounded-sm text-sm text-accent underline">Mở modal thật trên /maintenance →</a>
          <figure className="flex flex-col gap-2">
            <figcaption className="text-xs text-fg-muted/60">Thiết kế (tham chiếu)</figcaption>
            <img src="/figma-ref/mt-create-modal-design.png" alt="Thiết kế modal tạo yêu cầu bảo trì" className="max-w-[660px] rounded-sm border border-dashed border-line/30" />
          </figure>
        </div>
        <ModalPartsDemo />
      </Demo>

      <Demo title="FormField · TextField · Textarea · DatePicker · Select field" node="– (Figma chưa có form)">
        <div className="grid max-w-[640px] grid-cols-2 gap-4">
          <TextField
            label="Tên thiết bị"
            required
            value={name}
            onChange={setName}
            placeholder="V-101"
            error={showErrors && !name ? 'Nhập tên thiết bị.' : undefined}
          />
          <FormField label="Mức ưu tiên" required error={showErrors && !prio ? 'Chọn mức ưu tiên.' : undefined}>
            {({ id, labelId, describedBy, invalid }) => (
              <Select
                variant="field"
                id={id}
                labelledBy={labelId}
                describedBy={describedBy}
                invalid={invalid}
                label="Mức ưu tiên"
                placeholder="Chọn mức ưu tiên"
                options={PRIORITY_OPTIONS}
                value={prio}
                onChange={setPrio}
              />
            )}
          </FormField>
          <DatePicker
            label="Hạn xử lý"
            required
            value={date}
            min={isoDay(0)}
            onChange={setDate}
            hint="Không trước hôm nay"
            error={showErrors && !date ? 'Chọn hạn xử lý.' : undefined}
          />
          <TextField label="Đã khoá" value="Không sửa được" onChange={() => undefined} disabled />
          <Textarea
            label="Mô tả"
            required
            value={desc}
            onChange={setDesc}
            maxLength={300}
            showCount
            className="col-span-2"
            error={showErrors && desc.trim().length < 5 ? 'Ít nhất 5 ký tự.' : undefined}
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowErrors((v) => !v)}>{showErrors ? 'Ẩn lỗi' : 'Hiện lỗi validate'}</Button>
          <Button variant="primary" onClick={() => setModal(true)}>
            Mở Modal
          </Button>
          <Button onClick={() => setDrawer(true)}>Mở DetailDrawer</Button>
        </div>
      </Demo>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Modal mẫu"
        description="Figma chưa có thiết kế – dựng theo token."
        footer={
          <>
            <Button onClick={() => setModal(false)}>Huỷ</Button>
            <Button variant="primary" onClick={() => setModal(false)}>
              Đồng ý
            </Button>
          </>
        }
      >
        <TextField label="Ghi chú" value={name} onChange={setName} />
      </Modal>

      <DetailDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        eyebrow="Chi tiết"
        title="MT-00128"
        badges={<Badge variant="severity" value="critical" size="md" />}
        description="Kiểm tra van an toàn PSV-101"
        fields={[
          { label: 'Thiết bị', value: 'V-101' },
          { label: 'Khu vực', value: 'Bồn chứa' },
        ]}
        actions={<Button variant="primary" onClick={() => setDrawer(false)}>Đóng</Button>}
      />
    </div>
  );
}
