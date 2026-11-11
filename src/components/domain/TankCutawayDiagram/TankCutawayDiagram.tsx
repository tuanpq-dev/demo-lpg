import { useId } from 'react';
import { cn } from '@/lib/cn';

/** Ba lớp đã tính sẵn (trang dùng `tankLayers` ở features/tank – component không tự tính thể tích). */
export type TankCutawayLayers = {
  /** Mặt thoáng chất lỏng theo CHIỀU CAO (% đường kính) – vị trí vẽ. */
  levelPct: number;
  /** Mặt phân cách nước / LPG theo chiều cao (% đường kính). */
  waterPct: number;
  /** % thể tích từng lớp (nhãn) – cộng lại 100. */
  lpgPercent: number;
  vaporPercent: number;
  waterPercent: number;
};

export type TankCutawayDiagramProps = {
  /** null → không vẽ chất lỏng (chưa có số liệu / mất tín hiệu, xem `state`). */
  layers: TankCutawayLayers | null;
  /** pending = chưa có số liệu ("—") · lost = mất tín hiệu. Bỏ qua khi có `layers`. */
  state?: 'pending' | 'lost';
  /** Kích thước thân trụ (m) – giữ đúng tỉ lệ dài/đường kính khi vẽ. */
  length: number;
  diameter: number;
  /** Tiêu đề SVG (<title>). */
  label?: string;
  /** Số chữ số lẻ của nhãn %. */
  digits?: number;
  className?: string;
};

const VB_W = 480;
const VB_H = 206;
const MAX_W = 330;
const MAX_D = 124;

const LEGEND = [
  { id: 'lpg', label: 'LPG lỏng', swatch: 'bg-info' },
  { id: 'vapor', label: 'Pha hơi / khí gas', swatch: 'bg-neutral/50' },
  { id: 'water', label: 'Nước đáy bồn', swatch: 'bg-warning' },
] as const;

/** Hộp nhãn + đường dẫn tới điểm trong lớp. */
function Callout({ x, y, text, to, align = 'start' }: { x: number; y: number; text: string; to: [number, number]; align?: 'start' | 'end' }) {
  const w = text.length * 7 + 18;
  // Giữ hộp nhãn trong khung vẽ.
  const left = Math.min(VB_W - w - 2, Math.max(2, align === 'end' ? x - w : x));
  const anchorX = to[0] < left ? left : to[0] > left + w ? left + w : to[0];
  const anchorY = to[1] < y ? y : y + 22;
  return (
    <g>
      <line x1={anchorX} y1={anchorY} x2={to[0]} y2={to[1]} className="stroke-fg-secondary/70" strokeWidth={1} />
      <circle cx={to[0]} cy={to[1]} r={2.2} className="fill-fg" />
      <rect x={left} y={y} width={w} height={22} rx={4} className="fill-surface-raised stroke-line" strokeWidth={1} />
      <text x={left + w / 2} y={y + 15} textAnchor="middle" className="fill-fg" fontSize={13}>
        {text}
      </text>
    </g>
  );
}

/**
 * Hình cắt bồn trụ nằm ngang: ba lớp nước đáy · LPG lỏng · pha hơi theo mức chiều cao, nhãn dẫn tới từng lớp,
 * chú thích 3 màu. Component thuần – nhận lớp đã tính (thể tích theo hình học viên phân ở features/tank/layers).
 * Theo ảnh "Bồn LPG V-101" (chưa có node Figma); ảnh vẽ bồn kiểu render 3D, ở đây vẽ phẳng theo token.
 */
