import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertOctagonIcon,
  AttachmentCard,
  Badge,
  Button,
  CheckCircleIcon,
  KpiCard,
  Modal,
  PauseCircleIcon,
  PlayCircleIcon,
  ProgressSlider,
  StatusOptionGroup,
  Textarea,
  UploadTile,
  type StatusOption,
} from '@/components';
import { dueHasTime, dueTimeLabel, type MaintenanceAttachment, type MaintenanceRecord } from '@/data/maintenance';
import { clearProgressDraft, formatFileSize, loadProgressDraft, saveProgressDraft } from '@/data/maintenanceDetail';
import { checklistProgress } from '@/features/maintenance/checklist';
import { isPastDue } from '@/features/maintenance/deadline';
import {
  TEXT_LABEL,
  UPLOAD_ACCEPT,
  UPLOAD_HINT,
  WORK_STATE_OPTIONS,
  canContinueToSubmit,
  checkUploads,
  defaultReportedProgress,
  isNearOrPastDue,
  reportedProgressOf,
  requiresText,
  uploadKind,
  validateProgressUpdate,
  workStateDisabled,
  workStateOf,
  type ProgressFile,
  type ProgressUpdateErrors,
  type ProgressUpdateInput,
  type WorkState,
} from '@/features/maintenance/progress';
import { announce } from '@/lib/announce';
import { daysFromToday } from '@/lib/plantTime';
import { useFormModal, type FormModalDraft } from '@/lib/useFormModal';
import { useNow } from '@/lib/useNow';
import { downloadSampleAttachment } from './attachments';

/** Tệp thêm trong phiên: object URL CHỈ để xem trước trong modal – revoke khi xoá tệp / đóng modal, không lưu vào bản ghi. */
type TempFile = { id: string; name: string; size: number; kind: 'image' | 'document'; url: string; type: string };

const ICONS: Record<WorkState, ReactNode> = {
  working: <PlayCircleIcon size={20} />,
  paused: <PauseCircleIcon size={20} />,
  blocked: <AlertOctagonIcon size={20} />,
  completed: <CheckCircleIcon size={20} />,
};
const TONES = { working: 'primary', paused: 'warning', blocked: 'danger', completed: 'primary' } as const;

export type ProgressUpdateModalProps = {
  record: MaintenanceRecord;
  onClose: () => void;
  /** Ghi bản ghi (mutation) – modal đã kiểm tra hợp lệ trước khi gọi. */
  onSubmit: (input: ProgressUpdateInput) => Promise<void>;
  /** "Mở checklist": modal đã tự lưu nháp nếu đang sửa; nơi gọi đóng modal + đưa tới khối Checklist. */
  onOpenChecklist?: () => void;
  /**
   * Chọn "Hoàn thành" → nút chính "Tiếp tục gửi nghiệm thu": KHÔNG ghi bản ghi; nơi gọi đóng modal này và mở modal
   * "Gửi yêu cầu nghiệm thu" với nội dung (→ Tóm tắt) + thông tin tệp đã thêm.
   */
  onContinueToSubmit: (prefill: { text: string; files: readonly ProgressFile[] }) => void;
};

/**
 * Modal "Cập nhật tiến độ bảo trì" – ảnh thiết kế (chưa có node Figma; số đo ước lượng, lệch ghi docs/figma-diffs.md):
 * 5 ô thông tin · Trạng thái công việc (radiogroup) · Tiến độ hoàn thành (thanh trượt, bước 5) + dòng Checklist ·
 * Ảnh và tài liệu (tệp có sẵn + tệp tạm + "Tải tệp lên") · Nội dung đã thực hiện · Hủy / Lưu nháp / Cập nhật tiến độ.
 * Quy tắc trạng thái + lịch sử: `features/maintenance/progress.ts`. Nháp: sessionStorage theo mã (không đổi trạng thái).
 * Chỉ mount khi mở (state khởi tạo bằng hàm khởi tạo của useState).
 */
