import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { AlertTriangleIcon, Icon } from '../Icon';
import { StatusDot } from '../StatusDot';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
/**
 * - unacknowledged: "Chưa xác nhận" (bảng cảnh báo, tông đỏ)
 * - pending:        "Chờ tiếp nhận" (bảng bảo trì, tông vàng)
 * - assigned:       "Đã phân công" (bảo trì – chưa có trong Figma bảng, màu accent)
 * - in-progress:    "Đang xử lý"
 * - review:         "Chờ nghiệm thu" (bảo trì – chưa có trong Figma bảng, màu warning-soft)
 * - done:           "Đã hoàn thành"
 * - cancelled:      "Đã hủy" (bảo trì – chỉ FE, trung tính)
 * - resolved:       "Đã xử lý" (cảnh báo chờ đóng – xanh như ảnh modal đóng cảnh báo)
 * - closed:         "Hoàn thành" (cảnh báo đã đóng – trung tính, phân biệt với "Đã xử lý")
 * - monitoring:     "Đang theo dõi" (nhật ký vận hành, Figma 64:989 – pill vàng nền /10 viền /20)
 */
export type WorkStatus =
  | 'unacknowledged'
  | 'pending'
  | 'assigned'
  | 'in-progress'
  | 'review'
  | 'done'
  | 'cancelled'
  | 'resolved'
  | 'closed'
  | 'monitoring';

type CommonProps = {
  /** Ghi đè nhãn mặc định (tiếng Việt). */
  children?: ReactNode;
  className?: string;
};

export type BadgeProps = CommonProps &
  (
    | {
        /** Nhãn chữ nhật bo 4px, chữ bold 10px – cột "Mức độ" (70:5296–70:5299). */
        variant: 'severity';
        value: Severity;
        /** Bỏ độ rộng tối thiểu 87px dùng trong bảng (chỉ size sm). */
        compact?: boolean;
        /** Chỉ viền, không nền (size sm) – "Nghiêm trọng" trong "Cảnh báo liên quan" (ảnh MT-00128). */
        outline?: boolean;
        /**
         * - sm: chữ bold 10px, cao 20px, không viền – bảng (mặc định)
         * - md: chữ bold 16px, bo 2px, có viền tone/20 – AlertCard (70:2913)
         * - chip: chữ 14px THƯỜNG, cao 28px, bo 6px, viền tone – header chi tiết yêu cầu bảo trì (ảnh MT-00128), cùng cỡ
         *   với status/tag `md` đứng cạnh
         */
        size?: 'sm' | 'md' | 'chip';
        /** Icon tam giác cảnh báo trước nhãn (header chi tiết yêu cầu bảo trì – ảnh MT-00128). Size md/chip. */
        withIcon?: boolean;
      }
    | {
        /** Pill bo 12px có viền – cột "Trạng thái" (70:3077, 70:3104, 70:3184, 70:5563, 70:5433). */
        variant: 'status';
        value: WorkStatus;
        /** Thêm icon đầu: pending → chấm vàng, done → dấu tick (kiểu trang Bảo trì). */
        withIcon?: boolean;
        /** sm = pill 10px (bảng, mặc định) · md = nhãn 14px cao 28px bo 6px (header chi tiết bảo trì – ảnh MT-00128). */
        size?: 'sm' | 'md';
      }
    | {
        /**
         * Nhãn phân loại (không phải trạng thái/mức độ) – ảnh MT-00128: "Bảo trì khẩn cấp" (md), chip "Đang làm",
         * "Không áp dụng" trong checklist (sm).
         */
        variant: 'tag';
        tone?: TagTone;
        /** sm = 10px cao 18px · md = 14px cao 28px. */
        size?: 'sm' | 'md';
      }
    | {
        /**
         * Bộ đếm số lượng.
         * - sm: chip cao 18px bo 12px cạnh label Tabs (70:5556, 70:5552, 70:5548)
         * - md: vòng tròn 24px trên NavTabs (70:349)
         */
        variant: 'count';
        value: number;
        tone?: CountTone;
        size?: 'sm' | 'md';
        /** Giá trị tối đa hiển thị; vượt quá sẽ thành "99+". */
        max?: number;
        /** Viền mảnh theo tone – huy hiệu nổi trên icon (chuông thông báo), khi nền nhạt khó thấy. */
        outlined?: boolean;
      }
  );