export function TankCutawayDiagram({
  layers,
  state = 'pending',
  length,
  diameter,
  label = 'Mặt cắt bồn chứa',
  digits = 1,
  className,
}: TankCutawayDiagramProps) {
  const uid = useId().replace(/:/g, '');
  const titleId = `${uid}-t`;
  const descId = `${uid}-d`;
  const clipId = `${uid}-clip`;

  // Tỉ lệ thật: thân L + 2 đáy elip sâu D/4.
  const s = Math.min(MAX_W / (length + diameter / 2), MAX_D / diameter);
  const L = length * s;
  const D = diameter * s;
  const R = D / 2;
  const rx = D / 4;
  const cx = VB_W / 2;
  const cy = 92;
  const top = cy - R;
  const bottom = cy + R;
  const x0 = cx - L / 2;
  const x1 = cx + L / 2;
  const shell = `M ${x0} ${top} L ${x1} ${top} A ${rx} ${R} 0 0 1 ${x1} ${bottom} L ${x0} ${bottom} A ${rx} ${R} 0 0 1 ${x0} ${top} Z`;

  const fmt = (v: number) => `${v.toFixed(digits)}%`;
  const yL = layers ? bottom - (layers.levelPct / 100) * D : bottom;
  const yW = layers ? bottom - (layers.waterPct / 100) * D : bottom;
  const fullX = x0 - rx;
  const fullW = L + 2 * rx;

  const desc = layers
    ? `LPG lỏng ${fmt(layers.lpgPercent)}, pha hơi ${fmt(layers.vaporPercent)}, nước đáy ${fmt(layers.waterPercent)} thể tích. Mặt chất lỏng ở ${layers.levelPct.toFixed(1)}% chiều cao, mặt nước ở ${layers.waterPct.toFixed(1)}%.`
    : state === 'lost'
      ? 'Mất tín hiệu mức bồn – không hiển thị các lớp.'
      : 'Chưa có số liệu mức bồn.';

  const saddles = [cx - L * 0.3, cx + L * 0.3];
  const nozzles = [cx - L * 0.32, cx + L * 0.05, cx + L * 0.3];

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-labelledby={`${titleId} ${descId}`} className="h-auto w-full">
        <title id={titleId}>{label}</title>
        <desc id={descId}>{desc}</desc>
        <defs>
          <clipPath id={clipId}>
            <path d={shell} />
          </clipPath>
        </defs>

        {/* Yên đỡ + họng trên đỉnh */}
        {saddles.map((x) => (
          <path
            key={x}
            d={`M ${x - 16} ${bottom + 12} L ${x - 10} ${bottom - 6} L ${x + 10} ${bottom - 6} L ${x + 16} ${bottom + 12} Z`}
            className="fill-surface-muted stroke-line"
          />
        ))}
        {nozzles.map((x, i) => (
          <rect
            key={x}
            x={x - (i === 1 ? 9 : 5)}
            y={top - (i === 1 ? 9 : 12)}
            width={i === 1 ? 18 : 10}
            height={i === 1 ? 10 : 13}
            rx={1.5}
            className="fill-surface-muted stroke-line"
          />
        ))}
        {/* Mặt bích hai đầu */}
        <rect x={x0 - rx - 8} y={cy - 7} width={8} height={14} rx={1.5} className="fill-surface-muted stroke-line" />
        <rect x={x1 + rx} y={cy - 7} width={8} height={14} rx={1.5} className="fill-surface-muted stroke-line" />

        {/* Lòng bồn + các lớp */}
        <path d={shell} className="fill-surface-sunken" />
        {layers && (
          <g clipPath={`url(#${clipId})`}>
            <rect x={fullX} y={top} width={fullW} height={Math.max(0, yL - top)} className="fill-neutral/30" data-layer="vapor" />
            <rect x={fullX} y={yL} width={fullW} height={Math.max(0, yW - yL)} className="fill-info/80" data-layer="lpg" />
            <rect x={fullX} y={yW} width={fullW} height={Math.max(0, bottom - yW)} className="fill-warning" data-layer="water" />
            <line x1={fullX} x2={fullX + fullW} y1={yL} y2={yL} className="stroke-info" strokeWidth={1.5} />
          </g>
        )}
        <path d={shell} className="fill-none stroke-fg-secondary" strokeWidth={2} />
        {/* Đường hàn hai đầu thân */}
        <line x1={x0} x2={x0} y1={top} y2={bottom} className="stroke-line" />
        <line x1={x1} x2={x1} y1={top} y2={bottom} className="stroke-line" />

        {layers ? (
          <>
            <Callout x={x1 - 30} y={Math.max(2, top - 34)} text={`Pha hơi – ${fmt(layers.vaporPercent)}`} to={[cx + L * 0.22, (top + yL) / 2]} />
            <Callout x={x1 - 10} y={bottom + 18} text={`LPG lỏng – ${fmt(layers.lpgPercent)}`} to={[cx + L * 0.12, (yL + yW) / 2]} />
            <Callout x={x0 + 10} y={bottom + 18} align="end" text={`Nước đáy – ${fmt(layers.waterPercent)}`} to={[cx - L * 0.2, (yW + bottom) / 2]} />
          </>
        ) : (
          <text x={cx} y={cy + 4} textAnchor="middle" className="fill-fg-secondary text-sm">
            {state === 'lost' ? 'Mất tín hiệu' : '—'}
          </text>
        )}
      </svg>
      <figcaption>
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          {LEGEND.map((l) => (
            <li key={l.id} className="flex items-center gap-1.5 text-2xs text-fg-muted">
              <span aria-hidden="true" className={cn('size-2.5 rounded-xs', l.swatch)} />
              {l.label}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
