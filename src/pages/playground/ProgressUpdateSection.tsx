import { useState } from 'react';
import {
  AlertOctagonIcon,
  AttachmentCard,
  Badge,
  Button,
  CheckCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  ProgressSlider,
  StatusOptionGroup,
  UploadTile,
  WorkflowStepper,
  type StatusOption,
} from '@/components';
import type { MaintenanceRecord } from '@/data/maintenance';
import { isoDay } from '@/mocks/maintenance';
import { WORKFLOW_STEPS } from '@/features/maintenance/workflow';
import { ProgressUpdateModal } from '../maintenance/ProgressUpdateModal';
import { Demo } from './Demo';

const REF = (import.meta.env.DEV ? '/scratch/figma-ref/mt-progress-modal-design.png' : undefined);

const OPTIONS: StatusOption[] = [
  { id: 'working', label: 'Đang thực hiện', icon: <PlayCircleIcon size={20} /> },
  { id: 'paused', label: 'Tạm dừng', icon: <PauseCircleIcon size={20} />, tone: 'warning' },
  { id: 'blocked', label: 'Gặp sự cố', icon: <AlertOctagonIcon size={20} />, tone: 'danger' },
  { id: 'completed', label: 'Hoàn thành', icon: <CheckCircleIcon size={20} />, disabled: true, disabledHint: 'bắt đầu thực hiện trước khi báo hoàn thành' },
];

const sample = (): MaintenanceRecord => ({
  id: 'PG-PROGRESS',
  code: 'MT-00128',
  title: 'Kiểm tra van an toàn V-101',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  createdAt: isoDay(0),
  dueAt: `${isoDay(0)}T16:00`,
  completedAt: null,
  progress: 33,
  reportedProgress: 50,
  checklist: [
    { id: 'c1', text: 'Chuẩn bị dụng cụ', done: true },
    { id: 'c2', text: 'Kiểm tra trực quan', done: true },
    { id: 'c3', text: 'Siêu âm', done: false },
    { id: 'c4', text: 'Kiểm tra cáp', done: false },
    { id: 'c5', text: 'Vệ sinh', done: false },
    { id: 'c6', text: 'Ghi thông số', done: false },
  ],
  attachments: [
    { id: 'f1', name: 'hien-truong-psv101.jpg', size: 2_480_000, kind: 'image' },
    { id: 'f2', name: 'bao-cao-kiem-dinh.pdf', size: 860_000, kind: 'document' },
    { id: 'f3', name: 'manual-psv101.pdf', size: 4_150_000, kind: 'manual' },
  ],
});

/** Mục 12 – modal "Cập nhật tiến độ bảo trì" + component mới (StatusOptionCard, ProgressSlider, UploadTile). */
export function ProgressUpdateSection() {
  const [state, setState] = useState('working');
  const [pct, setPct] = useState(50);
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState('');
  return (
    <>
      <Demo title="Modal đầy đủ (dữ liệu mẫu – không ghi vào store)" refImg={REF}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setOpen(true)}>
            Cập nhật tiến độ
          </Button>
          <span role="status" className="text-sm text-fg-secondary">
            {log}
          </span>
        </div>
        {open && (
          <ProgressUpdateModal
            record={sample()}
            onClose={() => setOpen(false)}
            onOpenChecklist={() => {
              setOpen(false);
              setLog('Mở checklist (trang chi tiết cuộn tới khối Checklist)');
            }}
            onSubmit={async (input) => {
              setOpen(false);
              setLog(`Gửi: ${JSON.stringify({ ...input, files: input.files?.length ?? 0 })}`);
            }}
            onContinueToSubmit={(p) => {
              setOpen(false);
              setLog(`Tiếp tục gửi nghiệm thu (mục 13): "${p.text}", ${p.files.length} tệp`);
            }}
          />
        )}
      </Demo>

      <Demo title="StatusOptionGroup (radiogroup – mũi tên chuyển; ô Hoàn thành disabled khi Đã phân công)">
        <StatusOptionGroup label="Trạng thái công việc" options={OPTIONS} value={state} onChange={setState} />
      </Demo>

      <Demo title="ProgressSlider (bước 5 · ←→ ±5 · PageUp/PageDown ±10 · Home/End · kéo trên rãnh) – nút kéo 16px là phần thêm ngoài Figma">
        <ProgressSlider label="Tiến độ hoàn thành" value={pct} onChange={setPct} />
      </Demo>

      <Demo title="AttachmentCard fluid + notice · UploadTile">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <AttachmentCard fluid id="a" name="hien-truong-psv101.jpg" onView={() => setLog('Xem')} onDownload={() => setLog('Tải')} />
          <AttachmentCard fluid id="b" name="anh-moi.png" meta="1,2 MB" notice="Chưa tải lên máy chủ" onView={() => setLog('Xem tệp tạm')} />
          <AttachmentCard fluid id="c" name="manual-psv101.pdf" kind="manual" />
          <UploadTile accept=".png,.jpg,.pdf" onFiles={(f) => setLog(`Chọn ${f.length} tệp: ${f.map((x) => x.name).join(', ')}`)} />
        </div>
      </Demo>

      <Demo title="Cờ phụ khi đang thực hiện: Badge tag warning/danger · stepper nhãn phụ (vẫn bước 3)">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="status" value="in-progress" withIcon>
            Đang thực hiện
          </Badge>
          <Badge variant="tag" tone="warning">
            Tạm dừng
          </Badge>
          <Badge variant="tag" tone="danger">
            ⚠ Gặp sự cố
          </Badge>
          <Badge variant="tag" size="md" tone="danger">
            Gặp sự cố
          </Badge>
        </div>
        <WorkflowStepper
          steps={WORKFLOW_STEPS.map((s) => ({ id: s.status, label: s.label, ...(s.status === 'in-progress' ? { note: 'Gặp sự cố', noteTone: 'danger' as const } : {}) }))}
          completed={3}
          current={3}
          label="Mẫu stepper gặp sự cố"
        />
      </Demo>
    </>
  );
}
