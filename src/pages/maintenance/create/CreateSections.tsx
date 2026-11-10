import { Checkbox, CheckCircleIcon, FileDropzone, PaperclipIcon, ShieldIcon, SparkleIcon, Textarea, type ChecklistItem } from '@/components';
import { durationHours, type AiSuggestion } from '@/data/maintenance';
import { cn } from '@/lib/cn';
import { PRIORITY_TEXT, type CreateFormValues } from './createForm';
import type { CreateMaintenanceForm } from './useCreateMaintenanceForm';

/** "Góp ý từ AI" (mock): đánh giá + gợi ý kiểm tra – bấm để thêm / bỏ khỏi checklist. */
export function AiSuggestionPanel({
  suggestion,
  checklist,
  onToggle,
}: {
  suggestion: AiSuggestion;
  checklist: readonly ChecklistItem[];
  onToggle: (text: string) => void;
}) {
  return (
    <section aria-labelledby="ai-title" className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="ai-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-label text-accent">
          <SparkleIcon />
          Góp ý từ AI
        </h3>
        <span className="rounded-sm bg-accent/20 px-2 py-0.5 text-2xs font-bold uppercase text-accent">AI hỗ trợ</span>
      </div>
      <p className="text-sm italic text-fg-muted/70">AI phân tích dữ liệu vận hành liên quan và đưa ra gợi ý hỗ trợ tạo yêu cầu bảo trì.</p>
      <p className="rounded-md bg-surface-sunken/60 px-3 py-2.5 text-sm text-fg">
        <span className="font-semibold text-accent">Đánh giá:</span> {suggestion.assessment}
      </p>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-fg-secondary">Gợi ý kiểm tra (bấm để thêm vào checklist):</span>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {suggestion.checks.map((c) => {
            const added = checklist.some((x) => x.text === c);
            return (
              <li key={c}>
                <button
                  type="button"
                  aria-pressed={added}
                  onClick={() => onToggle(c)}
                  className={cn('inline-flex items-center gap-1.5 rounded-sm text-sm hover:text-fg', added ? 'text-success' : 'text-fg-secondary')}
                >
                  <CheckCircleIcon className={added ? 'text-success' : 'text-accent'} />
                  {c}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-2xs text-fg-muted/65">* AI chỉ hỗ trợ thông tin và góp ý. Admin là người xác nhận nội dung cuối cùng của yêu cầu bảo trì.</p>
    </section>
  );
}

/** "Tệp đính kèm" + "Ghi chú & An toàn" (ghi chú nội bộ, PTW). */
export function AttachmentsNotesSection({ f }: { f: CreateMaintenanceForm }) {
  const { form, set } = f;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section aria-labelledby="att-title" className="flex flex-col gap-3">
        <h3 id="att-title" className="flex items-center gap-2 text-lg font-semibold text-fg">
          <PaperclipIcon className="text-fg-secondary" />
          Tệp đính kèm
        </h3>
        <FileDropzone files={form.attachments} onChange={(v) => set('attachments', v)} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx" />
      </section>
      <section aria-labelledby="note-title" className="flex flex-col gap-3">
        <h3 id="note-title" className="flex items-center gap-2 text-lg font-semibold text-fg">
          <ShieldIcon className="text-fg-secondary" />
          Ghi chú &amp; An toàn
        </h3>
        <Textarea
          label="Ghi chú nội bộ"
          value={form.notes}
          onChange={(v) => set('notes', v)}
          rows={4}
          placeholder="Thêm ghi chú nội bộ hoặc lưu ý an toàn…"
          className="[&>label]:sr-only"
        />
        {/* Nhãn hiển thị = tên truy cập (WCAG 2.5.3), bấm chữ cũng chọn; không lồng <label>. */}
        <Checkbox
          showLabel
          label="Công việc yêu cầu tuân thủ quy trình Giấy phép Làm việc (Permit to Work - PTW)."
          checked={form.requiresPermit}
          onChange={(v) => set('requiresPermit', v)}
          className="items-start gap-3"
        />
      </section>
    </div>
  );
}

/** Thanh "Tổng quan yêu cầu": số thiết bị • số bước, mức độ, thời lượng dự kiến, PTW. */
export function CreateOverview({ form }: { form: CreateFormValues }) {
  const hours = durationHours(form.startAt, form.dueAt);
  const steps = form.checklist.filter((c) => c.text.trim()).length;
  return (
    <dl aria-label="Tổng quan yêu cầu" className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-line/30 bg-surface-raised px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <dt className="text-2xs uppercase tracking-label text-fg-muted/65">Tổng quan</dt>
        <dd className="text-sm text-fg">
          {form.device ? 1 : 0} Thiết bị • {steps} Bước thực hiện
        </dd>
      </div>
      <div className="flex flex-col gap-0.5 border-l border-line/30 pl-8">
        <dt className="text-2xs uppercase tracking-label text-fg-muted/65">Mức độ</dt>
        <dd
          className={cn(
            'text-sm font-semibold',
            form.priority === 'critical' ? 'text-danger-text' : form.priority === 'high' ? 'text-warning' : 'text-fg',
          )}
        >
          {form.priority === 'critical' && '! '}
          {PRIORITY_TEXT[form.priority]}
        </dd>
      </div>
      <div className="flex flex-col gap-0.5 border-l border-line/30 pl-8">
        <dt className="text-2xs uppercase tracking-label text-fg-muted/65">Thời lượng dự kiến</dt>
        <dd className="text-sm text-fg">{hours !== null && hours > 0 ? `${hours} giờ` : '–'}</dd>
      </div>
      {form.requiresPermit && (
        <div className="flex flex-col gap-0.5 border-l border-line/30 pl-8">
          <dt className="text-2xs uppercase tracking-label text-fg-muted/65">An toàn</dt>
          <dd className="text-sm text-warning">Cần PTW</dd>
        </div>
      )}
    </dl>
  );
}
