import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCard,
  AssigneeCard,
  AttachmentCard,
  Badge,
  Button,
  Card,
  Checklist,
  checklistSummary,
  DeadlineCountdownCard,
  EventTimeline,
  InfoGrid,
  KpiCard,
  NotesThread,
  SegmentedControl,
  SendIcon,
  StickyActionBar,
  WorkflowStepper,
  type ChecklistItemView,
  type NoteView,
} from '@/components';
import { checklistProgress, toggleChecklistItem } from '@/features/maintenance/checklist';
import { deadlineCountdown } from '@/features/maintenance/deadline';
import { WORKFLOW_STEPS, workflowPosition } from '@/features/maintenance/workflow';
import { useNow } from '@/lib/useNow';
import type { MaintenanceChecklistItem, MaintenanceStatus } from '@/mocks/maintenance';
import { Demo } from './Demo';

const REF = '/figma-ref/mt-detail-design.png';
const STEPS = WORKFLOW_STEPS.map((s) => ({ id: s.status, label: s.label }));

const STATUS_CASES = [
  { id: 'pending', label: 'Chờ tiếp nhận' },
  { id: 'assigned', label: 'Đã phân công' },
  { id: 'in-progress', label: 'Đang thực hiện' },
  { id: 'review', label: 'Chờ nghiệm thu' },
  { id: 'done', label: 'Hoàn thành' },
  { id: 'cancelled', label: 'Đã hủy (từ Đang thực hiện)' },
] as const;

const CHECKLIST: MaintenanceChecklistItem[] = [
  { id: 'c1', text: 'Chuẩn bị dụng cụ và giấy phép làm việc (PTW)', done: true, doneAt: '2026-10-26T10:15' },
  { id: 'c2', text: 'Kiểm tra trực quan tình trạng bên ngoài PSV-101', done: true, doneAt: '2026-10-26T10:45' },
  { id: 'c3', text: 'Sử dụng thiết bị dò siêu âm kiểm tra rò rỉ khí qua seat', done: false, active: true },
  { id: 'c4', text: 'Kiểm tra cáp tín hiệu cảm biến hành trình ZSO/ZSC', done: false },
  { id: 'c7', text: 'Trả lại mặt bằng, dọn dẹp và ký đóng PTW', done: false, na: true },
];
const toView = (items: MaintenanceChecklistItem[]): ChecklistItemView[] =>
  items.map((c) => ({ id: c.id, text: c.text, done: c.done, na: c.na, active: c.active, time: c.doneAt?.slice(11, 16) }));

const LOCK_CASES = [
  { id: 'open', label: 'Được tick (assigned/in-progress)' },
  { id: 'pending', label: 'Khoá – chờ tiếp nhận' },
  { id: 'readonly', label: 'Chỉ đọc (review/done/cancelled)' },
] as const;

const DEADLINE_CASES = [
  { id: 'live', label: 'Chạy thật (hạn +4 giờ 15 phút)' },
  { id: 'figma', label: 'Theo ảnh 04:15:00' },
  { id: 'days', label: '> 24 giờ' },
  { id: 'overdue', label: 'Quá hạn' },
  { id: 'closed', label: 'Đã hoàn thành' },
] as const;

