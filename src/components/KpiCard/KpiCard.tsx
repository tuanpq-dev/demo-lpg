import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card, type CardTone } from '../Card';
import { InfoIcon, SignalLostIcon } from '../Icon';
import { ProgressBar, type ProgressTone } from '../ProgressBar';

export type KpiVariant = 'default' | 'danger' | 'with-progress' | 'compact';
export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
export type KpiSubTone = KpiTone | 'muted' | 'warning-soft';

export type KpiCardProps = {
  label: string;
  /**
   * Định nghĩa/ghi chú của chỉ số (vd "Mức bồn = % thể tích toàn bộ chất lỏng"): tooltip khi rê chuột + đọc kèm nhãn
   * cho trình đọc màn hình. `hintIcon` hiện thêm icon ⓘ cạnh nhãn.
   */
  hint?: string;
  hintIcon?: boolean;
  /** Icon trong khung (15–24px tuỳ màn); đặt cuối hàng tiêu đề, hoặc đầu nếu iconPosition="start". */
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  value: ReactNode;
  /** Đơn vị cạnh giá trị: "Nm³", "%", "bar"… */
  unit?: string;
  /** Text dòng phụ (tuỳ chọn, mặc định không có): "+2.5%", "Ổn định", "+12% vs tháng trước"… */
  sub?: ReactNode;
  /**
   * Ghi chú nhỏ (12px) CÙNG DÒNG, ngay sau số – "↑12", "(67%)", "(2 chưa xử lý)" (KPI Nhật ký vận hành, Figma 64:875).
   * Màu theo `valueNoteTone` (mặc định muted), icon tuỳ chọn `valueNoteIcon` (mũi tên tăng). Chỉ variant md.
   */
  valueNote?: ReactNode;
  valueNoteTone?: KpiSubTone;
  valueNoteIcon?: ReactNode;
  /** Mất tín hiệu (tag bad / quá 10 s không cập nhật): số xám "—", dòng phụ "Mất tín hiệu" + icon – không hiện số cũ. */
  signalLost?: boolean;
  subTone?: KpiSubTone;
  /**
   * Icon dòng phụ (trend ↑, "—", ⚠…). Có thể dùng một mình không kèm `sub`,
   * ví dụ "Mức bồn V-101" chỉ hiện "—" (53:239) như ảnh Figma.
   */
  subIcon?: ReactNode;
  /**
   * Giữ chỗ dòng phụ khi chưa có `sub` (số liệu trực tiếp đang chờ) – thẻ không cao thêm khi dữ liệu về (tránh layout
   * shift). Chỉ variant md.
   */
  reserveSub?: boolean;
  /** Làm mờ dòng phụ 70% – dòng trạng thái ("Ổn định", "Bình thường", "—") khác dòng trend (53:187, 53:199, 53:238). */
  subDim?: boolean;
  /**
   * - default:      nhãn xanh nhạt 16, số 28/42, đơn vị, dòng phụ (53:167)
   * - danger:        viền đỏ, số + đơn vị đỏ, link "Xem chi tiết" (53:213)
   * - with-progress: viền xanh, ProgressBar dưới giá trị (53:201)
   * - compact:       số 28/32, bo 8px – KPI Cảnh báo (70:2958) & Bảo trì (70:4508)
   */
  variant?: KpiVariant;
  /** Màu số (và nhãn nếu `toneLabel`). */
  tone?: KpiTone;
  /** Tô nhãn theo tone (KPI Cảnh báo 70:2964–70:2995). */
  toneLabel?: boolean;
  /**
   * Thẻ thấp (~104px, trang chi tiết tài sản): padding dọc 14px, dòng phụ 11px. Dùng với default (kèm progress
   * tuỳ chọn). Không đổi kích thước số.
   */
  dense?: boolean;
  /**
   * Viền theo tone – chỉ áp dụng cho compact: danger (KPI "Quá hạn" 70:5058), primary/info, warning, success
   * (5 KPI màn Báo cáo – ảnh thiết kế); neutral → viền line-card.
   */
  outlined?: boolean;
  /** compact: viền line-card (Bảo trì) thay vì line/30 (Cảnh báo). */
  strongBorder?: boolean;
  /** ProgressBar dưới giá trị – bắt buộc với "with-progress", tuỳ chọn với compact (70:5097). */
  progress?: { value: number; max?: number; tone?: ProgressTone };
  /** Link cuối thẻ (variant="danger": "Xem chi tiết"). */
  action?: { label: string; onClick?: () => void };
  /**
   * sm = ô số liệu nhỏ (nhãn 12–14px, số 14px, viền line/30, không bóng) – "Thiết bị liên quan" ở chi tiết bảo trì
   * (ảnh MT-00128). Dùng `label`, `value`, `unit`, `tone`, `signalLost`, `hint`; bỏ qua variant/icon/progress/sub.
   */
  size?: 'md' | 'sm';
  /**
   * sm: ô thông tin to hơn – nhãn 14px, giá trị 16px đậm, đệm 14px (5 ô đầu modal "Cập nhật tiến độ bảo trì"; ảnh thiết kế).
   */
  emphasis?: boolean;
  /** sm: căn giữa nhãn/giá trị (thông số sau bảo trì – modal nghiệm thu). */
  align?: 'start' | 'center';
  /** sm: dòng phụ nhỏ dưới giá trị ("Ngưỡng: 10.5", "Hiện tại: 9.6 bar"). */
  footnote?: ReactNode;
  /**
   * sm: lg = ô thông số lớn – nhãn 12px đậm, SỐ 24px đậm + đơn vị 16px cùng màu, nền nhạt, đệm 16px ("Thông số cảnh báo" ở
   * drawer chi tiết cảnh báo; ảnh số ~28px → token `xl` 24 vì ô chỉ ~200px trong drawer 440px).
   */
  valueSize?: 'md' | 'lg';
  className?: string;
};

