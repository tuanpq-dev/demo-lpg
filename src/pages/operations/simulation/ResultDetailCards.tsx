/** Thẻ chi tiết màn kết quả mô phỏng: tiêu chí, điểm, khuyến nghị AI, cảnh báo, số liệu tham chiếu, báo cáo. Tách từ ResultCards.tsx. */
import { useId, useState } from 'react';
import {
  AiSparklesIcon,
  Badge,
  Button,
  Card,
  CheckCircleIcon,
  DataTable,
  Icon,
  PdfFileIcon,
  PreviewIcon,
  ProgressBar,
  SheetIcon,
  SignalLostIcon,
  SyncIcon,
  type DataTableColumn,
} from '@/components';
import type { SimulationSession } from '@/features/simulation/monitor';
import { CHECK_LABEL, type Criterion, type SimulationResult } from '@/features/simulation/result';
import { cn } from '@/lib/cn';

const CRITERIA_COLUMNS: readonly DataTableColumn<Criterion>[] = [
  { id: 'label', header: 'Tiêu chí', align: 'start', cell: (c) => <span className="block text-base text-fg md:pl-6">{c.label}</span>, width: '26%' },
  {
    id: 'result',
    header: 'Kết quả',
    align: 'start',
    width: 120,
    cell: (c) => (
      <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', c.result === 'pass' ? 'text-success' : 'text-warning')}>
        <CheckCircleIcon size={16} className="shrink-0" />
        {CHECK_LABEL[c.result]}
      </span>
    ),
  },
  { id: 'comment', header: 'Nhận xét', align: 'start', cell: (c) => <span className="text-base text-fg-secondary">{c.comment}</span> },
];

/** "Đánh giá phản ứng hệ thống" (ảnh `17.png`). */
export function CriteriaCard({ criteria }: { criteria: readonly Criterion[] }) {
  return (
    <Card title="Đánh giá phản ứng hệ thống" headerVariant="plain" radius="lg" titleSize="lg" padding="md" aria-label="Đánh giá phản ứng hệ thống">
      <DataTable
        columns={CRITERIA_COLUMNS}
        rows={criteria}
        getRowId={(c) => c.id}
        label="Đánh giá phản ứng hệ thống"
        headerStyle="plain"
        density="compact"
        minWidth={640}
      />
    </Card>
  );
}

/** "Điểm làm tốt" / "Điểm cần cải thiện" (ảnh `22.png`). */
export function PointsCards({ strengths, improvements }: { strengths: readonly string[]; improvements: readonly string[] }) {
  const block = (title: string, items: readonly string[], tone: 'success' | 'primary') => (
    <Card
      title={<span className={tone === 'success' ? 'text-success' : 'text-primary'}>{title}</span>}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      tone={tone}
      aria-label={title}
    >
      <ul className="-mt-1 flex list-disc flex-col gap-2 pl-5 text-base text-fg-secondary marker:text-fg-secondary">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </Card>
  );
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 wide:gap-4">
      {block('Điểm làm tốt', strengths, 'success')}
      {block('Điểm cần cải thiện', improvements, 'primary')}
    </div>
  );
}

export type ResultAdviceCardProps = {
  advice: string;
  confidence: number | undefined;
  included: boolean;
  dismissed: boolean;
  canEdit: boolean;
  busy: boolean;
  onInclude: () => void;
  onDismiss: () => void;
  onUndo: () => void;
};

/** "Gợi ý từ AI" (ảnh `10.png`): thanh độ tin cậy + câu gợi ý + "Thêm vào báo cáo" / "Bỏ qua". */
export function ResultAdviceCard({ advice, confidence, included, dismissed, canEdit, busy, onInclude, onDismiss, onUndo }: ResultAdviceCardProps) {
  return (
    <Card
      title="Gợi ý từ AI"
      icon={<AiSparklesIcon size={22} className="shrink-0 text-primary" />}
      headerVariant="plain"
      radius="lg"
      titleSize="lg"
      aria-label="Gợi ý từ AI"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-line/40 bg-surface-raised px-3 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-fg-secondary" title="Giả định: 60 % tỉ lệ thông số khả dụng + 40 % tỉ lệ kịch bản đã chạy trong 7 ngày">
              Độ tin cậy đề xuất
            </span>
            <span className="text-md tabular-nums text-primary">{confidence === undefined ? '—' : `${confidence}%`}</span>
          </div>
          <ProgressBar value={confidence ?? 0} max={100} tone="primary" track="solid" label="Độ tin cậy đề xuất" />
        </div>
        <p className={cn('text-base leading-6', dismissed ? 'text-fg-secondary' : 'text-fg')}>{advice}</p>
        {canEdit &&
          (included || dismissed ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={included ? 'text-success' : 'text-fg-secondary'}>
                {included ? 'Đã thêm gợi ý vào báo cáo nháp.' : 'Đã bỏ qua gợi ý cho báo cáo này.'}
              </span>
              <Button variant="link" size="md" onClick={onUndo} aria-busy={busy || undefined}>
                {included ? 'Bỏ khỏi báo cáo' : 'Xem lại gợi ý'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="primary" className="flex-1" onClick={onInclude} aria-busy={busy || undefined}>
                Thêm vào báo cáo
              </Button>
              <Button variant="ghost" onClick={onDismiss} aria-busy={busy || undefined}>
                Bỏ qua
              </Button>
            </div>
          ))}
      </div>
    </Card>
  );
}

