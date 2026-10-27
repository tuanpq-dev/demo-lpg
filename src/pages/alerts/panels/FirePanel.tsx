import { EmergencyBanner, InfoGrid, SignalLostIcon, type InfoGridItem } from '@/components';
import { cn } from '@/lib/cn';
import { plantTimeOfDay } from '@/lib/plantTime';
import { alertKind, useFireReadings, type AlertLiveReading } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { ALARM_LABEL, DEVICE_LABEL, crossConfirmText, type SignalTone } from '@/features/alerts/fire';
import { formatMeasure } from '@/features/alerts/gauge';
import { Section } from '../drawerParts';

const TONE_TEXT: Record<SignalTone, string> = { success: 'text-success', warning: 'text-warning', danger: 'text-danger-text', neutral: 'text-fg-secondary' };
const DOT: Record<SignalTone, string> = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-neutral/70' };

function Lost({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-fg-secondary">
      <SignalLostIcon size={size} className="shrink-0" /> Mất tín hiệu
    </span>
  );
}

function liveText(r: AlertLiveReading | undefined, unit: string) {
  if (!r || r.state === 'none') return null;
  if (r.state === 'pending') return '—';
  if (r.state === 'lost') return <Lost />;
  return formatMeasure(r.value!, unit);
}

/**
 * Panel BÁO CHÁY (loại `panel: 'fire'`, ảnh FIR-00018 `scratch/figma-ref/alert-drawer-fire-*.png`):
 * - "Thông tin báo cháy": nhiệt độ ĐẦU BÁO live (mất tín hiệu → "Mất tín hiệu", không giữ số cũ) + "Lúc cảnh báo", loại tín hiệu,
 *   trạng thái đầu báo TÁCH báo động (Đang báo động / Đã phục hồi) và thiết bị (Trực tuyến / Mất kết nối / Lỗi), cập nhật cuối.
 * - "Tín hiệu liên quan": gas · khói · nút nhấn của khu (live).
 * - Banner xác nhận chéo (ngoài Figma): một tín hiệu liên quan bất thường → "Nhiều tín hiệu cùng báo…".
 * - "Thiết bị liên quan": máy trong khu, nhiệt độ MÁY là tag riêng. Cảm biến gas chỉ ở "Tín hiệu liên quan" (không lặp).
 */
export function FirePanel({ alert: a }: { alert: AlertRecord }) {
  const cfg = alertKind(a);
  const r = useFireReadings(a);
  const det = r.detector;
  const unit = det?.unit ?? a.unit;
  const alarmAt = det?.alarmAt ?? Number(a.threshold);
  const temp = r.temp;
  const tempTone = temp.state === 'ok' && temp.value! >= alarmAt ? 'text-warning' : 'text-fg';

  const info: InfoGridItem[] = [
    {
      id: 'temp',
      label: 'Nhiệt độ ghi nhận',
      hint: `Nhiệt độ tại đầu báo ${a.device} (số trực tiếp). Ngưỡng báo động ${formatMeasure(alarmAt, unit)} – cấu hình đầu báo.`,
      value: (
        <span className="flex flex-col gap-0.5">
          {temp.state === 'ok' ? (
            <span className={cn('text-xl font-bold tabular-nums', tempTone)}>{formatMeasure(temp.value!, unit)}</span>
          ) : temp.state === 'lost' ? (
            <span className="text-md font-semibold">
              <Lost size={18} />
            </span>
          ) : (
            <span className="text-xl font-bold text-fg-secondary">—</span>
          )}
          <span className="text-sm text-fg-secondary">Lúc cảnh báo: {formatMeasure(Number(a.value), a.unit)}</span>
        </span>
      ),
    },
    { id: 'type', label: 'Loại tín hiệu', value: det?.signalType ?? cfg.label },
    {
      id: 'state',
      label: 'Trạng thái đầu báo',
      value: (
        <span className="flex flex-col gap-0.5">
          <span
            className={cn(
              'text-md font-semibold',
              r.alarm === 'active' ? 'text-danger-text' : r.alarm === 'cleared' ? 'text-success' : 'text-fg-secondary',
            )}
          >
            {r.device === 'pending' ? '—' : ALARM_LABEL[r.alarm]}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
            Thiết bị:
            {r.device === 'lost' ? (
              <span className="inline-flex items-center gap-1">
                <SignalLostIcon size={12} className="shrink-0" /> {DEVICE_LABEL.lost}
              </span>
            ) : (
              <span className={r.device === 'online' ? 'text-success' : r.device === 'fault' ? 'text-danger-text' : undefined}>{DEVICE_LABEL[r.device]}</span>
            )}
          </span>
        </span>
      ),
    },
    { id: 'updated', label: 'Cập nhật cuối', value: <span className="text-base tabular-nums text-fg-secondary">{r.updatedAt ? plantTimeOfDay(new Date(r.updatedAt)) : '—'}</span> },
  ];

  return (
    <>
      <section aria-labelledby={`fire-info-${a.id}`} className="flex flex-col gap-3 rounded-md border border-line/30 bg-surface-muted/40 px-5 py-4">
        <h3 id={`fire-info-${a.id}`} className="text-base font-semibold text-fg-secondary">
          Thông tin báo cháy
        </h3>
        <InfoGrid variant="pairs" items={info} />
      </section>

      {r.signals.length > 0 && (
        <section aria-labelledby={`fire-signals-${a.id}`} className="flex flex-col gap-2.5 rounded-md border border-line/30 bg-surface-muted/40 px-5 py-4">
          <h3 id={`fire-signals-${a.id}`} className="text-base font-semibold text-fg-secondary">
            Tín hiệu liên quan
          </h3>
          <dl className="flex flex-col gap-2 text-base">
            {r.signals.map((s) => (
              <div key={s.id} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 text-fg">{s.label}</dt>
                <dd className={cn('shrink-0 text-right', s.abnormal && 'font-semibold', TONE_TEXT[s.tone])}>{s.lost ? <Lost /> : s.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {r.cross.active && <EmergencyBanner title={cfg.crossConfirmTitle ?? 'Nhiều tín hiệu cùng báo'} text={crossConfirmText(r.cross)} stage={r.cross.stage} />}

      {r.equipment.length > 0 && (
        <Section title="Thiết bị liên quan">
          <ul aria-label={`Thiết bị trong ${a.area}`} className="overflow-hidden rounded-md border border-line/30 bg-surface-muted/40">
            {r.equipment.map((e) => {
              const tempText = liveText(e.temp, '°C');
              const st = e.state;
              const dot: SignalTone = st.lost ? 'neutral' : st.role ? 'neutral' : st.tone;
              return (
                <li key={e.id} className="flex min-h-12 items-center gap-3 border-b border-line/30 px-4 py-2 last:border-b-0">
                  <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', DOT[dot])} />
                  <span className="min-w-0 text-md text-fg">{e.name}</span>
                  {tempText !== null ? (
                    <span className="shrink-0 text-md font-semibold tabular-nums text-fg">{tempText}</span>
                  ) : (
                    !st.lost && <span className={cn('shrink-0 text-md font-semibold', TONE_TEXT[st.tone])}>{st.text}</span>
                  )}
                  <span className="ml-auto shrink-0 text-sm">
                    {st.lost ? <Lost size={12} /> : tempText !== null ? <span className={st.tone === 'success' ? 'text-primary' : TONE_TEXT[st.tone]}>{st.text}</span> : <span className="text-fg-secondary">{st.role}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}