const valueTone: Record<KpiTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-text',
  info: 'text-info',
  primary: 'text-primary',
};

/** Viền thẻ compact `outlined` theo tone. */
const outlineTone: Record<KpiTone, CardTone> = {
  neutral: 'strong',
  success: 'success-vivid',
  warning: 'warning',
  danger: 'danger',
  info: 'primary',
  primary: 'primary',
};

const subToneClass: Record<KpiSubTone, string> = {
  ...valueTone,
  muted: 'text-fg-secondary',
  'warning-soft': 'text-warning-soft',
};

/** Nhãn ô số liệu: `title` = nhãn + định nghĩa (rê chuột), định nghĩa đọc kèm cho trình đọc màn hình. */
function KpiLabel({ label, hint, className }: { label: string; hint?: string; className?: string }) {
  return (
    <span className={className} title={hint ? `${label} – ${hint}` : undefined}>
      {label}
      {hint && <span className="sr-only">. {hint}</span>}
    </span>
  );
}

function SignalLostText({ size, className }: { size: number; className: string }) {
  return (
    <span className={cn('flex items-center gap-1 text-fg-secondary', className)}>
      <SignalLostIcon size={size} className="shrink-0" />
      Mất tín hiệu
    </span>
  );
}

/** Đơn vị dính số ("25°C", "80%") hay cách một khoảng ("3.2 bar"). */
const withUnit = (unit?: string) => (unit ? (unit.startsWith('°') || unit === '%' ? unit : ` ${unit}`) : null);

type StatProps = Pick<KpiCardProps, 'label' | 'hint' | 'value' | 'unit' | 'tone' | 'signalLost' | 'footnote' | 'emphasis' | 'align' | 'className'>;

/** size="sm" valueSize="lg": ô thông số lớn (drawer chi tiết cảnh báo). */
function KpiStatLarge({ label, hint, value, unit, tone = 'neutral', signalLost, footnote, className }: StatProps) {
  // Số ≥ 24px đậm = chữ lớn WCAG → danger-strong được phép (đơn vị 16px thường dùng danger-text).
  // eslint-disable-next-line no-restricted-syntax -- chữ lớn 24px đậm
  const big = tone === 'danger' ? 'text-danger-strong' : valueTone[tone];
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 rounded-md border border-line/30 bg-surface-muted/40 px-4 py-3.5', className)}>
      <KpiLabel label={label} hint={hint} className="truncate text-sm font-semibold text-fg-secondary" />
      {signalLost ? (
        <SignalLostText size={16} className="text-base" />
      ) : (
        <span className="flex items-baseline gap-1.5 whitespace-nowrap tabular-nums">
          <span className={cn('text-xl font-bold leading-8', big)}>{value}</span>
          {unit && <span className={cn('text-md', valueTone[tone])}>{unit}</span>}
        </span>
      )}
      {footnote && <span className="text-sm text-fg-secondary">{footnote}</span>}
    </div>
  );
}

