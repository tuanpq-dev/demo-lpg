import { Badge, FileDropzone, FormField, InfoIcon, StatusDot, inputClass, type DotStatus } from '@/components';
import { REMARK_SUGGESTIONS } from '@/features/reports';
import { cn } from '@/lib/cn';
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
} from '../CheckpointRecordSections';
import type { CheckpointRecordForm } from './useCheckpointRecordForm';
import type { RecordNavId } from './useSectionNav';

const LEGEND: { status: DotStatus; label: string }[] = [
  { status: 'primary', label: 'IOT' },
  { status: 'success', label: 'Xác minh hiện trường' },
  { status: 'warning', label: 'Ghi nhận thủ công' },
  { status: 'danger', label: 'Dữ liệu bất thường' },
];

type SectionProps = { f: CheckpointRecordForm; uid: string; sectionRef: (id: RecordNavId) => (el: HTMLElement | null) => void };

/** Tổng quan: dòng nháp, thông báo IoT / mất kết nối + chú giải nguồn, 4 thẻ chất lượng dữ liệu. */
export function RecordOverview({ f, uid, sectionRef }: SectionProps) {
  const { sensors, quality } = f;
  const lost = sensors.lost > 0;
  return (
    <section ref={sectionRef('overview')} id={`${uid}-overview`} aria-label="Tổng quan dữ liệu mốc" className="flex scroll-mt-2 flex-col gap-6">
      {f.modal.hasDraft && f.fromDraft && (
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
  );
}

/** Các nhóm thiết bị: bồn (công tắc đồng hồ cơ), máy hóa hơi, điều áp, lưu lượng, gas + báo cháy, PLC/SCADA + cảm biến. */
export function RecordEquipment({ f, uid, sectionRef }: SectionProps) {
  const { snapshot, manual, onManual, groups, quality, sensors } = f;
  const m = { manual, onManual };
  return (
    <>
      <RecordSection ref={sectionRef('tank')} id={`${uid}-tank`} title="Bồn chứa LPG – V-101" end={<GaugeInputToggle active={f.editingGauge} onToggle={f.toggleGauge} />}>
        <TankTable snapshot={snapshot} editing={f.editingGauge} {...m} />
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
        <p className="text-xs font-semibold italic text-fg-secondary">* Giá trị: Theo dữ liệu PLC | Đơn vị: Theo cấu hình PLC. Đơn vị và ngưỡng hiển thị theo mapping PLC chính thức.</p>
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
    </>
  );
}

/** Nhận xét mốc (bắt buộc, có câu gợi ý) + ảnh / tài liệu xác minh. */
export function RecordRemarkAndFiles({ f, uid, sectionRef }: SectionProps) {
  return (
    <>
      <RecordSection ref={sectionRef('remark')} id={`${uid}-remark`} title="Nhận xét mốc kiểm tra">
        <FormField label="Nhận xét của người vận hành" required error={f.remarkMissing ? 'Cần nhập nhận xét vận hành trước khi xác nhận mốc kiểm tra.' : undefined}>
          {({ id, describedBy, invalid }) => (
            <div className="flex flex-col gap-2">
              <div role="group" aria-label="Câu nhận xét gợi ý" className="flex flex-wrap gap-2">
                {REMARK_SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => f.appendRemark(s)} className="rounded-sm bg-surface-chip px-2 py-1 text-xs font-bold text-fg hover:bg-surface-chip/70">
                    {s}
                  </button>
                ))}
              </div>
              <textarea
                id={id}
                value={f.remark}
                onChange={(e) => f.setRemark(e.target.value)}
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
        <FileDropzone files={f.files} onChange={f.setFiles} accept=".jpg,.jpeg,.png,.pdf" label="Tải lên ảnh hiện trường, file PDF thông số" />
      </RecordSection>
    </>
  );
}

/** Tóm tắt: nhóm đã kiểm tra, nhận xét, trạng thái đủ điều kiện + lý do chặn. */
export function RecordSummary({ f }: { f: CheckpointRecordForm }) {
  const { groups, ready, remarkMissing, blockers } = f;
  return (
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
  );
}
