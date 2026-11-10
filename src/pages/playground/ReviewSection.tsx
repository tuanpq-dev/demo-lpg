import { useState } from 'react';
import { Badge, Button, CheckCircleIcon, Checklist, EyeIcon, AlertCircleIcon, KpiCard, StatusOptionGroup, type StatusOption } from '@/components';
import type { MaintenanceRecord } from '@/data/maintenance';
import { checklistProgress } from '@/features/maintenance/checklist';
import { isoDay } from '@/mocks/maintenance';
import { ReviewModal } from '../maintenance/ReviewModal';
import { SubmitReviewModal } from '../maintenance/SubmitReviewModal';
import { Demo } from './Demo';

/**
 * Ảnh thiết kế chỉ nằm ở `scratch/figma-ref/` (gitignore – KHÔNG để trong public/ vì public/ được deploy công khai).
 * Chỉ dev server phục vụ được đường dẫn này; bản build: undefined → Demo không hiện ảnh, chuỗi bị loại khỏi bundle.
 */
const REF_SUBMIT = import.meta.env.DEV ? '/scratch/figma-ref/mt-submit-review-modal-design.png' : undefined;
const REF_REVIEW = import.meta.env.DEV ? '/scratch/figma-ref/mt-review-modal-design.png' : undefined;

const CHECKLIST = [
  'Kiểm tra trực quan',
  'Kiểm tra rò rỉ siêu âm',
  'Ghi nhận áp suất',
  'Tín hiệu cảm biến ZSO/ZSC',
  'Vệ sinh hệ thống làm mát',
  'Chụp ảnh nhật ký',
  'Đề xuất xử lý',
].map((text, i) => ({ id: `c${i + 1}`, text, done: true }));

const base = (): MaintenanceRecord => ({
  id: 'PG-REVIEW',
  code: 'MT-00128',
  title: 'Kiểm tra van an toàn PSV-101',
  device: 'V-101',
  area: 'Khu bồn LPG',
  type: 'inspection',
  priority: 'critical',
  status: 'in-progress',
  assignee: 'Nguyễn Văn A',
  createdAt: isoDay(0),
  dueAt: `${isoDay(0)}T16:00`,
  completedAt: null,
  progress: 100,
  reportedProgress: 100,
  checklist: CHECKLIST,
});

/** Bản ghi đã gửi – người nghiệm thu "Trần Hoàng Nam" (một người cho cả hai modal); số chụp 9.8 bar / 29.4 °C như ảnh. */
const submitted = (): MaintenanceRecord => ({
  ...base(),
  status: 'review',
  submission: {
    summary: 'Đã hoàn thành kiểm tra PSV-101. Không phát hiện rò rỉ tại seat và mặt bích.',
    cause: 'Trễ tín hiệu cảm biến hành trình và mất ổn định hệ thống làm mát cục bộ.',
    remedy: 'Vệ sinh tiếp điểm cảm biến, hiệu chỉnh thông số PID làm mát.',
    deviceCondition: 'normal',
    readings: {
      pressure: { tag: 'PT-101', value: 9.8, warn: 10.5 },
      temperature: { tag: 'TT-101', value: 29.4, warn: 40 },
      at: `${isoDay(0)}T14:30`,
    },
    sensorStatus: 'normal',
    valveStatus: 'stable',
    reviewer: 'Trần Hoàng Nam',
    proposedAt: `${isoDay(0)}T15:30`,
    submittedBy: 'Nguyễn Văn A',
    submittedAt: `${isoDay(0)}T14:30`,
  },
});

const RESULT_OPTIONS: StatusOption[] = [
  { id: 'pass', label: 'Đạt yêu cầu' },
  { id: 'needs-info', label: 'Cần bổ sung', tone: 'warning' },
  { id: 'fail', label: 'Không đạt', tone: 'danger', toneLabel: true },
];
const CONDITION_OPTIONS: StatusOption[] = [
  { id: 'normal', label: 'Hoạt động bình thường', icon: <CheckCircleIcon size={22} /> },
  { id: 'monitor', label: 'Theo dõi thêm', icon: <EyeIcon size={22} />, tone: 'warning' },
  { id: 'unresolved', label: 'Chưa khắc phục', icon: <AlertCircleIcon size={22} />, tone: 'danger' },
];