/** size="sm": ô số liệu nhỏ (thiết bị liên quan, modal tiến độ / nghiệm thu). */
function KpiStat({ label, hint, value, unit, tone = 'neutral', signalLost, footnote, emphasis, align = 'start', className }: StatProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-md border border-line/30',
        emphasis ? 'gap-1 px-3.5 py-3' : 'gap-0.5 px-2.5 py-2',
        align === 'center' && 'items-center justify-center text-center',
        className,
      )}
    >
      <KpiLabel label={label} hint={hint} className={cn('truncate text-fg-secondary', emphasis ? 'text-base' : 'text-sm')} />
      {signalLost ? (
        <SignalLostText size={14} className="text-sm" />
      ) : (
        <span
          className={cn(
            'truncate tabular-nums',
            emphasis ? 'text-md font-semibold' : 'text-base',
            tone === 'neutral' ? 'text-fg' : cn('font-bold', valueTone[tone]),
          )}
        >
          {value}
          {withUnit(unit)}
        </span>
      )}
      {footnote && <span className="text-sm text-fg-secondary">{footnote}</span>}
    </div>
  );
}

/** Tone viền thẻ md theo variant / outlined / strongBorder. */
function cardToneOf(variant: KpiVariant, tone: KpiTone, outlined?: boolean, strongBorder?: boolean): CardTone {
  if (variant === 'danger') return 'danger';
  if (variant === 'with-progress') return 'success';
  if (variant === 'compact' && outlined) return outlineTone[tone];
  if (variant === 'compact' && strongBorder) return 'strong';
  return 'default';
}

function labelColor(variant: KpiVariant, tone: KpiTone, toneLabel?: boolean) {
  if (toneLabel) return valueTone[tone];
  if (variant === 'compact') return 'text-fg-secondary';
  return variant === 'danger' ? 'text-fg-muted' : 'text-fg-label';
}

function bodyClassOf(variant: KpiVariant, dense?: boolean) {
  // with-progress: số nằm ngay dưới nhãn (Figma 53:207), không dàn đều theo chiều cao như các thẻ khác.
  const base = variant === 'compact' ? 'gap-2' : variant === 'with-progress' ? 'gap-0 py-[18px]' : 'justify-between gap-0';
  return cn(base, dense && 'justify-start gap-1 py-3.5');
}

type HeaderProps = Pick<KpiCardProps, 'label' | 'hint' | 'hintIcon' | 'icon' | 'iconPosition'> & { labelClass: string };

/** Hàng tiêu đề thẻ md: icon (đầu/cuối) + nhãn (+ ⓘ). */
function KpiHeader({ label, hint, hintIcon, icon, iconPosition = 'end', labelClass }: HeaderProps) {
  return (
    <div className={cn('flex items-center', iconPosition === 'start' ? 'gap-1' : 'justify-between gap-2')}>
      {iconPosition === 'start' && icon}
      <span className={cn(labelClass, hintIcon && 'flex items-center gap-1')} title={hint ? `${label} – ${hint}` : label}>
        {hintIcon ? <span className="truncate">{label}</span> : label}
        {hintIcon && <InfoIcon size={14} className="shrink-0 text-fg-secondary" />}
        {hint && <span className="sr-only">. {hint}</span>}
      </span>
      {iconPosition === 'end' && icon}
    </div>
  );
}

type SubLineProps = Pick<KpiCardProps, 'sub' | 'subIcon' | 'subDim' | 'signalLost' | 'dense' | 'reserveSub'> & { subTone: KpiSubTone };

/** Dòng phụ thẻ md (trend / trạng thái) hoặc "Mất tín hiệu". */
function KpiSubLine({ sub, subIcon, subDim, subTone, signalLost, dense, reserveSub }: SubLineProps) {
  const height = dense ? 'h-4 text-xs' : 'h-6 text-md';
  if (signalLost) {
    return (
      <div className={cn('flex items-center gap-1 text-fg-secondary', height)} role="status">
        <SignalLostIcon size={dense ? 12 : 16} className="shrink-0" />
        <span className="truncate">Mất tín hiệu</span>
      </div>
    );
  }
  if (sub === undefined && !subIcon) return reserveSub ? <div aria-hidden="true" className={height} /> : null;
  return (
    <div className={cn('flex items-center gap-1', height, subToneClass[subTone], subDim && 'opacity-70')}>
      {subIcon}
      {sub !== undefined && <span className="truncate">{sub}</span>}
    </div>
  );
}

