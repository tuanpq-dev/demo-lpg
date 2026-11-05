import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  FileDropzone,
  FormField,
  InfoIcon,
  Modal,
  ProgressBar,
  StatusDot,
  inputClass,
  type AttachedFile,
  type DotStatus,
} from '@/components';
import { clearRecordDraft, fetchCheckpointSnapshot, loadRecordDraft, recordCheckpoint, saveRecordDraft } from '@/data/checkpointRecord';
import {
  DAILY_SHIFT_HOURS,
  REMARK_SUGGESTIONS,
  appendRemark,
  periodLabel,
  recordBlockers,
  recordGroups,
  recordProgress,
  recordQuality,
  sensorSummary,
  type ManualValues,
  type ReportRecord,
} from '@/features/reports';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from '@/lib/reducedMotion';
import { useFormModal } from '@/lib/useFormModal';
import {
  FireTable,
  FlowLineCards,
  GasTable,
  GaugeInputToggle,
  PlcStatusCard,
  RecordSection,
  RegulatorCards,
  SensorSummaryCard,
  TankTable,
  VaporizerCards,
  boxClass,
} from './CheckpointRecordSections';

/** Tab điều hướng nhanh (Figma 126:8003) → id mục trong thân modal. */
const NAV = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'tank', label: 'Bồn chứa LPG' },
  { id: 'vaporizer', label: 'Máy hóa hơi' },
  { id: 'regulator', label: 'Bộ điều áp' },
  { id: 'flow', label: 'Lưu lượng' },
  { id: 'gas', label: 'Gas & Báo cháy' },
  { id: 'plc', label: 'PLC/SCADA' },
  { id: 'remark', label: 'Nhận xét' },
] as const;
type NavId = (typeof NAV)[number]['id'];

const LEGEND: { status: DotStatus; label: string }[] = [
  { status: 'primary', label: 'IOT' },
  { status: 'success', label: 'Xác minh hiện trường' },
  { status: 'warning', label: 'Ghi nhận thủ công' },
  { status: 'danger', label: 'Dữ liệu bất thường' },
];

export type CheckpointRecordModalProps = {
  report: ReportRecord;
  /** Khoá mốc "18:00". */
  checkpoint: string;
  onClose: () => void;
};

/**
 * Modal "Ghi nhận mốc kiểm tra HH:mm" – Figma bản sao A88YJ2BRhICDDdeu2rtRg1, node 126:7966 (frame 126:8506). Mở từ chi tiết
 * báo cáo ngày (`?record=<mốc>`). Số IoT tự điền (`data/checkpointRecord`), nhập đồng hồ cơ ghi đè, nhận xét bắt buộc,
 * tệp chỉ giữ trong phiên. Logic: `features/reports/record.ts`. Nháp sessionStorage theo mã + mốc. Chỉ mount khi mở.
 */