/** warning = "Chờ xác nhận" (thẻ báo cáo – ảnh màn Báo cáo). */
export type CountTone = 'neutral' | 'info' | 'warning' | 'danger';
/**
 * neutral = nền chip + chữ phụ · primary = viền + chữ primary (đang làm) · muted = mờ (không áp dụng) ·
 * success = "Đủ điều kiện gửi nghiệm thu" · warning = "Tạm dừng", "Chưa tải lên máy chủ" · danger = "Gặp sự cố" (chữ `danger-text`, nền đỏ nhạt – nổi bật).
 */
export type TagTone = 'neutral' | 'primary' | 'muted' | 'success' | 'warning' | 'danger';

const tagClass: Record<TagTone, string> = {
  neutral: 'border-line bg-surface-chip/60 text-fg-secondary',
  primary: 'border-primary/60 bg-primary/10 text-primary',
  muted: 'border-line/30 bg-surface-muted/60 text-fg-secondary',
  success: 'border-success/50 bg-success/10 text-success',
  warning: 'border-warning/50 bg-warning/10 text-warning',
  danger: 'border-danger/70 bg-danger/15 text-danger-text',
};

const tagSize: Record<'sm' | 'md', string> = {
  sm: 'h-[18px] rounded-sm px-1.5 text-2xs',
  md: 'h-7 rounded-md px-2.5 text-base',
};

const countClass: Record<'sm' | 'md', Record<CountTone, string>> = {
  sm: {
    neutral: 'bg-surface-chip text-fg-secondary',
    info: 'bg-info/20 text-info',
    warning: 'bg-warning/15 text-warning',
    // Nền nhạt danger/10 → chữ danger-text 5.1:1 (nền /20 cũ chỉ 4.4:1).
    danger: 'bg-danger/10 text-danger-text',
  },
  md: {
    neutral: 'bg-surface-chip text-fg-secondary',
    info: 'bg-info/15 text-info',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger-strong/15 text-danger-text',
  },
};

const countBorder: Record<CountTone, string> = {
  neutral: 'border-line',
  info: 'border-info/60',
  warning: 'border-warning/60',
  danger: 'border-danger/60',
};

const severityClass: Record<Severity, string> = {
  critical: 'bg-danger/10 text-danger-text',
  high: 'bg-warning/10 text-warning',
  medium: 'bg-surface-muted text-fg opacity-70',
  low: 'bg-surface-muted/50 text-fg-secondary opacity-70',
};

const severityBorder: Record<Severity, string> = {
  critical: 'border-danger/20',
  high: 'border-warning/20',
  medium: 'border-line',
  low: 'border-line/50',
};

const severityOutline: Record<Severity, string> = {
  critical: 'border-danger text-danger-text',
  high: 'border-warning text-warning',
  medium: 'border-line text-fg',
  low: 'border-line/60 text-fg-secondary',
};