/** Link cuối thẻ – 16px theo tone thẻ (53:229), khác Button variant="link" (12px accent) nên dùng button gốc. */
function KpiAction({ action, danger }: { action: NonNullable<KpiCardProps['action']>; danger: boolean }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      className={cn(
        // Link không chỉ dựa vào màu: luôn gạch chân + mũi tên.
        'self-start rounded-sm text-md underline decoration-1 underline-offset-2 hover:decoration-2',
        danger ? 'text-danger-text' : 'text-accent',
      )}
    >
      {action.label}
      <span aria-hidden="true"> →</span>
    </button>
  );
}

/** Giá trị thẻ md: số (+ đơn vị, ghi chú cùng dòng). */
function KpiValue({
  value,
  unit,
  valueNote,
  valueNoteTone,
  valueNoteIcon,
  signalLost,
  compact,
  danger,
  tone,
}: Pick<KpiCardProps, 'value' | 'unit' | 'valueNote' | 'valueNoteIcon' | 'signalLost'> & {
  valueNoteTone: KpiSubTone;
  compact: boolean;
  danger: boolean;
  tone: KpiTone;
}) {
  // Số KPI là "chữ lớn" WCAG (text-kpi / text-2xl = 28px đậm ≥ 18.66px đậm) → danger-strong được phép (4.54:1 ≥ 3:1).
  const numberClass = cn(
    'font-bold',
    compact ? 'text-2xl' : 'text-kpi',
    // eslint-disable-next-line no-restricted-syntax -- chữ lớn 28px đậm
    signalLost ? 'text-fg-disabled' : danger ? 'text-danger-strong' : valueTone[tone],
  );
  return (
    <p className="flex items-baseline gap-1 whitespace-nowrap">
      <span className={numberClass}>{signalLost ? '—' : value}</span>
      {unit && !signalLost && (
        // Đơn vị phụ ("Active"): thứ bậc bằng CỠ (16px thường so với số 28px đậm), không bằng độ mờ.
        <span className={cn('text-md font-normal', danger ? 'text-danger-text' : 'text-fg-muted')}>{unit}</span>
      )}
      {valueNote !== undefined && !signalLost && (
        <span className={cn('ml-1 inline-flex items-center gap-0.5 text-sm font-normal', subToneClass[valueNoteTone])}>
          {valueNoteIcon}
          {valueNote}
        </span>
      )}
    </p>
  );
}

export function KpiCard(props: KpiCardProps) {
  if (props.size === 'sm') return props.valueSize === 'lg' ? <KpiStatLarge {...props} /> : <KpiStat {...props} />;
  const {
    label,
    sub,
    subTone = 'success',
    valueNoteTone = 'muted',
    variant = 'default',
    tone = 'neutral',
    progress,
    action,
    dense,
    className,
  } = props;
  const compact = variant === 'compact';
  const danger = variant === 'danger';
  const labelClass = cn('min-w-0 truncate text-md font-semibold leading-6', compact && 'tracking-label', labelColor(variant, tone, props.toneLabel));

  return (
    <Card
      tone={cardToneOf(variant, tone, props.outlined, props.strongBorder)}
      radius={compact ? 'lg' : 'xl'}
      className={cn('h-full', className)}
      bodyClassName={bodyClassOf(variant, dense)}
    >
      <KpiHeader {...props} labelClass={labelClass} />

      <div className={cn('flex flex-col', compact && sub !== undefined && 'gap-2')}>
        <KpiValue {...props} valueNoteTone={valueNoteTone} compact={compact} danger={danger} tone={tone} />

        {progress && (
          <ProgressBar
            value={progress.value}
            max={progress.max}
            tone={progress.tone ?? 'success'}
            track={compact ? 'solid' : 'subtle'}
            label={label}
            className={dense ? 'mt-1.5' : 'mt-2'}
          />
        )}

        <KpiSubLine
          sub={sub}
          subIcon={props.subIcon}
          subDim={props.subDim}
          subTone={subTone}
          signalLost={props.signalLost}
          dense={dense}
          reserveSub={props.reserveSub}
        />

        {action && <KpiAction action={action} danger={danger} />}
      </div>
    </Card>
  );
}