/** Mục 11 – component trang chi tiết yêu cầu bảo trì (ảnh MT-00128, chưa có node Figma; số đo ước lượng). */
export function MaintenanceDetailSection() {
  const [status, setStatus] = useState<MaintenanceStatus>('pending');
  const pos = workflowPosition({ status, cancelledFrom: status === 'cancelled' ? 'in-progress' : undefined });

  const [items, setItems] = useState(CHECKLIST);
  const [lock, setLock] = useState<(typeof LOCK_CASES)[number]['id']>('open');

  const [notes, setNotes] = useState<NoteView[]>([
    { id: 'n1', author: 'Nguyễn Văn A', time: 'Hôm nay 10:50', text: 'Kiểm tra trực quan không thấy rò rỉ bên ngoài. Bắt đầu siêu âm.' },
  ]);

  const now = useNow(1000);
  const [mountedAt] = useState(() => now.getTime());
  const [deadlineCase, setDeadlineCase] = useState<(typeof DEADLINE_CASES)[number]['id']>('live');
  const at = (ms: number) => new Date(ms);
  // Hạn cố định 16:00 ngày 26/10/2026 giờ nhà máy (09:00Z); "now" giả theo từng ca.
  const DUE = '2026-10-26T16:00';
  const countdown =
    deadlineCase === 'live'
      ? deadlineCountdown(DUE, at(Date.parse('2026-10-26T04:45:00Z') + (now.getTime() - mountedAt)))
      : deadlineCase === 'figma'
        ? deadlineCountdown(DUE, at(Date.parse('2026-10-26T04:45:00Z')))
        : deadlineCase === 'days'
          ? deadlineCountdown('2026-10-28T16:00', at(Date.parse('2026-10-26T04:45:00Z')))
          : deadlineCase === 'overdue'
            ? deadlineCountdown(DUE, at(Date.parse('2026-10-26T10:05:30Z')))
            : null;

  const [bar, setBar] = useState(false);
  const [log, setLog] = useState('—');

  return (
    <>
      <p className="text-sm text-fg-muted">
        Trang thật: <Link className="text-accent underline" to="/maintenance/MT-00128">/maintenance/MT-00128</Link> (nhóm 3). Ảnh thiết kế:{' '}
        <code>public/figma-ref/mt-detail-design.png</code>. Lần bấm gần nhất: <span className="text-fg">{log}</span>
      </p>

      <Demo title="Header: Badge severity chip (+ icon) · status md · tag md · WorkflowStepper" refImg={REF}>
        <div className="flex flex-wrap gap-2">
          <Badge variant="severity" value="critical" size="chip" withIcon />
          <Badge variant="severity" value="high" size="chip" />
          <Badge variant="status" value="pending" size="md" withIcon />
          <Badge variant="tag" size="md">
            Bảo trì khẩn cấp
          </Badge>
          <Badge variant="status" value="cancelled" size="md" />
          <Badge variant="status" value="cancelled" />
        </div>
        <SegmentedControl label="Trạng thái" size="sm" options={STATUS_CASES} value={status} onChange={(v) => setStatus(v as MaintenanceStatus)} />
        <WorkflowStepper steps={STEPS} completed={pos.completed} current={pos.current} label="Tiến trình xử lý (mẫu)" />
      </Demo>

      <Demo title="Card divided + InfoGrid (4 cột ≥ xl, 2 cột ≥ sm)">
        <Card title="Thông tin chung" headerVariant="divided" radius="lg" className="max-w-[1022px]">
          <InfoGrid
            items={[
              { id: 'code', label: 'Mã yêu cầu', value: 'MT-00128' },
              { id: 'created', label: 'Ngày/giờ tạo', value: '26/10/2026 08:30' },
              { id: 'by', label: 'Người tạo', value: 'Nguyen Abc' },
              { id: 'src', label: 'Nguồn tạo', value: 'Cảnh báo ALT-00128' },
              { id: 'type', label: 'Loại công việc', value: 'Kiểm tra / Hiệu chuẩn (Khẩn cấp)' },
              { id: 'prio', label: 'Mức ưu tiên', value: 'Nghiêm trọng', tone: 'danger' },
              { id: 'dev', label: 'Thiết bị', value: 'V-101 ↗', tone: 'link' },
              { id: 'area', label: 'Khu vực', value: 'Khu bồn LPG' },
              { id: 'dept', label: 'Phòng ban', value: 'Bảo trì Cơ khí' },
              { id: 'who', label: 'Người phụ trách', value: 'Chưa phân công' },
              { id: 'start', label: 'Thời gian bắt đầu dự kiến', value: '-' },
              { id: 'due', label: 'Hạn hoàn thành', value: '16:00 Hôm nay', tone: 'danger' },
              { id: 'st', label: 'Trạng thái', value: 'Chờ tiếp nhận', tone: 'warning', newRow: true },
            ]}
          />
        </Card>
      </Demo>

      <Demo title="Checklist (tiến độ bỏ mục Không áp dụng) – được tick / khoá / chỉ đọc">
        <SegmentedControl label="Khoá" size="sm" options={LOCK_CASES} value={lock} onChange={(v) => setLock(v as typeof lock)} />
        <Card
          title="Checklist công việc"
          headerVariant="divided"
          radius="lg"
          headerEnd={<span className="text-sm text-fg-secondary">{checklistSummary(checklistProgress(items))}</span>}
          className="max-w-[1022px]"
        >
          <Checklist
            items={toView(items)}
            progress={checklistProgress(items)}
            lockHint={lock === 'pending' ? 'Tiếp nhận yêu cầu trước khi cập nhật checklist.' : lock === 'readonly' ? 'Checklist chỉ đọc ở trạng thái này.' : null}
            onToggle={lock === 'open' ? (id) => setItems((xs) => toggleChecklistItem(xs, id, new Date())) : undefined}
          />
        </Card>
      </Demo>

      <Demo title="NotesThread (thêm ghi chú: Ctrl+Enter hoặc nút) · trống · chỉ đọc">
        <div className="grid max-w-[1022px] gap-4 lg:grid-cols-2">
          <NotesThread
            notes={notes}
            onAdd={(text) => setNotes((ns) => [...ns, { id: `n${ns.length + 1}`, author: 'Admin', time: 'Vừa xong', text }])}
          />
          <div className="flex flex-col gap-4">
            <NotesThread notes={[]} onAdd={() => undefined} />
            <NotesThread notes={notes.slice(0, 1)} />
          </div>
        </div>
      </Demo>

      <Demo title="AttachmentCard (ảnh / tài liệu / hướng dẫn / không có thao tác)">
        <div className="grid max-w-[760px] grid-cols-2 gap-3 md:grid-cols-4">
          <AttachmentCard id="f1" name="hien-truong-psv101.jpg" onView={(id) => setLog(`Xem ${id}`)} onDownload={(id) => setLog(`Tải ${id}`)} />
          <AttachmentCard id="f2" name="bao-cao-kiem-dinh.pdf" onView={(id) => setLog(`Xem ${id}`)} onDownload={(id) => setLog(`Tải ${id}`)} />
          <AttachmentCard id="f3" name="manual-psv101.pdf" kind="manual" meta="4,2 MB" onView={(id) => setLog(`Xem ${id}`)} onDownload={(id) => setLog(`Tải ${id}`)} />
          <AttachmentCard id="f4" name="ten-tep-rat-dai-de-kiem-tra-cat-chu.xlsx" />
        </div>
      </Demo>

      <Demo title="EventTimeline history (chấm theo tone, giờ bên phải)">
        <EventTimeline
          variant="history"
          className="max-w-[1022px]"
          events={[
            { id: 'h1', title: 'Tạo yêu cầu (Auto-Trigger)', time: '08:30', tone: 'success' },
            { id: 'h2', title: 'Gửi thông báo đến bộ phận Bảo trì', time: '08:31', tone: 'neutral' },
            { id: 'h3', title: 'Cập nhật mức ưu tiên: Nghiêm trọng', time: '08:35', tone: 'danger' },
            { id: 'h4', title: 'Tiếp nhận yêu cầu – phụ trách: Admin', time: '11:45', tone: 'info' },
          ]}
        />
      </Demo>

      <Demo title="Cột phải: DeadlineCountdownCard · AssigneeCard · AlertCard compact · KpiCard sm" refImg={REF}>
        <SegmentedControl label="Đồng hồ" size="sm" options={DEADLINE_CASES} value={deadlineCase} onChange={(v) => setDeadlineCase(v as typeof deadlineCase)} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex max-w-[456px] flex-col gap-4">
            <DeadlineCountdownCard countdown={countdown} dueText="16:00 Hôm nay" closedText="Đã hoàn thành" />
            <AssigneeCard assignee={null} department="Bảo trì Cơ khí" shift="Ca 1" onAssign={() => setLog('Phân công')} />
            <AssigneeCard assignee="Nguyễn Văn A" assigneeNote="Bảo trì Cơ khí" department="Bảo trì Cơ khí" shift="Ca 2" onAssign={() => undefined} assignDisabled />
          </div>
          <div className="flex max-w-[456px] flex-col gap-4">
            <Card title="Cảnh báo liên quan" headerVariant="divided" radius="lg">
              <AlertCard
                variant="compact"
                id="ALT-00128"
                severity="critical"
                code="ALT-00128"
                device="V-101"
                message="Áp suất V-101 vượt ngưỡng cảnh báo 1"
                value="11.8 bar"
                threshold="10.5 bar"
                handling="action-required"
                valueLabel="Lúc cảnh báo"
                footer={<span className="text-xs text-accent">Xem chi tiết cảnh báo →</span>}
              />
            </Card>
            <Card title="Thiết bị liên quan" headerVariant="divided" radius="lg">
              <div className="grid grid-cols-2 gap-2">
                <KpiCard size="sm" label="Áp suất" value="11.8" unit="bar" tone="danger" />
                <KpiCard size="sm" label="Nhiệt độ" value="25" unit="°C" />
                <KpiCard size="sm" label="Mức lỏng" value="78.2" unit="%" hint="% thể tích toàn bộ chất lỏng" className="col-span-2" />
                <KpiCard size="sm" label="Nhiệt độ (mất tín hiệu)" value="25" unit="°C" signalLost className="col-span-2" />
              </div>
            </Card>
          </div>
        </div>
      </Demo>

      <Demo title="Button outline / subtle · StickyActionBar (dính đáy, chừa đệm, scroll-padding cho Tab)">
        <div className="flex flex-wrap gap-4">
          <Button variant="subtle">Hủy yêu cầu</Button>
          <Button variant="outline">
            Tiếp nhận ngay
            <SendIcon size={16} />
          </Button>
          <Button variant="outline" disabled>
            Đã khoá
          </Button>
          <Button variant={bar ? 'primary' : 'ghost'} onClick={() => setBar((b) => !b)}>
            {bar ? 'Ẩn thanh dính đáy' : 'Hiện thanh dính đáy'}
          </Button>
        </div>
        {bar && (
          <StickyActionBar label="Thao tác mẫu" start="Mẫu StickyActionBar (playground)">
            <Button variant="subtle" onClick={() => setLog('Hủy yêu cầu')}>
              Hủy yêu cầu
            </Button>
            <Button variant="outline" onClick={() => setLog('Tiếp nhận ngay')}>
              Tiếp nhận ngay
              <SendIcon size={16} />
            </Button>
          </StickyActionBar>
        )}
      </Demo>
    </>
  );
}