const severityLabel: Record<Severity, string> = {
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

const statusClass: Record<WorkStatus, string> = {
  unacknowledged: 'border-danger/20 bg-danger/10 text-danger-text',
  pending: 'border-warning/20 bg-surface-muted text-warning',
  assigned: 'border-accent/20 bg-accent/10 text-accent',
  'in-progress': 'border-info/20 bg-info/10 text-info',
  review: 'border-warning-soft/20 bg-warning-soft/10 text-warning-soft',
  done: 'border-success/20 bg-success/10 text-success',
  cancelled: 'border-line/30 bg-surface-muted text-fg-secondary',
  resolved: 'border-success/40 bg-success/10 text-success',
  closed: 'border-line/30 bg-surface-muted text-fg',
  monitoring: 'border-warning/20 bg-warning/10 text-warning',
};

/** Nhãn tiếng Việt của trạng thái công việc (badge status) – dùng lại khi cần chữ không kèm badge. */
export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  unacknowledged: 'Chưa xác nhận',
  pending: 'Chờ tiếp nhận',
  assigned: 'Đã phân công',
  'in-progress': 'Đang xử lý',
  review: 'Chờ nghiệm thu',
  done: 'Đã hoàn thành',
  cancelled: 'Đã hủy',
  resolved: 'Đã xử lý',
  closed: 'Hoàn thành',
  monitoring: 'Đang theo dõi',
};

type SeverityProps = Extract<BadgeProps, { variant: 'severity' }>;
type CountProps = Extract<BadgeProps, { variant: 'count' }>;
type StatusProps = Exclude<BadgeProps, { variant: 'severity' | 'tag' | 'count' }>;

/** Lớp cỡ/màu của badge mức độ: chip (bộ lọc) · md (tiêu đề drawer) · sm (bảng, viền tuỳ chọn). */
function severityClasses({ size, value, compact, outline }: SeverityProps) {
  if (size === 'chip') return cn('h-7 gap-1.5 rounded-md border px-2.5 text-base font-normal', severityOutline[value], severityClass[value]);
  if (size === 'md') return cn('rounded-xs border px-[9px] py-[3px] text-md font-bold leading-[15px]', severityBorder[value], severityClass[value]);
  return cn(
    'h-5 rounded-sm px-2.5 text-2xs font-bold leading-5',
    !compact && 'min-w-[87px]',
    outline ? cn('border bg-transparent', severityOutline[value]) : severityClass[value],
  );
}

function SeverityBadge(props: SeverityProps) {
  const big = props.size === 'md' || props.size === 'chip';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center whitespace-nowrap', severityClasses(props), props.className)}>
      {big && props.withIcon && <AlertTriangleIcon size={16} className={cn('shrink-0', props.size === 'md' && 'mr-2')} />}
      {props.children ?? severityLabel[props.value]}
    </span>
  );
}

function CountBadge({ value, tone = 'neutral', size = 'sm', max = 99, outlined, children, className }: CountProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap text-2xs tabular-nums',
        size === 'sm' ? 'h-[18px] min-w-[18px] rounded-xl px-1.5' : 'size-6 rounded-full',
        countClass[size][tone],
        outlined && cn('border', countBorder[tone]),
        className,
      )}
    >
      {children ?? (value > max ? `${max}+` : value)}
    </span>
  );
}

function statusIcon({ withIcon, value }: StatusProps): ReactNode {
  if (withIcon && value === 'pending') return <StatusDot status="warning" />;
  if (withIcon && value === 'done') return <Icon name="check" box={12} className="w-2" />;
  return null;
}

function StatusBadge(props: StatusProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap border',
        props.size === 'md' ? 'h-7 gap-1.5 rounded-md px-2.5 text-base' : 'gap-1 rounded-xl px-3 py-[3px] text-2xs leading-4',
        statusClass[props.value],
        props.className,
      )}
    >
      {statusIcon(props)}
      {props.children ?? WORK_STATUS_LABEL[props.value]}
    </span>
  );
}

export function Badge(props: BadgeProps) {
  if (props.variant === 'severity') return <SeverityBadge {...props} />;
  if (props.variant === 'count') return <CountBadge {...props} />;
  if (props.variant === 'tag') {
    const { tone = 'neutral', size = 'sm', children, className } = props;
    return (
      <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap border', tagSize[size], tagClass[tone], className)}>{children}</span>
    );
  }
  return <StatusBadge {...props} />;
}
