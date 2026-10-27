import type { ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Icon,
  ProgressBar,
  StatusDot,
  type DotStatus,
  type Severity,
  type WorkStatus,
} from '@/components';
import { Demo } from './Demo';

/** Ảnh Figma chỉ ở máy dev (`scratch/figma-ref/`, gitignore); bản build: undefined (không đóng gói). */
const REF_70_4037_MAINT_BUTTONS = import.meta.env.DEV ? '/scratch/figma-ref/70-4037-maint-buttons.png' : undefined;
const REF_70_3032_ALERT_TABLE = import.meta.env.DEV ? '/scratch/figma-ref/70-3032-alert-table.png' : undefined;
const REF_53_458_PRIORITY_ALARMS = import.meta.env.DEV ? '/scratch/figma-ref/53-458-priority-alarms.png' : undefined;

/** Một khối demo: component bên trái, ảnh Figma tham chiếu bên phải. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-fg-muted/65">{label}</span>
      {children}
    </div>
  );
}

const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
const statuses: WorkStatus[] = ['unacknowledged', 'pending', 'in-progress', 'done'];
const dots: DotStatus[] = ['success', 'warning', 'danger', 'offline', 'live'];

const alarms = [
  { code: 'PT-201', time: '10 phút trước', text: 'Áp suất đầu vào hóa hơi cao.', critical: true },
  { code: 'TT-302', time: '24 phút trước', text: 'Nhiệt độ tiệm cận giới hạn trên.' },
  { code: 'LT-101', time: '1 giờ trước', text: 'Mức bồn V-101 giảm nhanh bất thường.' },
];

export function PrimitivesSection() {
  return (
    <div className="flex flex-col gap-10">
      {/* ---------------- Button ---------------- */}
      <Demo title="Button" node="53:124 · 70:4037 · 70:2890" refImg={REF_70_4037_MAINT_BUTTONS}>
        <Row label="ghost / md">
          <Button icon={<Icon name="calendar" />}>Hôm nay</Button>
          <Button icon={<Icon name="download" />}>Xuất báo cáo</Button>
          <Button icon={<StatusDot status="live" />}>Dữ liệu trực tiếp</Button>
          <Button icon={<Icon name="clock" />}>01/06/2026 ; 08:24:00</Button>
        </Row>
        <Row label="icon / md">
          <Button variant="icon" aria-label="Làm mới" icon={<Icon name="refresh" box={12} />} />
          <Button variant="icon" pressed aria-label="Làm mới" icon={<Icon name="refreshAccent" box={12} />} />
        </Row>
        <Row label="primary / md">
          <Button variant="primary" icon={<Icon name="add" />}>
            Tạo yêu cầu bảo trì
          </Button>
        </Row>
        <Row label="size sm">
          <Button size="sm">Toàn cảnh</Button>
          <Button size="sm" variant="primary">
            Lưu
          </Button>
          <Button size="sm" variant="icon" aria-label="Làm mới" icon={<Icon name="refresh" box={12} />} />
        </Row>
        <Row label="link">
          <Button variant="link">Xem tất cả</Button>
          <Button variant="link" size="sm">
            Chi tiết
          </Button>
        </Row>
        <Row label="disabled">
          <Button disabled>Ghost</Button>
          <Button variant="primary" disabled>
            Primary
          </Button>
        </Row>
      </Demo>

      {/* ---------------- StatusDot ---------------- */}
      <Demo title="StatusDot" node="53:410 · 53:416 · 53:422 · 53:126">
        <Row label="circle / md">
          {dots.map((s) => (
            <span key={s} className="inline-flex items-center gap-2 text-sm">
              <StatusDot status={s} /> {s}
            </span>
          ))}
        </Row>
        <Row label="square / md">
          {dots.map((s) => (
            <span key={s} className="inline-flex items-center gap-2 text-sm">
              <StatusDot status={s} shape="square" /> {s}
            </span>
          ))}
        </Row>
        <Row label="sm · pulse">
          <StatusDot status="success" size="sm" />
          <StatusDot status="live" pulse label="Đang cập nhật trực tiếp" />
        </Row>
      </Demo>

      {/* ---------------- Badge ---------------- */}
      <Demo title="Badge" node="70:3032 (bảng cảnh báo) · 70:5562 · 70:5432" refImg={REF_70_3032_ALERT_TABLE}>
        <Row label="severity">
          {severities.map((s) => (
            <Badge key={s} variant="severity" value={s} />
          ))}
        </Row>
        <Row label="severity compact">
          {severities.map((s) => (
            <Badge key={s} variant="severity" value={s} compact />
          ))}
        </Row>
        <Row label="status">
          {statuses.map((s) => (
            <Badge key={s} variant="status" value={s} />
          ))}
        </Row>
        <Row label="status withIcon">
          {statuses.map((s) => (
            <Badge key={s} variant="status" value={s} withIcon />
          ))}
        </Row>
        <Row label="nhãn tuỳ biến">
          <Badge variant="status" value="done" withIcon>
            Hoàn thành
          </Badge>
        </Row>
      </Demo>

      {/* ---------------- Card ---------------- */}
      <Demo title="Card" node="53:458 · 53:495" refImg={REF_53_458_PRIORITY_ALARMS}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            title="Cảnh báo ưu tiên"
            icon={<Icon name="danger" />}
            action={{ label: 'Xem tất cả', onClick: () => undefined }}
            padding="none"
          >
            {alarms.map((a, i) => (
              <div key={a.code}>
                <div className={a.critical ? 'flex flex-col gap-2.5 bg-danger-strong/15 px-4 py-2.5' : 'flex flex-col gap-2.5 px-4 py-2.5'}>
                  <div className="flex items-center justify-between">
                    <span className={a.critical ? 'text-sm font-bold text-danger-text' : 'text-sm font-bold text-warning-soft'}>
                      {a.code}
                    </span>
                    <span className="text-2xs text-fg-muted/65">{a.time}</span>
                  </div>
                  <p className="text-sm text-fg-muted/70">{a.text}</p>
                </div>
                {i < alarms.length - 1 && <Divider />}
              </div>
            ))}
          </Card>
          <Card title="Theo dõi thiết bị" headerVariant="plain">
            <p className="text-sm text-fg-secondary">headerVariant=&quot;plain&quot;, padding md (17px)</p>
          </Card>
          <Card title="tone=danger · radius=lg" tone="danger" radius="lg" headerVariant="plain">
            <p className="text-sm text-fg-secondary">Viền danger-strong/50 (KPI &quot;Cảnh báo&quot;)</p>
          </Card>
          <Card title="tone=success" tone="success" headerVariant="plain">
            <p className="text-sm text-fg-secondary">Viền success-strong/30 (KPI &quot;Sức khỏe thiết bị&quot;)</p>
          </Card>
        </div>
      </Demo>

      {/* ---------------- ProgressBar ---------------- */}
      <Demo title="ProgressBar" node="53:211 · 53:348–53:373 · 70:5098">
        <div className="flex max-w-sm flex-col gap-4">
          <Row label="sm · success">
            <ProgressBar value={98.7} label="Sức khỏe thiết bị" className="flex-1" />
          </Row>
          <Row label="sm · info · solid">
            <ProgressBar value={18} max={27} tone="info" track="solid" label="Đang thực hiện 18/27" className="flex-1" />
          </Row>
          <Row label="md · accent">
            <ProgressBar value={40} size="md" tone="accent" label="Xưởng 1" className="flex-1" />
          </Row>
          <Row label="md · warning">
            <ProgressBar value={30} size="md" tone="warning" label="Xưởng 2" className="flex-1" />
          </Row>
          <Row label="md · success">
            <ProgressBar value={25} size="md" tone="success" label="Xưởng 3" className="flex-1" />
          </Row>
          <Row label="md · neutral">
            <ProgressBar value={20} size="md" tone="neutral" label="Lò hơi" className="flex-1" />
          </Row>
        </div>
      </Demo>

      {/* ---------------- Divider ---------------- */}
      <Demo title="Divider" node="53:442 · 53:89">
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4">
          <span className="text-xs text-fg-muted/65">default (line/30)</span>
          <Divider />
          <span className="text-xs text-fg-muted/65">subtle (line/10)</span>
          <Divider tone="subtle" />
          <span className="text-xs text-fg-muted/65">strong (#737373)</span>
          <Divider tone="strong" />
        </div>
        <div className="flex h-10 items-center gap-4 rounded-lg bg-surface px-4 text-sm">
          <span>Cảm biến</span>
          <Divider orientation="vertical" />
          <span>Van</span>
          <Divider orientation="vertical" tone="strong" />
          <span>Bơm</span>
        </div>
      </Demo>
    </div>
  );
}
