import { cn } from '@/lib/cn';

export type WorkflowStep = {
  id: string;
  label: string;
  /** Nhãn phụ nhỏ dưới nhãn bước, vd "Tạm dừng" / "Gặp sự cố" ở bước "Đang thực hiện" (bước không đổi). */
  note?: string;
  noteTone?: 'warning' | 'danger';
  /** Giờ của bước, hiện sau nhãn "Phát hiện (10:45:22)" – chỉ orientation="vertical". */
  time?: string;
  /** Dòng phụ dưới nhãn "Đang thực hiện - Nguyễn Văn A" – chỉ orientation="vertical". */
  detail?: string;
};

export type WorkflowStepperProps = {
  steps: readonly WorkflowStep[];
  /** Số bước đã xong (✓ + primary), tính từ đầu. */
  completed: number;
  /** Bước đang chờ (aria-current="step"); null khi đã xong hết hoặc đã dừng (hủy). */
  current: number | null;
  /** Tên cho trình đọc màn hình, vd "Tiến trình xử lý MT-00128". */
  label: string;
  /**
   * horizontal (mặc định) = ảnh MT-00128 · vertical = "Tiến trình" ở drawer chi tiết cảnh báo: mỗi bước một hàng, vòng 18px
   * nối bằng vạch dọc; xong = vòng line + chấm đặc, đang chờ = vòng primary + nhãn primary đậm, chưa tới = vòng rỗng + chữ mờ.
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Chỉ vertical. ring (mặc định) = vòng 18px như trên · dot = "Luồng phê duyệt" (modal ký báo cáo): chấm nhỏ trên vạch dọc,
   * bước hiện tại = chấm primary đặc có quầng, nhãn 14px (bước chưa tới vẫn chữ sáng) + dòng `detail` chữ phụ.
   */
  marker?: 'ring' | 'dot';
  className?: string;
};

const NOTE_CLASS = {
  danger: 'border-danger/70 bg-danger/15 text-danger-text',
  warning: 'border-warning/50 bg-warning/10 text-warning',
} as const;

function DotStepper({ steps, completed, current, label, className }: Omit<WorkflowStepperProps, 'orientation' | 'marker'>) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="relative flex flex-col gap-3.5">
        <span aria-hidden="true" className="absolute bottom-1 left-[4px] top-2 w-px bg-line/40" />
        {steps.map((s, i) => {
          const done = i < completed;
          const isCurrent = i === current;
          return (
            <li key={s.id} aria-current={isCurrent ? 'step' : undefined} className="relative flex items-start gap-3">
              <span aria-hidden="true" className="relative z-[1] mt-[5px] grid size-[9px] shrink-0 place-items-center">
                {isCurrent ? (
                  <span className="size-[9px] rounded-full bg-primary ring-[3px] ring-surface-raised" />
                ) : (
                  <span className={cn('size-[7px] rounded-full', done ? 'bg-primary/60' : 'bg-neutral/70')} />
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn('text-sm', isCurrent ? 'font-semibold text-primary' : 'text-fg')}>
                  {s.label}
                  <span className="sr-only">{done ? ' – đã xong' : isCurrent ? ' – bước hiện tại' : ' – chưa tới'}</span>
                </span>
                {s.detail && <span className="text-xs text-fg-secondary">{s.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function VerticalStepper({ steps, completed, current, label, className }: Omit<WorkflowStepperProps, 'orientation'>) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const done = i < completed;
          const isCurrent = i === current;
          return (
            <li key={s.id} aria-current={isCurrent ? 'step' : undefined} className="relative flex items-start gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[8px] top-[21px] w-0.5 bg-line/40" />}
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-[1] mt-[3px] grid size-4.5 shrink-0 place-items-center rounded-full border-2',
                  isCurrent
                    ? 'border-primary bg-surface shadow-[0_0_8px_rgb(var(--color-primary)/0.6)]'
                    : done
                      ? 'border-line bg-surface'
                      : 'border-line/60 bg-surface',
                )}
              >
                {done && <span className="size-2 rounded-full bg-line" />}
              </span>
              <span
                className={cn(
                  'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-md',
                  isCurrent ? 'font-semibold text-primary' : done ? 'text-fg-secondary' : 'text-fg-secondary/70',
                )}
              >
                <span>
                  {s.label}
                  {s.time && <span className="tabular-nums"> ({s.time})</span>}
                  <span className="sr-only">{done ? ' – đã xong' : isCurrent ? ' – bước hiện tại' : ' – chưa tới'}</span>
                </span>
                {s.note && (
                  <span className={cn('rounded-sm border px-1.5 text-xs font-normal leading-4.5', NOTE_CLASS[s.noteTone ?? 'warning'])}>
                    <span className="sr-only">, </span>
                    {s.note}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Thanh bước quy trình nằm ngang – ảnh chi tiết yêu cầu bảo trì MT-00128 (chưa xác nhận layer Figma; số đo ước lượng):
 * mỗi bước một cột đều nhau, icon 16px, vạch ngang dưới icon chạy hết bề rộng, phần đã đi tô primary tới TÂM bước
 * đang chờ (ảnh: tới giữa "Tiếp nhận"); nhãn 14px dưới vạch. Bước xong = vòng primary đặc + ✓, nhãn primary;
 * bước chưa tới = vòng line có chấm giữa, nhãn chữ phụ. Ảnh không phân biệt bước đang chờ ngoài vạch → giữ như ảnh.
 */
export function WorkflowStepper({ steps, completed, current, label, orientation = 'horizontal', marker = 'ring', className }: WorkflowStepperProps) {
  if (orientation === 'vertical' && marker === 'dot')
    return <DotStepper steps={steps} completed={completed} current={current} label={label} className={className} />;
  if (orientation === 'vertical')
    return <VerticalStepper steps={steps} completed={completed} current={current} label={label} className={className} />;
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
              <span className={cn('flex flex-col items-center gap-1 text-base', done ? 'text-primary' : 'text-fg-secondary')}>
                <span>
                  {s.label}
                  <span className="sr-only">{done ? ' – đã xong' : isCurrent ? ' – bước đang chờ' : ' – chưa tới'}</span>
                </span>
                {s.note && (
                  <span className={cn('rounded-sm border px-1.5 text-xs leading-4.5', NOTE_CLASS[s.noteTone ?? 'warning'])}>
                    <span className="sr-only">, </span>
                    {s.note}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
