import { useId } from 'react';
import { StaffList, StatusOptionGroup, Textarea, type StatusOption } from '@/components';
import type { AlertUpdateConfig } from '@/features/alerts/kinds';
import { isResolvedState, stateLabel, type UpdateClose, type UpdateErrors, type UpdateState } from '@/features/alerts/update';
import { supportStaffItems } from '../SupportRequestModal';

const STATE_TONE: Record<UpdateState, StatusOption['tone']> = {
  inspecting: 'primary',
  resolving: 'primary',
  paused: 'warning',
  'needs-support': 'warning',
  resolved: 'primary',
  'false-alarm': 'primary',
};

export type UpdateStateSectionProps = {
  cfg: AlertUpdateConfig;
  close: UpdateClose;
  state: UpdateState;
  holdReason: string;
  supportPeople: readonly string[];
  /** Người phối hợp của cảnh báo – danh sách chọn "Cần hỗ trợ". */
  collaborators: readonly string[] | undefined;
  err: Pick<UpdateErrors, 'holdReason' | 'supportPeople'>;
  onStateChange: (s: UpdateState) => void;
  onHoldReasonChange: (t: string) => void;
  onSupportPeopleChange: (ids: string[]) => void;
};

/**
 * Khối "Trạng thái xử lý": ô trạng thái theo loại (Đã xử lý khoá khi chưa đạt điều kiện đóng – lý do qua `aria-describedby`);
 * Tạm dừng / Cần hỗ trợ → lý do bắt buộc (+ chọn người hỗ trợ).
 */
export function UpdateStateSection({
  cfg,
  close,
  state,
  holdReason,
  supportPeople,
  collaborators,
  err,
  onStateChange,
  onHoldReasonChange,
  onSupportPeopleChange,
}: UpdateStateSectionProps) {
  const uid = useId();
  const reasonId = `${uid}-state-reason`;
  const options: StatusOption<UpdateState>[] = cfg.states.map((s) => ({
    id: s,
    label: stateLabel(cfg, s),
    tone: STATE_TONE[s],
    ...(isResolvedState(s) && !close.ok ? { disabled: true, describedBy: reasonId } : {}),
  }));
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="text-lg font-semibold text-fg-secondary">
        Trạng thái xử lý
      </h3>
      <StatusOptionGroup
        labelledBy={`${uid}-h`}
        label="Trạng thái xử lý"
        options={options}
        value={state}
        onChange={onStateChange}
        layout="inline"
        size="sm"
        columns={cfg.states.length > 5 ? 3 : 5}
      />
      {!close.ok && (
        <p id={reasonId} className="text-sm text-warning">
          Chưa chọn được "
          {cfg.states
            .filter(isResolvedState)
            .map((s) => stateLabel(cfg, s))
            .join('" / "')}
          ": {close.message}
        </p>
      )}
      {(state === 'paused' || state === 'needs-support') && (
        <div className="grid gap-4 lg:grid-cols-2">
          {state === 'needs-support' && (
            <div className="flex flex-col gap-1.5">
              <StaffList
                compact
                label="Người / bộ phận hỗ trợ"
                items={supportStaffItems(collaborators)}
                value={supportPeople[0] ?? null}
                onChange={(id) => onSupportPeopleChange(id ? [id] : [])}
              />
              {err.supportPeople && <p className="text-sm text-danger-text">{err.supportPeople}</p>}
              <p id={`${uid}-support-hint`} className="text-sm text-fg-secondary">
                Người được chọn thêm vào danh sách phối hợp. Thông báo đẩy/SMS chưa gửi được – chờ backend.
              </p>
            </div>
          )}
          <Textarea
            label={state === 'paused' ? 'Lý do tạm dừng' : 'Lý do cần hỗ trợ'}
            required
            value={holdReason}
            onChange={onHoldReasonChange}
            rows={3}
            maxLength={500}
            error={err.holdReason}
            placeholder={state === 'paused' ? 'Vd: chờ vật tư thay thế, chờ dừng tuyến' : 'Vd: cần thêm người thao tác xả áp thủ công'}
          />
        </div>
      )}
    </section>
  );
}
