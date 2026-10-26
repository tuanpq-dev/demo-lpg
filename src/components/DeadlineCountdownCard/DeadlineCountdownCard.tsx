import { useEffect, useId, useRef } from 'react';
import { announce } from '@/lib/announce';
import { cn } from '@/lib/cn';
import { TimerIcon } from '../Icon';

export type DeadlineCountdownView = {
  /** "04:15:00" / "1 ngày 04:15:00" – |còn lại| hoặc thời gian đã quá. */
  clock: string;
  overdue: boolean;
  /** Câu cho trình đọc màn hình theo phút: "Còn 4 giờ 15 phút". */
  speech: string;
};

export type DeadlineCountdownCardProps = {
  /** null khi không đếm (đã hoàn thành / đã hủy / hạn sai) → hiện `closedText`. */
  countdown: DeadlineCountdownView | null;
  /** "16:00 Hôm nay". */
  dueText: string;
  /** Thay cho đồng hồ khi `countdown` null, vd "Đã hoàn thành" / "Đã hủy". */
  closedText?: string;
  className?: string;
};

/**
 * "HẠN CHÓT XỬ LÝ" – ảnh MT-00128 (số đo ước lượng): nền đỏ mờ (danger/10 → /5), viền danger-strong/50, tiêu đề chữ hoa
 * danger + đường kẻ; đồng hồ đậm màu warning (ảnh ~40px → token `3xl` 32px; quá hạn `2xl` vì chuỗi dài hơn); "Thời gian còn lại"; dải dưới nền danger-strong/15 "Hạn hoàn thành:".
 * Quá hạn → đồng hồ danger-strong + "Quá hạn hh:mm:ss".
 *
 * a11y: số lớn `aria-hidden` (đổi mỗi giây); trình đọc nghe câu sr-only theo PHÚT trong `role="timer"` (aria-live off),
 * và một thông báo duy nhất khi chuyển sang quá hạn (không đọc từng giây).
 */
export function DeadlineCountdownCard({ countdown, dueText, closedText = 'Đã đóng', className }: DeadlineCountdownCardProps) {
  const titleId = useId();
  const overdue = !!countdown?.overdue;
  const wasOverdue = useRef(overdue);
  useEffect(() => {
    if (overdue && !wasOverdue.current) announce('Yêu cầu bảo trì đã quá hạn hoàn thành.');
    wasOverdue.current = overdue;
  }, [overdue]);

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-gradient-to-b p-4 shadow-card',
        overdue ? 'border-danger-strong from-danger-strong/20 to-danger-strong/5' : 'border-danger-strong/50 from-danger/15 to-danger/5',
        className,
      )}
    >
      <h3 id={titleId} className="flex items-center gap-2 border-b border-danger/30 pb-2 text-base uppercase tracking-wide text-danger-text">
        <TimerIcon size={16} />
        Hạn chót xử lý
      </h3>
      {countdown ? (
        <div role="timer" aria-live="off" aria-atomic="true" className="flex flex-col items-center gap-1 py-2 text-center">
          <p
            aria-hidden="true"
            // Số lớn (28px đậm ≥ 18.66px đậm = "chữ lớn" WCAG) → được dùng danger-strong.
            // eslint-disable-next-line no-restricted-syntax -- chữ lớn 28px đậm
            className={cn('font-bold tabular-nums leading-tight', overdue ? 'text-2xl text-danger-strong' : 'text-3xl text-warning')}
          >
            {overdue ? `Quá hạn ${countdown.clock}` : countdown.clock}
          </p>
          <p aria-hidden="true" className={cn('text-md', overdue ? 'text-danger-text' : 'text-fg-secondary')}>
            {overdue ? 'Đã quá thời hạn hoàn thành' : 'Thời gian còn lại'}
          </p>
          <p className="sr-only">{countdown.speech}</p>
        </div>
      ) : (
        <p className="py-4 text-center text-xl font-semibold text-fg-secondary">{closedText}</p>
      )}
      <div className="flex items-center justify-between gap-3 rounded-sm bg-danger-strong/15 px-3 py-2">
        <span className="text-xs text-fg-secondary">Hạn hoàn thành:</span>
        <span className="text-sm font-bold text-fg">{dueText}</span>
      </div>
    </section>
  );
}