/** "Cảnh báo mô phỏng đã tạo" (ảnh `21.png`): viền trái theo mức, mã màu, nhãn "Mô phỏng", mô tả, SIM_TIMESTAMP. */
export function ResultAlertsCard({ alerts }: { alerts: SimulationResult['alerts'] }) {
  return (
    <Card title="Cảnh báo mô phỏng đã tạo" headerVariant="plain" radius="lg" titleSize="lg" aria-label="Cảnh báo mô phỏng đã tạo">
      {alerts.length === 0 ? (
        <p className="text-base text-fg-secondary">Lượt mô phỏng không phát sinh cảnh báo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border-l-4 bg-surface-raised px-4 py-3',
                a.tone === 'danger' ? 'border-l-danger' : 'border-l-warning',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn('text-md font-semibold', a.tone === 'danger' ? 'text-danger-text' : 'text-warning')}>{a.id}</span>
                <Badge variant="tag" size="sm" tone="warning" className="rounded-md border-transparent px-2">
                  Mô phỏng
                </Badge>
              </div>
              <p className="text-sm leading-5 text-fg-secondary">{a.description}</p>
              <p className="text-xs tabular-nums text-fg-secondary">SIM_TIMESTAMP: {a.time}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** "Dữ liệu PLC/SCADA tham chiếu" (ảnh `20.png`): trạng thái đồng bộ lúc bắt đầu + giá trị nền chụp lại; "Xem chi tiết" mở toàn bộ. */
export function ResultReferenceCard({ session }: { session: SimulationSession }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const h = session.referenceHealth;
  const synced = !!h && h.ok === h.total;
  const short = session.reference.filter((r) => r.shortLabel);
  const value = (t: string | null) =>
    t ?? (
      <span className="inline-flex items-center gap-1 font-normal text-fg-secondary">
        <SignalLostIcon size={14} className="shrink-0" />
        Mất tín hiệu
      </span>
    );
  return (
    <Card title="Dữ liệu PLC/SCADA tham chiếu" headerVariant="plain" radius="lg" titleSize="lg" aria-label="Dữ liệu PLC/SCADA tham chiếu">
      <div className="flex flex-col gap-3">
        <p
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
            !h
              ? 'border-line/40 text-fg-secondary'
              : synced
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-warning/40 bg-warning/10 text-warning',
          )}
        >
          <SyncIcon size={16} className="shrink-0" />
          {!h
            ? 'Chưa có thông tin đồng bộ lúc bắt đầu.'
            : synced
              ? 'Đã đồng bộ dữ liệu thời gian thực làm nền.'
              : `Thiếu ${h.total - h.ok}/${h.total} thông số lúc bắt đầu.`}
        </p>
        <dl className="flex flex-col text-base">
          <div className="flex items-center justify-between gap-3 border-b border-line/30 py-2">
            <dt className="text-fg-secondary">Số biến tham chiếu</dt>
            <dd className="font-semibold text-fg">{h ? `${h.ok} Parameters` : '—'}</dd>
          </div>
          {short.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line/30 py-2 last:border-b-0">
              <dt className="text-fg-secondary">{r.shortLabel}</dt>
              <dd className="font-semibold tabular-nums text-fg">{value(r.valueText)}</dd>
            </div>
          ))}
        </dl>
        {open && (
          <dl id={detailId} className="flex flex-col gap-2 rounded-lg border border-line/30 bg-app/60 px-3 py-3 text-sm">
            {session.reference.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <dt className="min-w-0 break-words text-fg-secondary">{r.label}</dt>
                <dd className="shrink-0 tabular-nums text-fg">{value(r.valueText)}</dd>
              </div>
            ))}
          </dl>
        )}
        <Button variant="ghost" aria-expanded={open} aria-controls={open ? detailId : undefined} onClick={() => setOpen((x) => !x)}>
          {open ? 'Thu gọn dữ liệu nền' : 'Xem chi tiết dữ liệu nền'}
        </Button>
      </div>
    </Card>
  );
}

export type ReportCardProps = {
  fileName: string;
  status: string;
  canExport: boolean;
  pdfReasonId: string;
  pdfReason: string;
  onPreview: () => void;
  onExcel: () => void;
};

/** "Báo cáo mô phỏng" (ảnh `12.png`): tệp nháp + Xem trước · Xuất PDF · Xuất Excel. */
export function ReportCard({ fileName, status, canExport, pdfReasonId, pdfReason, onPreview, onExcel }: ReportCardProps) {
  return (
    <Card title="Báo cáo mô phỏng" headerVariant="plain" radius="lg" titleSize="lg" aria-label="Báo cáo mô phỏng">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 rounded-lg border border-line/40 bg-surface-raised px-4 py-3">
          <PdfFileIcon size={32} className="shrink-0 text-primary" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="break-all text-base text-fg">{fileName}</span>
            <span className="text-sm text-fg-secondary">{status}</span>
          </span>
        </div>
        <Button variant="outline" className="w-full" icon={<PreviewIcon size={18} />} onClick={onPreview}>
          Xem trước
        </Button>
        {canExport && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" icon={<Icon name="download" box={18} />} aria-disabled="true" aria-describedby={pdfReasonId} title={pdfReason}>
              Xuất PDF
            </Button>
            <span id={pdfReasonId} hidden>
              {pdfReason}
            </span>
            <Button variant="ghost" icon={<SheetIcon size={18} />} onClick={onExcel}>
              Xuất Excel
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