export function CheckpointRecordModal({ report: r, checkpoint, onClose }: CheckpointRecordModalProps) {
  const uid = useId();
  const blockersId = `${uid}-blockers`;
  const bodyRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<NavId, HTMLElement | null>>>({});

  const snapshot = useMemo(() => fetchCheckpointSnapshot(r, checkpoint), [r, checkpoint]);
  const [initialDraft] = useState(() => loadRecordDraft(r.code, checkpoint));
  const [remark, setRemark] = useState(initialDraft?.remark ?? '');
  const [manual, setManual] = useState<ManualValues>(initialDraft?.manual ?? {});
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [editingGauge, setEditingGauge] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState<NavId>('overview');

  const groups = recordGroups(snapshot, manual);
  const progress = recordProgress(groups);
  const quality = recordQuality(snapshot, manual);
  const sensors = sensorSummary(snapshot);
  const blockers = recordBlockers(groups, remark);
  const ready = blockers.length === 0;
  const remarkMissing = !remark.trim();
  const modal = useFormModal({
    initial: { remark: '', manual: {} as ManualValues, files: 0 },
    values: { remark, manual, files: files.length },
    // Nhận xét chỉ có khoảng trắng = chưa sửa; có nhập tay hoặc tệp = đã sửa (kể cả sau khi lưu nháp).
    isDirty: (v) => !!v.remark.trim() || Object.keys(v.manual).length > 0 || v.files > 0,
    draft: {
      exists: !!initialDraft,
      save: (v) => saveRecordDraft(r.code, checkpoint, { remark: v.remark, manual: { ...v.manual }, savedAt: new Date().toISOString() }),
      clear: () => clearRecordDraft(r.code, checkpoint),
    },
    onSubmit: (input: { remark: string; manual: ManualValues; files: string[] }) => recordCheckpoint(r.id, checkpoint, input),
    onClose,
    onSubmitError: setError,
    // Hai nút nháp: "Lưu bản nháp" ở lại, "Lưu và tiếp tục sau" đóng (gọi onClose sau khi lưu được). Hỏi khi đóng chỉ theo "đã sửa".
    stayOpenAfterDraft: true,
    confirmIfDraft: false,
  });
  const { confirming: confirmingClose, submitting, hasDraft, requestClose, discard } = modal;

  const onManual = (id: string, value: number | null) => {
    setManual((cur) => {
      const next = { ...cur };
      if (value === null) delete next[id];
      else next[id] = value;
      return next;
    });
    setError('');
  };

  // Tab theo mục đang xem: mục cuối có đầu mục đã cuộn qua mép trên thân modal (cuộn hết → mục cuối).
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onScroll = () => {
      const top = body.getBoundingClientRect().top;
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) return setActive(NAV[NAV.length - 1]!.id);
      let current: NavId = 'overview';
      for (const n of NAV) {
        const el = sectionRefs.current[n.id];
        if (el && el.getBoundingClientRect().top - top <= 32) current = n.id;
      }
      setActive(current);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = (id: NavId) => {
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const sectionRef = (id: NavId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };

  const saveDraft = (thenClose: boolean) => {
    if (!modal.saveDraft()) {
      setError('Không lưu được nháp (bộ nhớ trình duyệt không khả dụng).');
      return;
    }
    announce(`Đã lưu nháp mốc ${checkpoint} – ${r.code}${files.length ? ' (tệp đính kèm không lưu trong nháp)' : ''}.`);
    if (thenClose) onClose();
  };

  const submit = async () => {
    if (!ready || submitting) return;
    const res = await modal.submit({ remark, manual, files: files.map((f) => f.name) });
    if (!res) return; // lỗi mạng / máy chủ – đã hiện qua onSubmitError
    if (!res.ok) return setError(res.error);
    announce(`Đã xác nhận mốc ${checkpoint} – báo cáo ${r.code}.`);
    onClose();
  };

  const info = (
    <dl className={cn(boxClass, 'flex flex-wrap items-center gap-x-6 gap-y-2 bg-bg-app/40 px-4 py-3 text-sm')}>
      {[
        ['Mã BC:', r.code],
        ['Ngày:', periodLabel(r.period, r.periodKey)],
        ['Ca:', `${r.shift ?? 'Ca 1'} (${DAILY_SHIFT_HOURS})`],
        ['Mốc:', checkpoint],
        ['Người kiểm tra:', r.inspector],
      ].map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt className="font-semibold text-fg-secondary">{k}</dt>
          <dd className={cn('tabular-nums', k === 'Mốc:' ? 'font-bold text-primary' : 'text-fg')}>{v}</dd>
        </div>
      ))}
    </dl>
  );

  const nav = (
    <nav aria-label="Mục của biểu mẫu ghi nhận" className="shrink-0 overflow-x-auto border-b border-line/30 px-5">
      <ul className="flex min-w-max gap-6">
        {NAV.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              aria-current={active === n.id ? 'location' : undefined}
              onClick={() => goTo(n.id)}
              className={cn(
                '-mb-px h-12 border-b-2 px-1 text-md font-semibold transition-colors',
                active === n.id ? 'border-primary text-primary' : 'border-transparent text-fg-secondary hover:text-fg',
              )}
            >
              {n.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  const footer = confirmingClose ? (
    <>
      <Button ref={modal.keepEditingRef} variant="subtle" onClick={modal.keepEditing}>
        Tiếp tục nhập
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
      <Button variant="ghost" onClick={() => saveDraft(false)}>
        Lưu bản nháp
      </Button>
      <Button variant="ghost" onClick={() => saveDraft(true)}>
        Lưu và tiếp tục sau
      </Button>
      <Button type="submit" variant="primary" aria-disabled={!ready || submitting || undefined} aria-describedby={ready ? undefined : blockersId}>
        Xác nhận mốc {checkpoint}
      </Button>
    </>
  );

  const m = { manual, onManual };
  const lost = sensors.lost > 0;

  return (
    <Modal
      open
      size="xl"
      titleTone="primary"
      title={`Ghi nhận mốc kiểm tra ${checkpoint}`}
      description="Cập nhật thông số vận hành định kỳ cho hệ thống trạm LPG."
      headerExtra={info}
      beforeBody={nav}
      bodyRef={bodyRef}
      onClose={requestClose}
      dismissOnBackdrop={false}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirmingClose) void submit();
      }}
      footerStart={
        confirmingClose ? (
          <p role="alert" className="text-base text-fg">
            {hasDraft ? 'Bỏ các thay đổi và xóa bản nháp đã lưu?' : 'Bỏ các thay đổi chưa lưu?'}
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-32 shrink-0">
              <ProgressBar value={progress} label={`Tiến độ kiểm tra nhóm thiết bị mốc ${checkpoint}`} tone="primary" size="md" />
            </div>
            <span className="whitespace-nowrap text-sm text-fg-secondary">Hoàn thành {progress}%</span>
          </div>
        )
      }
      footer={footer}
    >
      <span id={blockersId} hidden>
        {`Chưa đủ điều kiện xác nhận: ${blockers.join('; ')}.`}
      </span>

      <div className="flex flex-col gap-8 py-1">
        {/* ---- Tổng quan: thanh thông tin + 4 thẻ chất lượng ---- */}
        <section ref={sectionRef('overview')} id={`${uid}-overview`} aria-label="Tổng quan dữ liệu mốc" className="flex scroll-mt-2 flex-col gap-6">
          {hasDraft && initialDraft && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
              <Badge variant="tag" tone="neutral">
                Bản nháp
              </Badge>
              Đang mở bản nháp đã lưu.
            </p>
          )}
          <div className={cn(boxClass, 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-3')}>
            <p className={cn('flex items-center gap-2 text-sm font-semibold', lost ? 'text-warning' : 'text-fg')}>
              <InfoIcon size={20} className={cn('shrink-0', lost ? 'text-warning' : 'text-primary')} />
              {lost
                ? `${sensors.lost} cảm biến mất kết nối – nhập giá trị đồng hồ cơ cho ô trống, dữ liệu IoT còn lại đã tự động điền.`
                : 'Dữ liệu IoT đã được tự động điền. Vui lòng kiểm tra và xác nhận.'}
            </p>
            <ul aria-label="Chú giải nguồn dữ liệu" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-fg">
              {LEGEND.map((l) => (
                <li key={l.label} className="inline-flex items-center gap-1.5">
                  <StatusDot status={l.status} size="sm" />
                  {l.label}
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Kết nối IoT', value: quality.iotStable ? 'Ổn định' : 'Gián đoạn', tone: quality.iotStable ? 'text-success' : 'text-warning' },
              { label: 'Tiến độ xác minh', value: `${quality.verified}/${quality.total}`, tone: quality.verified === quality.total ? 'text-primary' : 'text-warning' },
              { label: 'Bất thường', value: String(quality.anomalies), tone: quality.anomalies ? 'text-danger-text' : 'text-fg' },
              { label: 'Nhập thủ công', value: String(quality.manual), tone: quality.manual ? 'text-warning' : 'text-fg' },
            ].map((c) => (
              <div key={c.label} className={cn(boxClass, 'flex flex-col gap-1 px-3 py-3')}>
                <dt className="text-sm tracking-wide text-fg-secondary">{c.label}</dt>
                <dd className={cn('text-lg tabular-nums', c.tone)}>{c.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <RecordSection
          ref={sectionRef('tank')}
          id={`${uid}-tank`}
          title="Bồn chứa LPG – V-101"
          end={<GaugeInputToggle active={editingGauge} onToggle={() => setEditingGauge((v) => !v)} />}
        >
          <TankTable snapshot={snapshot} editing={editingGauge} {...m} />
        </RecordSection>

        <RecordSection ref={sectionRef('vaporizer')} id={`${uid}-vaporizer`} title="Máy hóa hơi – E-101A / E-101B">
          <VaporizerCards units={snapshot.vaporizers} {...m} />
          <p className="text-sm font-semibold italic text-fg-secondary">
            {groups.find((g) => g.id === 'vaporizer')?.complete && quality.anomalies === 0
              ? 'Không phát hiện nhiệt độ hoặc nồng độ gas bất thường tại khu vực máy hóa hơi.'
              : 'Kiểm tra lại nhiệt độ / nồng độ gas khu vực máy hóa hơi trước khi xác nhận.'}
          </p>
        </RecordSection>

        <RecordSection ref={sectionRef('regulator')} id={`${uid}-regulator`} title="Hệ thống điều áp – PR-101">
          <RegulatorCards readings={snapshot.regulators} {...m} />
          <p className="text-xs font-semibold italic text-fg-secondary">
            * Giá trị: Theo dữ liệu PLC | Đơn vị: Theo cấu hình PLC. Đơn vị và ngưỡng hiển thị theo mapping PLC chính thức.
          </p>
        </RecordSection>

        <RecordSection ref={sectionRef('flow')} id={`${uid}-flow`} title="Lưu lượng và đường cấp LPG">
          <FlowLineCards lines={snapshot.flowLines} {...m} />
        </RecordSection>

        <div ref={sectionRef('gas')} id={`${uid}-gas`} className="grid scroll-mt-2 gap-6 md:grid-cols-2">
          <RecordSection id={`${uid}-gas-leak`} title="Cảm biến rò rỉ LPG">
            <GasTable snapshot={snapshot} manual={manual} />
          </RecordSection>
          <RecordSection id={`${uid}-fire`} title="Hệ thống báo cháy">
            <FireTable snapshot={snapshot} />
          </RecordSection>
        </div>

        <div ref={sectionRef('plc')} id={`${uid}-plc`} className="grid scroll-mt-2 gap-6 md:grid-cols-2">
          <RecordSection id={`${uid}-plc-scada`} title="PLC và SCADA">
            <PlcStatusCard snapshot={snapshot} />
          </RecordSection>
          <RecordSection id={`${uid}-sensors`} title="Trạng thái cảm biến">
            <SensorSummaryCard summary={sensors} />
          </RecordSection>
        </div>

        <RecordSection ref={sectionRef('remark')} id={`${uid}-remark`} title="Nhận xét mốc kiểm tra">
          <FormField label="Nhận xét của người vận hành" required error={remarkMissing ? 'Cần nhập nhận xét vận hành trước khi xác nhận mốc kiểm tra.' : undefined}>
            {({ id, describedBy, invalid }) => (
              <div className="flex flex-col gap-2">
                <div role="group" aria-label="Câu nhận xét gợi ý" className="flex flex-wrap gap-2">
                  {REMARK_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRemark((t) => appendRemark(t, s))}
                      className="rounded-sm bg-surface-chip px-2 py-1 text-xs font-bold text-fg hover:bg-surface-chip/70"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <textarea
                  id={id}
                  value={remark}
                  onChange={(e) => {
                    setRemark(e.target.value);
                    setError('');
                  }}
                  rows={5}
                  maxLength={1000}
                  required
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  placeholder="Nhập nhận xét về tình trạng thiết bị, các lưu ý đặc biệt..."
                  className={cn(inputClass(invalid), 'resize-y py-2')}
                />
              </div>
            )}
          </FormField>
        </RecordSection>

        <RecordSection id={`${uid}-files`} title="Ảnh và tài liệu xác minh">
          <FileDropzone files={files} onChange={setFiles} accept=".jpg,.jpeg,.png,.pdf" label="Tải lên ảnh hiện trường, file PDF thông số" />
        </RecordSection>

        <section aria-label="Tóm tắt ghi nhận" className={cn(boxClass, 'flex flex-wrap items-center justify-between gap-4 p-4')}>
          <dl className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <dt className="text-sm tracking-wide text-fg-secondary">Nhóm đã kiểm tra</dt>
              <dd className="text-lg tabular-nums text-fg">
                {groups.filter((g) => g.complete).length}/{groups.length}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm tracking-wide text-fg-secondary">Nhận xét vận hành</dt>
              <dd className={cn('text-lg font-semibold', remarkMissing ? 'text-danger-text' : 'text-success')}>{remarkMissing ? 'Chưa nhập' : 'Đã nhập'}</dd>
            </div>
          </dl>
          <Badge variant="tag" size="md" tone={ready ? 'success' : 'danger'} className="text-sm font-semibold">
            Trạng thái: {ready ? 'Đủ điều kiện xác nhận' : 'Chưa đủ điều kiện xác nhận'}
          </Badge>
          {!ready && (
            <ul className="w-full list-disc pl-5 text-sm text-fg-secondary">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
