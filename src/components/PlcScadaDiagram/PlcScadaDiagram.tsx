import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CpuIcon, MonitorIcon } from '../Icon';

export type DiagramLinkState = 'ok' | 'lost' | 'pending' | 'danger';

export type PlcDiagramSource = {
  id: string;
  label: string;
  /** Icon 16px (trang trí). */
  icon: ReactNode;
  state: DiagramLinkState;
};

export type PlcScadaDiagramProps = {
  sources: readonly PlcDiagramSource[];
  /** Khối giữa: "PLC Siemens" / "S7-1200". */
  controller: { title: string; model: string; subtitle: string; state: DiagramLinkState };
  /** Chip dưới khối PLC: "Heartbeat: OK". */
  heartbeat: { text: string; state: DiagramLinkState };
  /** Khối phải: "SCADA / HMI". */
  scada: { title: string; subtitle: string; state: DiagramLinkState };
  /** Chip dưới khối SCADA: "Kết nối: Active". */
  link: { text: string; state: DiagramLinkState };
  /** Dưới mũi tên truyền: "Tag đồng bộ: 21/21". */
  syncText: string;
  /** Tên vùng cho trình đọc màn hình (tóm tắt trạng thái). */
  label: string;
  className?: string;
};

// Bố cục cố định theo ảnh 168:5396 (khung trong 1060 × 323): nút nguồn 256 × 34, cách 52; PLC 256 × 130; SCADA 257 × 108.
const W = 1060;
const H = 323;
const SRC = { x: 16, w: 256, h: 34, top: 16, step: 52 };
const PLC = { x: 335, y: 97, w: 256, h: 130 };
const SCADA = { x: 788, y: 108, w: 257, h: 108 };
const ARROW_Y = 161;

const iconTone: Record<DiagramLinkState, string> = {
  ok: 'text-success',
  lost: 'text-fg-secondary',
  pending: 'text-fg-secondary',
  danger: 'text-danger-text',
};
const chipTone: Record<DiagramLinkState, string> = {
  ok: 'border-success/30 bg-success/15 text-success',
  lost: 'border-line/40 bg-surface-muted/40 text-fg-secondary',
  pending: 'border-line/40 bg-surface-muted/40 text-fg-secondary',
  danger: 'border-danger/50 bg-danger/10 text-danger-text',
};
const STATE_SR: Record<DiagramLinkState, string> = { ok: 'có tín hiệu', lost: 'mất tín hiệu', pending: 'đang chờ dữ liệu', danger: 'lỗi' };

/**
 * "Sơ đồ kết nối PLC/SCADA" (Figma bản sao A88YJ2BRhICDDdeu2rtRg1 – 168:5396; dựng theo ảnh chụp node 168:4689 vì
 * `get_design_context` của node lỗi kết nối): nhóm thiết bị → (thu thập, nét đứt) → PLC → (truyền dữ liệu) → SCADA/HMI.
 * Kích thước cố định 1060 × 323 – đặt trong vùng cuộn ngang. Nút / đường mất tín hiệu chuyển xám.
 */
