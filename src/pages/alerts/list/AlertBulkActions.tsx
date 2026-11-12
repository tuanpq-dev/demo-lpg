import { Suspense, lazy, useState } from 'react';
import { followUpConfig, useCloseConditions } from '@/data/alertDetail';
import { useAlerts, type AlertRecord } from '@/data/alerts';
import { bulkCloseMessage, planBulkClose } from '@/features/alerts/close';
import { bulkMessage } from '@/features/alerts/workflow';
import { runAction } from '@/lib/actionError';
import { cn } from '@/lib/cn';
import { useTimedNotice } from '@/lib/useTimedNotice';
import { AlertBulkCloseModal } from '../AlertBulkCloseModal';
import { BulkActionsBar } from './AlertsSections';

const AlertAssignModal = lazy(() => import('../AlertAssignModal').then((m) => ({ default: m.AlertAssignModal })));

export type AlertBulkActionsProps = {
  /** Bản ghi đang chọn (có thể ở nhiều trang – `useRecordSelection`). */
  records: readonly AlertRecord[];
  onClear: () => void;
  actor: string;
  /** Quyền `alert:acknowledge` – không có → chỉ còn dòng thông báo (ẩn thanh thao tác). */
  canAct: boolean;
};

/**
 * Thao tác hàng loạt của bảng cảnh báo – CHUNG quy tắc với drawer (features/alerts/workflow + assign + close): xác nhận chỉ
 * dòng Chưa xác nhận; phân công qua modal (không tự xác nhận, bỏ qua dòng Hoàn thành / đã đúng người); đóng chỉ dòng Đã xử
 * lý đủ 3 điều kiện hệ thống + một ghi chú kết luận chung. Kết quả → dòng thông báo (lỗi chữ đỏ), tự ẩn sau 4 giây.
 */
export function AlertBulkActions({ records, onClear, actor, canAct }: AlertBulkActionsProps) {
  const alerts = useAlerts();
  const { notice, show: setNotice, fail: failNotice } = useTimedNotice();
  const ids = records.map((a) => a.id);
  const closeConds = useCloseConditions(records.filter((a) => a.status === 'resolved'));
  const closePlan = planBulkClose(records, ids, (a) => closeConds[a.id] ?? [], actor);
  const [bulkCloseOpen, setBulkCloseOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const runAck = () =>
    runAction(async () => {
      const r = await alerts.acknowledge(ids, actor);
      setNotice(bulkMessage('Đã xác nhận', r.done, r.skipped));
      onClear();
    }, failNotice);

  return (
    <>
      {canAct && records.length > 0 && (
        <BulkActionsBar
          selected={records.length}
          acknowledgeable={records.filter((a) => a.status === 'unacknowledged').length}
          assignable={records.filter((a) => a.status !== 'done').length}
          closable={closePlan.eligible.length}
          onAcknowledge={() => void runAck()}
          onAssign={() => setBulkAssignOpen(true)}
          onClose={() => setBulkCloseOpen(true)}
          onClear={onClear}
        />
      )}
      <p role="status" className={notice.text ? cn('px-4 pt-2 text-sm', notice.error ? 'text-danger-text' : 'text-success') : 'sr-only'}>
        {notice.text}
      </p>

      <Suspense fallback={null}>
        {bulkAssignOpen && (
          <AlertAssignModal
            alerts={records}
            onClose={() => setBulkAssignOpen(false)}
            onConfirm={async (form) => {
              const r = await alerts.assign(ids, form, actor);
              setBulkAssignOpen(false);
              onClear();
              setNotice(`${r.message} – người phụ trách: ${form.assignee}.`);
            }}
          />
        )}
      </Suspense>

      {bulkCloseOpen && (
        <AlertBulkCloseModal
          eligible={closePlan.eligible.length}
          skippedText={closePlan.skipped.length ? (bulkCloseMessage(closePlan.eligible.length, closePlan.skipped).split(' · ')[1] ?? null) : null}
          onClose={() => setBulkCloseOpen(false)}
          onConfirm={async (note) => {
            const r = await alerts.closeMany(ids, note, closeConds, followUpConfig, actor);
            setBulkCloseOpen(false);
            onClear();
            setNotice(r.message);
          }}
        />
      )}
    </>
  );
}
