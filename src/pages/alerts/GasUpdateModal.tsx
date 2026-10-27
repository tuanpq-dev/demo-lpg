import { useId, useState } from 'react';
import { Button, Modal, NumberField, StatusOptionGroup, Textarea, type StatusOption } from '@/components';
import { alertKind, useAlertLive } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { canCloseGas, levelStart } from '@/features/alerts/bands';
import { formatMeasure } from '@/features/alerts/gauge';
import type { GasUpdateInput, GasUpdateResult } from '@/features/alerts/workflow';

type Action = GasUpdateInput['action'];

/**
 * "Cập nhật xử lý" – cảnh báo gas Đang xử lý (chưa có thiết kế; dựng theo token, modal nhỏ TRÊN drawer):
 * Tiếp tục xử lý / Đã xử lý xong · ghi chú bắt buộc · nồng độ đo lại tại chỗ (tuỳ chọn).
 * "Đã xử lý xong" (bổ sung an toàn ngoài Figma): live phải < đầu mức `closeBelow` (cấp 1); live còn trên → ô khoá
 * (aria-disabled + aria-describedby lý do hiện trên màn hình). Mất tín hiệu → chọn được nhưng BẮT BUỘC số đo lại < ngưỡng.
 * Chỉ mount khi mở.
 */
export function GasUpdateModal({
  alert: a,
  onClose,
  onSubmit,
}: {
  alert: AlertRecord;
  onClose: () => void;
  onSubmit: (input: GasUpdateInput, check: { live: number | undefined; limit: number; unit: string }) => Promise<GasUpdateResult> | GasUpdateResult;
}) {
  const cfg = alertKind(a);
  const unit = a.unit;
  const closeBelow = cfg.update.kind === 'gas-update' ? cfg.update.closeBelow : 'level-1';
  const limit = levelStart(cfg.bands ?? [], closeBelow) ?? Number(a.threshold);
  const live = useAlertLive(a.tag);
  const liveVal = live.state === 'ok' ? live.value : undefined;
  const lost = live.state === 'lost';

  const [action, setAction] = useState<Action>('continue');
  const [note, setNote] = useState('');
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [noteError, setNoteError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  const blockId = useId();

  // Khoá CHỌN "Đã xử lý xong" chỉ khi đọc được live và live còn ≥ ngưỡng; mất tín hiệu → chọn được (bắt buộc số đo lại).
  // Chưa nhận số liệu đầu tiên (vừa mở modal) → cũng khoá, tránh một nhịp "chọn được" trước khi biết nồng độ.
  const pending = live.state === 'pending';
  const closeLocked = pending || (liveVal !== undefined && liveVal >= limit);
  const lockReason = pending
    ? 'Đang đọc nồng độ hiện tại…'
    : closeLocked
      ? `Nồng độ hiện tại ${formatMeasure(liveVal!, unit)} vẫn trên ngưỡng (${formatMeasure(limit, unit)}).`
      : undefined;
  const effective: Action = closeLocked && action === 'close' ? 'continue' : action;
  const check = effective === 'close' ? canCloseGas({ live: liveVal, measured, limit, unit }) : null;
  const blocked = check && !check.ok ? check.message : undefined;

  const options: StatusOption<Action>[] = [
    { id: 'continue', label: 'Tiếp tục xử lý', tone: 'primary' },
    {
      id: 'close',
      label: 'Đã xử lý xong',
      tone: 'primary',
      tooltip: `Chỉ khi nồng độ dưới ${formatMeasure(limit, unit)}`,
      disabled: closeLocked,
      disabledHint: lockReason,
      describedBy: closeLocked ? reasonId : undefined,
    },
  ];

  const submit = async () => {
    if (!note.trim()) {
      setNoteError('Nhập ghi chú cập nhật xử lý.');
      return;
    }
    if (blocked) return;
    setBusy(true);
    try {
      const res = await onSubmit({ action: effective, note, measured }, { live: liveVal, limit, unit });
      if (!res.ok && res.reason === 'note') setNoteError('Nhập ghi chú cập nhật xử lý.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Cập nhật xử lý"
      description={`${a.code} – ${a.message}`}
      dismissOnBackdrop={!note}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      footerStart={
        <Button variant="plain" onClick={onClose}>
          Hủy
        </Button>
      }
      footer={
        <Button type="submit" variant="info" disabled={busy} aria-disabled={blocked ? true : undefined} aria-describedby={blocked ? blockId : undefined}>
          {effective === 'close' ? 'Xác nhận đã xử lý xong' : 'Lưu cập nhật'}
        </Button>
      }
    >
      <p className="text-base text-fg-secondary">
        Nồng độ hiện tại ({a.tag}):{' '}
        <span className="font-semibold text-fg">{liveVal !== undefined ? formatMeasure(liveVal, unit) : live.state === 'pending' ? '—' : 'Mất tín hiệu'}</span>
        {' · '}ngưỡng đóng cảnh báo: dưới {formatMeasure(limit, unit)}
      </p>
      <StatusOptionGroup label="Trạng thái xử lý" options={options} value={effective} onChange={setAction} layout="inline" columns={2} />
      {lockReason && (
        <p id={reasonId} className="text-sm text-warning">
          {lockReason}
          {!pending && ' Chỉ đánh dấu "Đã xử lý xong" khi nồng độ về dưới ngưỡng.'}
        </p>
      )}
      <Textarea
        label="Ghi chú"
        required
        value={note}
        onChange={(v) => {
          setNote(v);
          setNoteError(undefined);
        }}
        rows={3}
        maxLength={1000}
        error={noteError}
        placeholder="Kết quả kiểm tra, biện pháp đã làm…"
      />
      <NumberField
        label="Nồng độ đo lại tại chỗ"
        value={measured}
        onChange={setMeasured}
        onClear={() => setMeasured(undefined)}
        min={0}
        max={100}
        step={0.5}
        precision={1}
        unit={unit}
        required={effective === 'close' && lost}
        hint={effective === 'close' && lost ? `Bắt buộc khi cảm biến mất tín hiệu – phải dưới ${formatMeasure(limit, unit)}.` : 'Tuỳ chọn – máy đo cầm tay.'}
      />
      {blocked && (
        <p id={blockId} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {blocked}
        </p>
      )}
    </Modal>
  );
}
