import type { CSSProperties } from 'react';
import { icons, type IconName } from '@/assets/digital-twin';
import { cn } from '@/lib/cn';
import { Icon } from '../Icon';

/** neutral: thiết bị mất kết nối (nhãn tự sinh ở renderer 3D khi có liveData). */
export type MapMarkerTone = 'success' | 'accent' | 'warning' | 'danger' | 'neutral';

export type MapMarkerData = {
  id: string;
  /** Toạ độ điểm neo theo phân số của ảnh bản đồ (0–1), không phụ thuộc kích thước hiển thị. */
  x: number;
  y: number;
  /**
   * - callout: hộp 125×57 + chốt dọc bên dưới, neo ở đáy chốt (53:245)
   * - side:    hộp 104×52 + đường nối ngang bên phải, neo ở đầu đường nối (53:289 "Khu nạp LPG")
   * - tag:     nhãn nhỏ, neo ở tâm (53:298 "Khu sản xuất")
   */
  variant: 'callout' | 'side' | 'tag';
  tone?: MapMarkerTone;
  title: string;
  value?: string;
  /** Chấm trạng thái trước giá trị (callout success – 53:251). */
  showDot?: boolean;
  /** Icon cảnh báo trước giá trị (callout danger – 53:280). */
  showWarningIcon?: boolean;
};

export type MapMarkerProps = MapMarkerData & {
  /** Hệ số zoom hiện tại của bản đồ – marker co ngược để giữ nguyên kích thước chữ. */
  zoom?: number;
  /** Nền tối trong mờ + blur nền (renderer 3D: thấy lờ mờ cảnh phía sau). Mặc định nền đặc như Figma. */
  translucent?: boolean;
  onClick?: (id: string) => void;
};

const borderTone: Record<MapMarkerTone, string> = {
  success: 'border-success/50 shadow-glow-success',
  accent: 'border-accent/50 shadow-glow-accent',
  warning: 'border-warning/50 shadow-glow-warning',
  danger: 'border-danger-strong/50 shadow-glow-danger',
  neutral: 'border-neutral/30',
};

const valueTone: Record<MapMarkerTone, string> = {
  success: 'text-success',
  accent: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger-strong',
  neutral: 'text-neutral',
};

const pinIcon: Record<Exclude<MapMarkerTone, 'warning' | 'neutral'>, IconName> = {
  success: 'mapPinSuccess',
  accent: 'mapPinAccent',
  danger: 'mapPinDanger',
};

/** Điểm neo của từng kiểu → dịch chuyển hộp và gốc co giãn. */
const anchor: Record<MapMarkerData['variant'], { translate: string; origin: string }> = {
  callout: { translate: 'translate(-50%, -100%)', origin: '50% 100%' },
  side: { translate: 'translate(-100%, -50%)', origin: '100% 50%' },
  tag: { translate: 'translate(-50%, -50%)', origin: '50% 50%' },
};

/** Nhãn overlay trên PlantMap (Figma 53:245–53:299). */
export function MapMarker({
  id,
  x,
  y,
  variant,
  tone = 'accent',
  title,
  value,
  showDot,
  showWarningIcon,
  zoom = 1,
  translucent,
  onClick,
}: MapMarkerProps) {
  const glass = translucent && 'backdrop-blur-[3px]';
  const a = anchor[variant];
  const style: CSSProperties = {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: `${a.translate} scale(${1 / zoom})`,
    transformOrigin: a.origin,
  };
  const Tag = onClick ? 'button' : 'div';
  const common = {
    style,
    className: 'absolute text-left',
    ...(onClick ? { type: 'button' as const, onClick: () => onClick(id) } : {}),
    'aria-label': value ? `${title}: ${value}` : title,
  };

  if (variant === 'tag') {
    return (
      <Tag {...common} className={cn(common.className, 'opacity-80')}>
        <span
          className={cn(
            'block whitespace-nowrap rounded-sm px-2 py-1 text-base font-semibold leading-[16.5px] text-fg',
            translucent ? 'bg-surface-raised/85' : 'bg-surface-raised',
            glass,
          )}
        >
          {title}
        </span>
      </Tag>
    );
  }

  const valueRow = value && (
    <span className={cn('flex items-center justify-center gap-1 text-md font-semibold leading-6', valueTone[tone])}>
      {showDot && <span aria-hidden="true" className="size-1.5 rounded-full bg-success-strong" />}
      {showWarningIcon && <Icon name="danger" box={18} />}
      <span className="whitespace-pre">{value}</span>
    </span>
  );

  if (variant === 'side') {
    return (
      <Tag {...common} className={cn(common.className, 'flex items-center')}>
        <span
          className={cn(
            'flex h-[52px] w-[104px] flex-col items-center justify-center rounded-sm border px-2',
            translucent ? 'bg-surface/85' : 'bg-surface',
            glass,
            borderTone[tone],
          )}
        >
          <span className="whitespace-nowrap text-sm leading-[16.5px] text-fg-muted">{title}</span>
          {valueRow}
        </span>
        {/* Đường nối 65px; SVG gốc 70.3×10.7 giữ nguyên kích thước (Figma 53:297) */}
        <span aria-hidden="true" className="relative h-0 w-[65px]">
          <img src={icons.mapConnectorWarning} alt="" className="absolute -top-[5.33px] left-0 block max-w-none" />
        </span>
      </Tag>
    );
  }

  // callout
  return (
    <Tag {...common} className={cn(common.className, 'flex w-[125px] flex-col items-center')}>
      <span
        className={cn(
          'flex h-[57px] w-full flex-col items-center justify-center rounded-sm border',
          translucent ? 'bg-surface-raised/85' : 'bg-surface-raised',
          glass,
          borderTone[tone],
        )}
      >
        <span className="whitespace-nowrap text-sm leading-[16.5px] text-fg-muted">{title}</span>
        {valueRow}
      </span>
      {/* Chốt dọc 11×54 (Figma 53:253) – kích thước gốc của SVG */}
      <img
        src={icons[pinIcon[tone === 'warning' || tone === 'neutral' ? 'accent' : tone]]}
        alt=""
        aria-hidden="true"
        className={cn('block max-w-none', tone === 'neutral' && 'opacity-50 grayscale')}
      />
    </Tag>
  );
}