/** Mục 13 – hai modal nghiệm thu (dữ liệu mẫu, không ghi store) + biến thể component mới. */
export function ReviewSection() {
  const [open, setOpen] = useState<'submit' | 'review' | 'submit-missing' | null>(null);
  const [log, setLog] = useState('');
  const [result, setResult] = useState('pass');
  const [condition, setCondition] = useState('normal');
  const partial = CHECKLIST.map((c, i) => (i > 4 ? { ...c, done: false } : c));
  return (
    <>
      <Demo title="Modal Gửi yêu cầu nghiệm thu (dữ liệu mẫu – không ghi vào store)" refImg={REF_SUBMIT}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setOpen('submit')}>
            Gửi nghiệm thu (checklist 7/7)
          </Button>
          <Button variant="subtle" onClick={() => setOpen('submit-missing')}>
            Chưa đủ điều kiện (5/7)
          </Button>
          <span role="status" className="text-sm text-fg-secondary">
            {log}
          </span>
        </div>
      </Demo>
      <Demo title="Modal Nghiệm thu yêu cầu bảo trì (số chụp 9.8 / 29.4 + số trực tiếp nhỏ bên dưới)" refImg={REF_REVIEW}>
        <Button variant="outline" onClick={() => setOpen('review')}>
          Nghiệm thu
        </Button>
      </Demo>
      <Demo title="StatusOptionGroup layout inline · 3 cột · toneLabel (Không đạt)">
        <StatusOptionGroup label="Kết quả nghiệm thu" layout="inline" columns={3} options={RESULT_OPTIONS} value={result} onChange={setResult} />
      </Demo>
      <Demo title="StatusOptionGroup 3 cột có icon (tình trạng thiết bị)">
        <StatusOptionGroup
          label="Tình trạng thiết bị sau bảo trì"
          columns={3}
          options={CONDITION_OPTIONS}
          value={condition}
          onChange={setCondition}
        />
      </Demo>
      <Demo title="Checklist variant summary (chỉ đọc) · Badge tag success/danger · KpiCard sm align center + footnote">
        <div className="grid gap-6 md:grid-cols-3">
          <Checklist
            variant="summary"
            items={[...partial.slice(0, 6), { id: 'na', text: 'Mục không áp dụng', done: false, na: true }]}
            progress={checklistProgress(partial)}
          />
          <div className="flex flex-col items-start gap-2">
            <Badge variant="tag" size="md" tone="success">
              Đủ điều kiện gửi nghiệm thu
            </Badge>
            <Badge variant="tag" size="md" tone="danger">
              Chưa đủ điều kiện
            </Badge>
            <Badge variant="tag" tone="danger">
              Không đạt nghiệm thu
            </Badge>
          </div>
          <KpiCard size="sm" emphasis align="center" label="Áp suất (bar)" value="9.8" tone="success" footnote="Ngưỡng: 10.5" />
        </div>
      </Demo>

      {(open === 'submit' || open === 'submit-missing') && (
        <SubmitReviewModal
          record={open === 'submit' ? base() : { ...base(), checklist: partial, reportedProgress: 80 }}
          onClose={() => setOpen(null)}
          onSubmit={async (input) => {
            setOpen(null);
            setLog(
              `Gửi: người nghiệm thu ${input.reviewer}, áp suất ${input.readings.pressure?.value ?? '—'} (chụp lúc ${input.readings.at.slice(11)})`,
            );
          }}
        />
      )}
      {open === 'review' && (
        <ReviewModal
          record={submitted()}
          reviewer="Trần Hoàng Nam"
          onClose={() => setOpen(null)}
          onSubmit={async (input) => {
            setOpen(null);
            setLog(`Nghiệm thu: ${input.result}`);
          }}
        />
      )}
    </>
  );
}
