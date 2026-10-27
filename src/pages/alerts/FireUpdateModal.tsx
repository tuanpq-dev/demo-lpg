import { useId, useState } from 'react';
import { Button, Checkbox, Modal, StatusOptionGroup, Textarea, type StatusOption } from '@/components';
import { useFireReadings } from '@/data/alertDetail';
import type { AlertRecord } from '@/data/alerts';
import { ALARM_LABEL, DEVICE_LABEL, canCloseFire } from '@/features/alerts/fire';
import type { FireUpdateAction, FireUpdateInput, FireUpdateResult, fireUpdate } from '@/features/alerts/workflow';

export type FireCheck = Parameters<typeof fireUpdate>[2];

const SUBMIT_LABEL: Record<FireUpdateAction, string> = { continue: 'Lưu cập nhật', handled: 'Xác nhận đã xử lý sự cố', 'false-alarm': 'Xác nhận báo động giả' };

/**
 * "Cập nhật xử lý" – cảnh báo CHÁY Đang xử lý (chưa có thiết kế; dựng theo token như modal gas, mở TRÊN drawer):
 * Tiếp tục xử lý / Đã xử lý sự cố / Báo động giả · ghi chú BẮT BUỘC cả 3.
 * Đóng (2 ô sau) chỉ khi đầu báo ĐÃ PHỤC HỒI (live): còn báo động / chưa đọc được → ô khoá (aria-disabled + lý do).
 * Mất tín hiệu → chọn được nhưng bắt buộc tick "Đã kiểm tra tại chỗ". Chỉ mount khi mở.
 */
export function FireUpdateModal({
  alert: a,
  onClose,
  onSubmit,
}: {
  alert: AlertRecord;
  onClose: () => void;
  onSubmit: (input: FireUpdateInput, check: FireCheck) => Promise<FireUpdateResult> | FireUpdateResult;
}) {
  const r = useFireReadings(a);
  const detector = a.device;
  const [action, setAction] = useState<FireUpdateAction>('continue');
  const [note, setNote] = useState('');
  const [fieldChecked, setFieldChecked] = useState(false);
  const [noteError, setNoteError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  const blockId = useId();

  const closeLocked = r.device === 'pending' || r.alarm === 'active';
  const lockReason = r.device === 'pending' ? 'Đang đọc trạng thái đầu báo…' : r.alarm === 'active' ? `Đầu báo ${detector} vẫn đang báo động – chỉ đóng khi đầu báo đã phục hồi.` : undefined;
  const effective: FireUpdateAction = closeLocked && action !== 'continue' ? 'continue' : action;
  const closing = effective !== 'continue';
  // Không đọc được báo động (mất tín hiệu) → đóng cần xác nhận kiểm tra tại chỗ.
  const lost = r.device !== 'pending' && r.alarm === 'unknown';
  const check = closing ? canCloseFire({ alarm: r.alarm, device: r.device, fieldChecked, detector }) : null;
  const blocked = check && !check.ok ? check.message : undefined;

  const closeOpt = (id: 'handled' | 'false-alarm', label: string): StatusOption<FireUpdateAction> => ({
    id,
    label,
    tone: 'primary',
    tooltip: 'Chỉ khi đầu báo đã phục hồi',
    disabled: closeLocked,
    disabledHint: lockReason,
    describedBy: closeLocked ? reasonId : undefined,
  });
  const options: StatusOption<FireUpdateAction>[] = [{ id: 'continue', label: 'Tiếp tục xử lý', tone: 'primary' }, closeOpt('handled', 'Đã xử lý sự cố'), closeOpt('false-alarm', 'Báo động giả')];

  const submit = async () => {
    if (!note.trim()) {
      setNoteError('Nhập ghi chú cập nhật xử lý.');
      return;
    }
    if (blocked) return;
    setBusy(true);
    try {
      const res = await onSubmit({ action: effective, note, fieldChecked: closing ? fieldChecked : undefined }, { alarm: r.alarm, device: r.device, detector });
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
          {SUBMIT_LABEL[effective]}
        </Button>
      }
    >
      <p className="text-base text-fg-secondary">
        Đầu báo {detector}:{' '}
        <span className="font-semibold text-fg">{r.device === 'pending' ? '—' : r.device === 'lost' ? 'Mất tín hiệu' : ALARM_LABEL[r.alarm]}</span>
        {r.device !== 'pending' && r.device !== 'lost' && <> · thiết bị {DEVICE_LABEL[r.device].toLowerCase()}</>}
      </p>
      <StatusOptionGroup label="Kết quả xử lý" options={options} value={effective} onChange={setAction} layout="inline" columns={3} size="sm" />
      {lockReason && (
        <p id={reasonId} className="text-sm text-warning">
          {lockReason}
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
        placeholder={effective === 'false-alarm' ? 'Căn cứ kết luận báo động giả (camera, kiểm tra hiện trường…)' : 'Kết quả kiểm tra, biện pháp đã làm…'}
      />
      {closing && lost && (
        <Checkbox
          showLabel
          checked={fieldChecked}
          onChange={setFieldChecked}
          label={`Đã kiểm tra tại chỗ: không còn cháy, đầu báo ${detector} đã phục hồi`}
        />
      )}
      {blocked && (
        <p id={blockId} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {blocked}
        </p>
      )}
    </Modal>
  );
}
