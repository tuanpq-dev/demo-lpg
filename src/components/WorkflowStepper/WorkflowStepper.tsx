import { cn } from '@/lib/cn';

export type WorkflowStep = { id: string; label: string };

export type WorkflowStepperProps = {
  steps: readonly WorkflowStep[];
  /** Số bước đã xong (✓ + primary), tính từ đầu. */
  completed: number;
  /** Bước đang chờ (aria-current="step"); null khi đã xong hết hoặc đã dừng (hủy). */
  current: number | null;
  /** Tên cho trình đọc màn hình, vd "Tiến trình xử lý MT-00128". */
  label: string;
  className?: string;
};

/**
 * Thanh bước quy trình nằm ngang – ảnh chi tiết yêu cầu bảo trì MT-00128 (chưa xác nhận layer Figma; số đo ước lượng):
 * mỗi bước một cột đều nhau, icon 16px, vạch ngang dưới icon chạy hết bề rộng, phần đã đi tô primary tới TÂM bước
 * đang chờ (ảnh: tới giữa "Tiếp nhận"); nhãn 14px dưới vạch. Bước xong = vòng primary đặc + ✓, nhãn primary;
 * bước chưa tới = vòng line có chấm giữa, nhãn chữ phụ. Ảnh không phân biệt bước đang chờ ngoài vạch → giữ như ảnh.
 */
export function WorkflowStepper({ steps, completed, current, label, className }: WorkflowStepperProps) {
  const n = steps.length;
  // Vạch tô tới tâm bước đang chờ; không còn bước chờ → tới tâm bước cuối đã xong (xong hết = 100 %).
  const fill = completed >= n ? 1 : current !== null ? (current + 0.5) / n : Math.max(0, (completed - 0.5) / n);
  return (
    <nav aria-label={label} className={cn('rounded-lg border border-line/30 bg-surface px-4 pb-4 pt-5', className)}>
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        <span aria-hidden="true" className="absolute inset-x-0 top-[27px] h-0.5 bg-line/60" />
        <span
          aria-hidden="true"
          className="absolute left-0 top-[27px] h-0.5 bg-primary motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${fill * 100}%` }}
        />
        {steps.map((s, i) => {
          const done = i < completed;
          const isCurrent = i === current;
          return (
            <li key={s.id} aria-current={isCurrent ? 'step' : undefined} className="flex flex-col items-center gap-[18px] px-1 text-center">
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-[1] grid size-4 place-items-center rounded-full',
                  done ? 'bg-primary text-fg-inverse' : 'border-2 border-line bg-surface',
                )}
              >
                {done ? (
                  <svg viewBox="0 0 16 16" className="size-3">
                    <path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="size-1.5 rounded-full bg-line" />
                )}
              </span>
              <span className={cn('text-base', done ? 'text-primary' : 'text-fg-secondary')}>
                {s.label}
                <span className="sr-only">{done ? ' – đã xong' : isCurrent ? ' – bước đang chờ' : ' – chưa tới'}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
