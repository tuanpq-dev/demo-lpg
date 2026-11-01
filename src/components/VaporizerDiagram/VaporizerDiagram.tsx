import { cn } from '@/lib/cn';
import { GaugeIcon, SignalLostIcon, ThermometerIcon } from '../Icon';

export type DiagramReadingTone = 'normal' | 'warning' | 'danger' | 'lost' | 'pending';

export type DiagramReading = {
  /** "58.4°C" · "Mất tín hiệu" · "—". */
  text: string;
  tone: DiagramReadingTone;
};

export type VaporizerDiagramProps = {
  /** "MÁY HÓA HƠI E-101A". */
  title: string;
  /** Cảm biến nhiệt độ đầu ra. */
  temperature: DiagramReading;
  /** Cảm biến áp suất đầu ra. */
  pressure: DiagramReading;
  /** Tên truy cập của sơ đồ (tóm tắt số liệu cho trình đọc màn hình). */
  label: string;
  className?: string;
};

const valueFill: Record<DiagramReadingTone, string> = {
  normal: 'fill-fg',
  warning: 'fill-warning',
  danger: 'fill-danger-text',
  lost: 'fill-fg-secondary',
  pending: 'fill-fg-secondary',
};

const boxStroke: Record<DiagramReadingTone, string> = {
  normal: 'stroke-line/40',
  warning: 'stroke-warning/60',
  danger: 'stroke-danger',
  lost: 'stroke-line/40',
  pending: 'stroke-line/40',
};

/** Ô số đo cảm biến: caption trên, khung có icon + số; mất tín hiệu → icon tín hiệu + chữ xám. */
function SensorBox({ x, y, w, caption, captionClass, reading, icon }: {
  x: number;
  y: number;
  w: number;
  caption: string;
  captionClass: string;
  reading: DiagramReading;
  icon: 'temp' | 'pressure';
}) {
  const lost = reading.tone === 'lost';
  const Icon = lost ? SignalLostIcon : icon === 'temp' ? ThermometerIcon : GaugeIcon;
  return (
    <g>
      <text x={x + w / 2} y={y - 8} textAnchor="middle" className={cn('text-[13px] font-semibold', captionClass)}>
        {caption}
      </text>
      <rect x={x} y={y} width={w} height={32} rx={3} className={cn('fill-surface-sunken', boxStroke[reading.tone])} strokeWidth={1.5} />
      <Icon x={x + 12} y={y + 5} size={22} className={icon === 'temp' && !lost ? 'text-warning' : lost ? 'text-fg-secondary' : 'text-accent'} />
      <text x={x + 44} y={y + 21} className={cn('text-[16px] font-bold tabular-nums', valueFill[reading.tone])}>
        {reading.text}
      </text>
    </g>
  );
}

/** Sóng nhiệt trong bộ gia nhiệt (3 đường cong dọc). */
const WAVE = 'c -14 18 -14 34 0 52 c 14 18 14 34 0 52 c -14 18 -14 34 0 52';

/**
 * "Sơ đồ thiết bị" máy hóa hơi (ảnh `scratch/figma-ref/op-device-left.png`): LPG lỏng vào → bộ gia nhiệt / buồng hóa hơi
 * → LPG khí ra; hai cảm biến đầu ra nối bằng đường đứt. SVG co giãn theo chiều rộng (viewBox 1330 × 390 như ảnh);
 * màu qua class token (`fill-*`, `stroke-*`). Toàn khối là một hình (`role="img"`) – số liệu đọc qua `label`.
 */
export function VaporizerDiagram({ title, temperature, pressure, label, className }: VaporizerDiagramProps) {
  return (
    <svg viewBox="0 60 1330 390" role="img" aria-label={label} className={cn('h-auto w-full', className)}>
      <defs>
        <marker id="vd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 10 5 0 10Z" className="fill-accent" />
        </marker>
      </defs>

      {/* Đầu vào */}
      <text x={28} y={243} className="fill-fg-secondary text-[13px] font-semibold tracking-label">LPG lỏng đầu vào</text>
      <rect x={28} y={251} width={104} height={37} rx={2} className="fill-surface-muted/30 stroke-line/40" />
      <text x={80} y={276} textAnchor="middle" className="fill-fg text-[19px]">LPG lỏng</text>
      <line x1={132} y1={255} x2={248} y2={255} className="stroke-accent" strokeWidth={3} markerEnd="url(#vd-arrow)" />

      {/* Thân máy */}
      <rect x={250} y={160} width={440} height={190} className="fill-accent/5 stroke-accent" strokeWidth={2.5} />
      <line x1={499} y1={162} x2={499} y2={348} className="stroke-accent/40" strokeDasharray="4 4" />
      {[285, 318, 350].map((x) => (
        <path key={x} d={`M ${x} 182 ${WAVE}`} fill="none" className="stroke-fg-secondary/60" strokeWidth={2} />
      ))}
      <rect x={368} y={201} width={262} height={32} rx={3} className="fill-surface-sunken stroke-accent" strokeWidth={1.5} />
      <text x={499} y={224} textAnchor="middle" className="fill-accent text-[19px] font-semibold">{title}</text>
      <rect x={357} y={255} width={113} height={32} rx={3} className="fill-surface-muted/60 stroke-line/40" />
      <text x={413} y={276} textAnchor="middle" className="fill-fg text-[14px] font-semibold">Bộ gia nhiệt</text>
      <rect x={510} y={255} width={132} height={32} rx={3} className="fill-surface-muted/60 stroke-line/40" />
      <text x={576} y={276} textAnchor="middle" className="fill-fg text-[14px] font-semibold">Buồng hóa hơi</text>

      {/* Đầu ra */}
      <line x1={642} y1={255} x2={1112} y2={255} className="stroke-accent" strokeWidth={3} markerEnd="url(#vd-arrow)" />
      <text x={1165} y={235} textAnchor="middle" className="fill-fg-secondary text-[13px] font-semibold tracking-label">LPG khí đầu ra</text>
      <rect x={1117} y={243} width={96} height={30} rx={2} className="fill-surface-muted/30 stroke-line/40" />
      <text x={1165} y={265} textAnchor="middle" className="fill-fg text-[19px]">LPG khí</text>

      {/* Cảm biến */}
      <path d="M 607 160 L 665 115 L 786 115" fill="none" className="stroke-fg-secondary/60" strokeDasharray="4 4" />
      <SensorBox x={786} y={97} w={126} caption="Cảm biến nhiệt độ đầu ra" captionClass="fill-warning" reading={temperature} icon="temp" />
      <path d="M 610 343 L 668 389 L 789 389" fill="none" className="stroke-fg-secondary/60" strokeDasharray="4 4" />
      <SensorBox x={789} y={371} w={138} caption="Cảm biến áp suất đầu ra" captionClass="fill-fg-secondary" reading={pressure} icon="pressure" />
    </svg>
  );
}
