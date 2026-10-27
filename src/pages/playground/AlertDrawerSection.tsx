import { useState } from 'react';
import {
  Button,
  Checklist,
  KpiCard,
  StaffList,
  ThresholdGauge,
  WorkflowStepper,
  type StaffPickerItem,
} from '@/components';
import { alertRecords, type AlertRecord } from '@/mocks/alerts';
import { gaugeScale, gaugeValueText } from '@/features/alerts/gauge';
import { acknowledgeAlert, addAlertNote, assignAlert, fireUpdate, gasUpdate, requestSupport, resolveAlert, toggleGuideStep } from '@/features/alerts/workflow';
import { VAPORIZER_AREA_TAGS as FT } from '@/features/live/tags';
import { liveSimulator } from '@/data/live';
import { AlertDetailDrawer } from '../alerts/AlertDetailDrawer';
import { Demo } from './Demo';

/** Ảnh thiết kế chỉ ở máy dev (`scratch/figma-ref/`, gitignore); bản build: undefined (không đóng gói). */
const REF_DRAWER = import.meta.env.DEV ? '/scratch/figma-ref/alert-drawer-design.png' : undefined;

const base = alertRecords.find((a) => a.id === 'ALT-00128')!;
const lowTemp = alertRecords.find((a) => a.id === 'ALT-00126')!;
const gas = alertRecords.find((a) => a.id === 'ALT-00127')!;
/** Ảnh gas chỉ ở máy dev. */
const REF_GAS = import.meta.env.DEV ? '/scratch/figma-ref/alert-drawer-gas-design.png' : undefined;
const fire = alertRecords.find((a) => a.id === 'FIR-00018')!;
/** Ảnh báo cháy chỉ ở máy dev. */
const REF_FIRE = import.meta.env.DEV ? '/scratch/figma-ref/alert-drawer-fire-design.png' : undefined;
const at = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00+07:00`).toISOString();

/** Mẫu theo trạng thái – dữ liệu mẫu, KHÔNG ghi store (thao tác trong drawer chỉ đổi state của mục này). */
const SAMPLES: Record<string, { label: string; alert: AlertRecord; maintenance?: { id: string; code: string } }> = {
  unack: { label: 'Chưa xác nhận (theo ảnh)', alert: { ...base, area: 'Khu bồn LPG' } },
  progress: {
    label: 'Đang xử lý – tick 1 bước, có ghi chú',
    alert: {
      ...base,
      status: 'in-progress',
      assignee: 'Nguyễn Văn A',
      acknowledgedAt: at('10:52'),
      guide: { 'field-gauge': { at: at('10:58'), by: 'Nguyễn Văn A' } },
      notes: [{ id: 'n1', author: 'Nguyễn Văn A', at: at('11:02'), text: 'Đồng hồ cơ tại hiện trường 11,6 bar, đang kiểm tra van PSV-101.' }],
      history: [
        { id: 'h1', at: at('10:52'), kind: 'acknowledge', text: 'Xác nhận cảnh báo – Nguyễn Văn A nhận xử lý', actor: 'Nguyễn Văn A' },
        { id: 'h2', at: at('10:58'), kind: 'guide', text: 'Đã làm: Kiểm tra đồng hồ áp suất cơ tại hiện trường', actor: 'Nguyễn Văn A' },
      ],
    },
  },
  done: {
    label: 'Hoàn thành – có yêu cầu bảo trì',
    alert: { ...base, status: 'done', assignee: 'Nguyễn Văn A', acknowledgedAt: at('10:52'), resolvedAt: at('11:40') },
    maintenance: { id: 'MT-00128', code: 'MT-00128' },
  },
  below: { label: 'Không có tag, chiều "dưới ngưỡng" (ALT-00126)', alert: lowTemp },
  gasUnack: { label: 'GAS – Chưa xác nhận (mẫu, không có trong mock)', alert: { ...gas, status: 'unacknowledged', assignee: null } },
  gasProgress: { label: 'GAS – Đang xử lý (ALT-00127, theo ảnh)', alert: gas },
  fireUnack: { label: 'CHÁY – Chưa xác nhận (FIR-00018, theo ảnh)', alert: fire },
  fireProgress: {
    label: 'CHÁY – Đang xử lý',
    alert: { ...fire, status: 'in-progress', assignee: 'Hoàng Minh E', acknowledgedAt: at('14:33'), history: [{ id: 'h1', at: at('14:33'), kind: 'acknowledge', text: 'Xác nhận cảnh báo – Hoàng Minh E nhận xử lý', actor: 'Hoàng Minh E' }] },
  },
  fireFalse: {
    label: 'CHÁY – Đã đóng: báo động giả',
    alert: { ...fire, status: 'done', assignee: 'Hoàng Minh E', acknowledgedAt: at('14:33'), resolvedAt: at('14:50'), resolution: { kind: 'false-alarm', closedBy: 'live' } },
  },
  rate: { label: 'Tốc độ thay đổi – không thang đo (ALT-00112)', alert: alertRecords.find((a) => a.id === 'ALT-00112')! },
};

const STAFF_ITEMS: StaffPickerItem[] = [
  { id: 'a', name: 'Nguyễn Văn A', subtitle: 'Kỹ sư cơ khí • Bảo trì Cơ khí', shiftLabel: '', busy: false, active: 2, overdue: 0, meta: '2 đang xử lý' },
  { id: 'e', name: 'Hoàng Minh E', subtitle: 'Trưởng ca vận hành • Vận hành', shiftLabel: '', busy: false, active: 0, overdue: 0 },
];

function gauge(value: number, threshold: number, direction: 'above' | 'below', danger?: number) {
  const s = gaugeScale({ value, threshold, danger, direction })!;
  return <ThresholdGauge label="Mẫu thanh đo" {...s} valueText={gaugeValueText(s, 'bar')} valueLabel={String(value)} />;
}

/**
 * Mục 15 – drawer chi tiết cảnh báo (ảnh 27/10/2026) + biến thể mới: ThresholdGauge, WorkflowStepper dọc, Checklist plain,
 * KpiCard lg, Button danger/lg, StaffList compact.
 */
export function AlertDrawerSection() {
  const [key, setKey] = useState<string | null>(null);
  const [rec, setRec] = useState<AlertRecord | null>(null);
  const [guide, setGuide] = useState<Record<string, boolean>>({ a: false, b: true });
  const [staff, setStaff] = useState<string | null>(null);
  const ctx = () => ({ by: 'Playground', at: new Date() });
  const open = (k: string) => {
    setKey(k);
    setRec(SAMPLES[k]!.alert);
  };
  return (
    <>
      <Demo title="AlertDetailDrawer – mở theo trạng thái (dữ liệu mẫu, không ghi store)" refImg={REF_DRAWER}>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SAMPLES).map(([k, s]) => (
            <Button key={k} onClick={() => open(k)}>
              {s.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-fg-secondary">
          Ảnh thiết kế chỉ hiện trên máy dev (thư mục ảnh tham chiếu). Thao tác: xác nhận, tick hướng dẫn, ghi chú, đánh dấu đã xử lý, phân công.
        </p>
      </Demo>
      <AlertDetailDrawer
        alert={rec}
        onClose={() => setRec(null)}
        now={new Date()}
        allAlerts={alertRecords}
        maintenance={key ? SAMPLES[key]!.maintenance : null}
        canAct
        canCreateMaintenance={false}
        onAcknowledge={() => setRec((a) => a && acknowledgeAlert(a, ctx()))}
        onAssign={(_, name) => setRec((a) => a && assignAlert(a, name, ctx()))}
        onResolve={(_, note) => {
          const res = rec ? resolveAlert(rec, note, ctx()) : ({ ok: false, reason: 'status' } as const);
          if (res.ok) setRec(res.record);
          return res;
        }}
        onToggleGuide={(_, step) => setRec((a) => a && toggleGuideStep(a, step, ctx()))}
        onAddNote={(_, text) => setRec((a) => a && addAlertNote(a, text, ctx()))}
        onCreateMaintenance={() => undefined}
        onGasUpdate={(_, input, check) => {
          const res = rec ? gasUpdate(rec, input, check, ctx()) : ({ ok: false, reason: 'status' } as const);
          if (res.ok) setRec(res.record);
          return res;
        }}
        onRequestSupport={(_, input) => setRec((a) => a && requestSupport(a, input, ctx()))}
        onFireUpdate={(_, input, check) => {
          const res = rec ? fireUpdate(rec, input, check, ctx()) : ({ ok: false, reason: 'status' } as const);
          if (res.ok) setRec(res.record);
          return res;
        }}
      />

      {/* Kịch bản tăng/giảm dần chỉ có ở dev (production không đóng gói devScenarios). */}
      {import.meta.env.DEV && (
        <Demo title="Panel KHÍ GAS – mô phỏng nồng độ GS-04 (nguồn live dùng chung; dev)" refImg={REF_GAS}>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => liveSimulator.rampTo('GS-04', 46)}>Tăng dần tới 46% LEL (qua ESD)</Button>
            <Button onClick={() => liveSimulator.rampTo('GS-04', 6)}>Giảm dần về 6% LEL (dưới cấp 1)</Button>
            <Button onClick={() => liveSimulator.rampTo('GS-04', 25)}>Về 25% LEL (như ảnh)</Button>
            <Button onClick={() => liveSimulator.setBad(['GS-04'], !liveSimulator.state.bad.includes('GS-04'))}>Bật/tắt mất tín hiệu GS-04</Button>
          </div>
          <p className="text-sm text-fg-secondary">Mở mẫu "GAS – …" ở trên để xem thay đổi (banner ESD, badge mức, khoá "Đã xử lý xong"). Số đổi mỗi 2 s.</p>
        </Demo>
      )}

      {import.meta.env.DEV && (
        <Demo title="Panel BÁO CHÁY – mô phỏng tín hiệu trạm hóa hơi (nguồn live dùng chung; dev)" refImg={REF_FIRE}>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => liveSimulator.setBase(FT.heatAlarm, 'normal')}>HD-02 đã phục hồi</Button>
            <Button onClick={() => liveSimulator.setBase(FT.heatAlarm, 'alarm')}>HD-02 báo động lại</Button>
            <Button onClick={() => liveSimulator.setBad([FT.heatAlarm, FT.heatTemp], !liveSimulator.state.bad.includes(FT.heatAlarm))}>Bật/tắt mất tín hiệu HD-02</Button>
            <Button onClick={() => liveSimulator.setBase(FT.smokeAlarm, 'alarm')}>Khói SD-02 báo động</Button>
            <Button onClick={() => liveSimulator.setBase(FT.callPoint, 'activated')}>Kích hoạt nút nhấn</Button>
            <Button onClick={() => liveSimulator.rampTo(FT.gas, 14)}>GS-05 tăng tới 14% LEL</Button>
            <Button
              onClick={() => {
                liveSimulator.setBase(FT.heatAlarm, 'alarm');
                liveSimulator.setBase(FT.smokeAlarm, 'normal');
                liveSimulator.setBase(FT.callPoint, 'idle');
                liveSimulator.rampTo(FT.gas, 6);
              }}
            >
              Về như ảnh
            </Button>
          </div>
          <p className="text-sm text-fg-secondary">Mở mẫu "CHÁY – …" ở trên: xác nhận chéo (banner), khoá đóng khi đầu báo còn báo động, mất tín hiệu → kiểm tra tại chỗ.</p>
        </Demo>
      )}

      <Demo title="ThresholdGauge – role=meter: vượt ngưỡng · trong giới hạn · chiều dưới ngưỡng (đảo màu)">
        <div className="flex w-[400px] flex-col gap-3">
          {gauge(11.8, 10.5, 'above', 12)}
          {gauge(9.2, 10.5, 'above', 12)}
          {gauge(45, 50, 'below')}
        </div>
      </Demo>

      <Demo title="KpiCard size=sm valueSize=lg · Button danger/lg · StaffList compact">
        <div className="flex w-[400px] flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <KpiCard size="sm" valueSize="lg" label="Giá trị lúc cảnh báo" value="11.8" unit="bar" tone="danger" footnote="Hiện tại: 9.2 bar" />
            <KpiCard size="sm" valueSize="lg" label="Ngưỡng cho phép" value="10.5" unit="bar" tone="success" />
          </div>
          <Button variant="danger" size="lg" className="w-full">
            Xác nhận cảnh báo
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="subtle" className="w-full">
              Phân công xử lý
            </Button>
            <Button variant="subtle" className="w-full">
              Tạo yêu cầu bảo trì
            </Button>
          </div>
          <StaffList compact label="Chọn người phụ trách" items={STAFF_ITEMS} value={staff} onChange={setStaff} />
        </div>
      </Demo>

      <Demo title="WorkflowStepper orientation=vertical · Checklist variant=plain">
        <div className="flex w-[400px] flex-col gap-4">
          <WorkflowStepper
            orientation="vertical"
            label="Tiến trình mẫu"
            completed={2}
            current={2}
            steps={[
              { id: 'd', label: 'Đã phát hiện', time: '10:45:22' },
              { id: 'n', label: 'Đã gửi thông báo', time: '10:45:25' },
              { id: 'a', label: 'Chưa xác nhận' },
              { id: 'p', label: 'Đang xử lý' },
              { id: 'h', label: 'Hoàn thành' },
            ]}
          />
          <Checklist
            variant="plain"
            items={[
              { id: 'a', text: 'Kiểm tra đồng hồ áp suất cơ tại hiện trường', done: guide.a! },
              { id: 'b', text: 'Xác minh trạng thái van PSV-101', done: guide.b!, time: guide.b ? '10:58' : undefined },
            ]}
            progress={{ done: 1, total: 2, percent: 50 }}
            onToggle={(id) => setGuide((g) => ({ ...g, [id]: !g[id] }))}
          />
          <Checklist
            variant="plain"
            items={[{ id: 'c', text: 'Bị khoá khi Chưa xác nhận (aria-disabled – vẫn Tab tới được)', done: false }]}
            progress={{ done: 0, total: 1, percent: 0 }}
            onToggle={() => undefined}
            lockHint="Xác nhận cảnh báo để bắt đầu xử lý."
          />
        </div>
      </Demo>
    </>
  );
}