export function ProgressUpdateModal({ record: r, onClose, onSubmit, onOpenChecklist, onContinueToSubmit }: ProgressUpdateModalProps) {
  const now = useNow(30_000);
  const headingId = useId();
  const checklistLineId = useId();
  const textWrapRef = useRef<HTMLDivElement>(null);

  const [initial] = useState(() => {
    const draft = loadProgressDraft(r.id);
    const base = { state: workStateOf(r), progress: defaultReportedProgress(r), text: '' };
    return { base, draft, values: draft ? { state: draft.state, progress: draft.progress, text: draft.text } : base };
  });
  const [state, setState] = useState<WorkState>(initial.values.state);
  const [progress, setProgress] = useState(initial.values.progress);
  const [text, setText] = useState(initial.values.text);
  const [files, setFiles] = useState<TempFile[]>([]);
  const [errors, setErrors] = useState<ProgressUpdateErrors>({});
  const [uploadError, setUploadError] = useState('');
  const [preview, setPreview] = useState<{ kind: 'sample'; file: MaintenanceAttachment } | { kind: 'temp'; file: TempFile } | null>(null);

  // Revoke mọi URL xem trước khi đóng modal (unmount) – ref giữ danh sách mới nhất.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  type Values = { state: WorkState; progress: number; text: string; files: number };
  const draft: FormModalDraft<Values> = {
    exists: !!initial.draft,
    // Nháp chỉ giữ lựa chọn + tiến độ + nội dung (KHÔNG giữ tệp – object URL chết khi đóng modal).
    save: (v) => saveProgressDraft(r.id, { state: v.state, progress: v.progress, text: v.text, savedAt: new Date().toISOString() }),
    clear: () => clearProgressDraft(r.id),
  };
  const values: Values = { state, progress, text, files: files.length };
  const form = useFormModal({
    initial: { ...initial.base, files: 0 },
    values,
    // Nội dung chỉ có khoảng trắng = chưa sửa; có tệp tạm = đã sửa.
    isDirty: (v, i) => v.state !== i.state || v.progress !== i.progress || v.text.trim() !== '' || v.files > 0,
    draft,
    onSubmit,
    onClose,
    onSubmitError: (t) => setErrors({ form: t }),
  });
  const { dirty, confirming, submitting, hasDraft, requestClose, discard } = form;
  const checklist = r.checklist?.length ? checklistProgress(r.checklist) : null;
  const hasTime = dueHasTime(r);
  const dueRed = isNearOrPastDue(r.dueAt, now, hasTime);
  const overdue = isPastDue(r.dueAt, now, hasTime);
  const dueDay = daysFromToday(r.dueAt, now);
  const dueValue = `${dueTimeLabel(r)}${dueDay === 0 ? '' : ` ${r.dueAt.slice(8, 10)}/${r.dueAt.slice(5, 7)}`}`;

  const options: StatusOption<WorkState>[] = WORK_STATE_OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
    icon: ICONS[o.id],
    tone: TONES[o.id],
    disabled: workStateDisabled(r.status, o.id),
    disabledHint: workStateDisabled(r.status, o.id) ? 'bắt đầu thực hiện trước khi báo hoàn thành' : undefined,
  }));

  const input = (): ProgressUpdateInput => ({ state, progress, text, files: files.map(({ name, size, kind }) => ({ name, size, kind })) });

  const chooseState = (s: WorkState) => {
    setState(s);
    setErrors((e) => ({ ...e, state: undefined, text: undefined, form: undefined }));
    // Báo hoàn thành → mặc định 100 % (vẫn sửa được).
    if (s === 'completed') setProgress(100);
  };

  const continueToSubmit = state === 'completed';

  const submit = async () => {
    if (continueToSubmit) {
      if (!canContinueToSubmit(r.status, state)) {
        setErrors({ state: 'Bắt đầu thực hiện trước khi báo hoàn thành.' });
        return;
      }
      clearProgressDraft(r.id);
      onContinueToSubmit({ text: text.trim(), files: input().files ?? [] });
      return;
    }
    const e = validateProgressUpdate(r, input());
    setErrors(e);
    if (e.text) {
      textWrapRef.current?.querySelector('textarea')?.focus();
      return;
    }
    if (Object.keys(e).length) return;
    await form.submit(input());
  };

  const onSaveDraft = () => {
    if (!form.saveDraft()) {
      setErrors({ form: 'Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).' });
      return;
    }
    announce(`Đã lưu nháp cập nhật tiến độ ${r.code}${files.length ? ' – tệp đính kèm không được lưu trong nháp' : ''}.`);
  };

  const addFiles = (list: File[]) => {
    const { accepted, rejected } = checkUploads(list, files.length);
    setUploadError(rejected.length ? rejected.map((x) => `${x.name}: ${x.reason}`).join('; ') : '');
    if (!accepted.length) return;
    const added = accepted.map((f, i) => ({
      id: `tmp-${Date.now()}-${i}`,
      name: f.name,
      size: f.size,
      kind: uploadKind(f.name),
      url: URL.createObjectURL(f),
      type: f.type,
    }));
    setFiles((cur) => [...cur, ...added]);
    setErrors((e) => ({ ...e, form: undefined }));
    announce(`Đã thêm ${added.length} tệp (chưa tải lên máy chủ).`);
  };

  const removeFile = (f: TempFile) => {
    URL.revokeObjectURL(f.url);
    setFiles((cur) => cur.filter((x) => x.id !== f.id));
    if (preview?.kind === 'temp' && preview.file.id === f.id) setPreview(null);
    announce(`Đã bỏ tệp ${f.name}.`);
  };

  const openChecklist = () => {
    if (dirty && draft.save(values)) announce(`Đã lưu nháp cập nhật tiến độ ${r.code}.`);
    onOpenChecklist?.();
  };

  const footer = confirming ? (
    <>
      <Button ref={form.keepEditingRef} variant="subtle" onClick={form.keepEditing}>
        Tiếp tục sửa
      </Button>
      <Button variant="primary" onClick={discard}>
        {hasDraft ? 'Bỏ thay đổi và xóa nháp' : 'Bỏ thay đổi'}
      </Button>
    </>
  ) : (
    <>
      <Button variant="plain" onClick={requestClose}>
        Hủy
      </Button>
      <Button variant="subtle" onClick={onSaveDraft}>
        Lưu nháp
      </Button>
      <Button type="submit" variant="primary" disabled={submitting}>
        {continueToSubmit ? 'Tiếp tục gửi nghiệm thu' : 'Cập nhật tiến độ'}
      </Button>
    </>
  );

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title="Cập nhật tiến độ bảo trì"
      description={`Ghi nhận tình trạng thực hiện và cập nhật tiến độ công việc ${r.code}`}
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) void submit();
      }}
      footerStart={
        confirming ? (
          <p role="alert" className="text-base text-fg">
            {hasDraft ? 'Bỏ các thay đổi và xóa bản nháp đã lưu?' : 'Bỏ các thay đổi chưa lưu?'}
          </p>
        ) : undefined
      }
      footer={footer}
    >
      <div className="flex flex-col gap-5 py-1">
        {initial.draft && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
            <Badge variant="tag" tone="neutral">
              Bản nháp
            </Badge>
            Đang mở bản nháp đã lưu{initial.draft.savedAt ? ` lúc ${new Date(initial.draft.savedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })}` : ''}.
          </p>
        )}

        {/* 5 ô thông tin */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {[
            { label: 'Mã số', value: r.code },
            { label: 'Thiết bị', value: r.device },
            { label: 'Nhân sự', value: r.assignee ?? 'Chưa phân công' },
            { label: 'Tiến độ', value: `${reportedProgressOf(r)}%`, tone: 'primary' as const, hint: 'Tiến độ báo cáo gần nhất' },
            {
              label: 'Hạn chót',
              value: dueValue,
              tone: dueRed ? ('danger' as const) : ('neutral' as const),
              hint: overdue ? 'Đã quá hạn' : dueRed ? 'Gần hạn – còn dưới 2 giờ' : undefined,
            },
          ].map((c) => (
            <KpiCard key={c.label} size="sm" emphasis label={c.label} value={c.value} tone={c.tone} hint={c.hint} />
          ))}
        </div>

        {/* Trạng thái công việc */}
        <section className="flex flex-col gap-3">
          <h3 id={headingId} className="text-lg font-semibold text-fg-secondary">
            Trạng thái công việc
          </h3>
          <StatusOptionGroup label="Trạng thái công việc" labelledBy={headingId} options={options} value={state} onChange={chooseState} />
          {errors.state && <p className="text-sm text-danger-text">{errors.state}</p>}
        </section>

        {/* Tiến độ hoàn thành */}
        <section className="flex flex-col gap-2">
          <ProgressSlider label="Tiến độ hoàn thành" value={progress} onChange={setProgress} describedBy={checklistLineId} />
          <p id={checklistLineId} className="flex flex-wrap items-center gap-x-2 text-sm text-fg-secondary">
            {checklist ? (
              <>
                <span>
                  Checklist {checklist.done}/{checklist.total}
                </span>
                {onOpenChecklist && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Button variant="link" onClick={openChecklist}>
                      Mở checklist
                    </Button>
                  </>
                )}
                {state === 'completed' && checklist.done < checklist.total && (
                  <span className="basis-full text-warning">Checklist chưa xong hết – cần hoàn thành checklist (trừ mục Không áp dụng) mới gửi nghiệm thu được.</span>
                )}
              </>
            ) : (
              <span>Yêu cầu chưa có checklist – tiến độ do người thực hiện báo cáo.</span>
            )}
          </p>
        </section>

        {/* Ảnh và tài liệu */}
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-fg-secondary">Ảnh và tài liệu</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            {(r.attachments ?? []).map((a) => (
              <AttachmentCard
                key={a.id}
                fluid
                id={a.id}
                name={a.name}
                kind={a.kind}
                notice={a.isTemp ? 'Chưa tải lên máy chủ' : undefined}
                onView={() => setPreview({ kind: 'sample', file: a })}
                onDownload={a.isTemp ? undefined : () => downloadSampleAttachment(a, r.code)}
              />
            ))}
            {files.map((f) => (
              <div key={f.id} className="relative flex min-w-0">
                <AttachmentCard
                  fluid
                  id={f.id}
                  name={f.name}
                  kind={f.kind}
                  meta={formatFileSize(f.size)}
                  notice="Chưa tải lên máy chủ"
                  onView={() => setPreview({ kind: 'temp', file: f })}
                />
                <button
                  type="button"
                  aria-label={`Bỏ tệp ${f.name}`}
                  onClick={() => removeFile(f)}
                  className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-sm text-fg-secondary hover:bg-surface-muted hover:text-fg"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
            <UploadTile accept={UPLOAD_ACCEPT} hint={UPLOAD_HINT} onFiles={addFiles} />
          </div>
          {uploadError && (
            <p role="alert" className="text-sm text-danger-text">
              Không thêm được: {uploadError}.
            </p>
          )}
          {preview && (
            <div className="flex flex-col gap-2 rounded-md border border-line/30 bg-surface-sunken/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-base text-fg">
                  <span className="truncate">{preview.file.name}</span>
                  <Badge variant="tag" tone={preview.kind === 'temp' || preview.file.isTemp ? 'warning' : 'neutral'}>
                    {preview.kind === 'temp' || preview.file.isTemp ? 'Chưa tải lên máy chủ' : 'Dữ liệu mẫu'}
                  </Badge>
                </p>
                <Button variant="plain" size="sm" onClick={() => setPreview(null)}>
                  Đóng xem trước
                </Button>
              </div>
              {preview.kind === 'temp' && preview.file.kind === 'image' ? (
                <img src={preview.file.url} alt={`Xem trước ${preview.file.name}`} className="max-h-60 self-start rounded-sm object-contain" />
              ) : preview.kind === 'temp' ? (
                <a href={preview.file.url} target="_blank" rel="noreferrer" className="self-start rounded-sm text-sm text-accent hover:underline">
                  Mở {preview.file.name} trong thẻ mới
                </a>
              ) : (
                <p className="text-sm text-fg-secondary">Chưa có tệp thật – bản demo chưa nối kho lưu trữ. Xem trước sẽ hiện ở đây khi có backend.</p>
              )}
            </div>
          )}
        </section>

        {/* Nội dung đã thực hiện */}
        <div ref={textWrapRef}>
        <Textarea
          labelVariant="section"
          label={TEXT_LABEL[state]}
          required={requiresText(state)}
          value={text}
          onChange={(v) => {
            setText(v);
            if (errors.text || errors.form) setErrors((e) => ({ ...e, text: undefined, form: undefined }));
          }}
          placeholder="Mô tả chi tiết các bước đã hoàn thành..."
          rows={4}
          maxLength={1000}
          error={errors.text}
          hint={
            continueToSubmit
              ? 'Nội dung được điền sẵn vào "Tóm tắt công việc" ở bước gửi nghiệm thu.'
              : requiresText(state)
                ? 'Bắt buộc – được lưu vào lịch sử xử lý và ghi chú kỹ thuật.'
                : 'Không bắt buộc – nếu có, được lưu thành ghi chú kỹ thuật.'
          }
        />
        </div>

        {errors.form && (
          <p role="alert" className="text-sm text-danger-text">
            {errors.form}
          </p>
        )}
      </div>
    </Modal>
  );
}