export function PlcScadaDiagram({ sources, controller, heartbeat, scada, link, syncText, label, className }: PlcScadaDiagramProps) {
  const arrowId = `${useId()}-arrow`;
  const plcLeftY = (i: number) => PLC.y + 18 + (i * (PLC.h - 36)) / Math.max(1, sources.length - 1);
  const scadaOk = scada.state === 'ok';
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('relative rounded-md border border-line-card bg-bg-app', className)}
      style={{ width: W, height: H }}
    >
      {/* Đường nối (trang trí – trạng thái đọc qua chữ ẩn của từng nút). */}
      <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0">
        <defs>
          <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0 0L8 4L0 8Z" className={scadaOk ? 'fill-primary' : 'fill-fg-secondary'} />
          </marker>
        </defs>
        {sources.map((s, i) => (
          <line
            key={s.id}
            x1={SRC.x + SRC.w}
            y1={SRC.top + i * SRC.step + SRC.h / 2}
            x2={PLC.x}
            y2={plcLeftY(i)}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className={s.state === 'ok' ? 'stroke-primary/60' : 'stroke-fg-secondary/40'}
          />
        ))}
        <line
          x1={PLC.x + PLC.w}
          y1={ARROW_Y}
          x2={SCADA.x - 2}
          y2={ARROW_Y}
          strokeWidth={1.5}
          markerEnd={`url(#${arrowId})`}
          className={scadaOk ? 'stroke-primary' : 'stroke-fg-secondary/60'}
        />
      </svg>

      <ul aria-label="Nhóm thiết bị gửi dữ liệu" className="absolute" style={{ left: SRC.x, top: SRC.top }}>
        {sources.map((s, i) => (
          <li
            key={s.id}
            className="absolute flex items-center gap-2 rounded-md border border-line-card bg-surface-raised px-3 text-base text-fg"
            style={{ top: i * SRC.step, width: SRC.w, height: SRC.h }}
          >
            <span aria-hidden="true" className={cn('shrink-0', iconTone[s.state])}>
              {s.icon}
            </span>
            <span className={cn('truncate', s.state !== 'ok' && 'text-fg-secondary')}>{s.label}</span>
            <span className="sr-only"> – {STATE_SR[s.state]}</span>
          </li>
        ))}
      </ul>

      <span className="absolute rounded-xs border border-primary/50 bg-surface px-1.5 py-0.5 text-2xs text-primary" style={{ left: 306, top: 61 }}>
        Thu thập dữ liệu
      </span>

      <div
        className={cn(
          'absolute flex flex-col items-center justify-center gap-1 rounded-md border-2 bg-surface-muted/60 px-3 text-center',
          controller.state === 'ok' ? 'border-primary' : controller.state === 'danger' ? 'border-danger' : 'border-line',
        )}
        style={{ left: PLC.x, top: PLC.y, width: PLC.w, height: PLC.h }}
      >
        <CpuIcon size={26} aria-hidden="true" className={controller.state === 'ok' ? 'text-primary' : 'text-fg-secondary'} />
        <p className="text-md font-bold leading-tight text-fg">
          {controller.title}
          <br />
          {controller.model}
        </p>
        <p className="text-xs text-fg-secondary">{controller.subtitle}</p>
      </div>
      <span className={cn('absolute rounded-xs border px-1.5 py-0.5 text-2xs', chipTone[heartbeat.state])} style={{ left: 403, top: 248 }}>
        {heartbeat.text}
      </span>

      <span
        className="absolute w-[132px] rounded-xs border border-primary/50 bg-surface py-0.5 text-center text-2xs text-primary"
        style={{ left: 616, top: 139 }}
      >
        Truyền dữ liệu
      </span>
      <span className="absolute text-2xs text-fg-secondary" style={{ left: 615, top: 177 }}>
        {syncText}
      </span>

      <div
        className={cn(
          'absolute flex flex-col items-center justify-center gap-1 rounded-md border bg-surface-raised text-center',
          scadaOk ? 'border-line-card' : 'border-line/40',
        )}
        style={{ left: SCADA.x, top: SCADA.y, width: SCADA.w, height: SCADA.h }}
      >
        <MonitorIcon size={30} aria-hidden="true" className={scadaOk ? 'text-fg' : 'text-fg-secondary'} />
        <p className="text-md font-bold text-fg">{scada.title}</p>
        <p className="text-xs text-fg-secondary">{scada.subtitle}</p>
      </div>
      <span
        className={cn(
          'absolute rounded-xs border px-1.5 py-0.5 text-2xs',
          link.state === 'ok' ? 'border-primary/30 bg-primary/15 text-primary' : chipTone[link.state],
        )}
        style={{ left: 861, top: 226 }}
      >
        {link.text}
      </span>
    </div>
  );
}
