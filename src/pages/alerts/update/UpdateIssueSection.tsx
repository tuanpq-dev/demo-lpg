import { useId } from 'react';
import { Button, StatusOptionGroup, TextField } from '@/components';
import type { AlertUpdateConfig } from '@/features/alerts/kinds';
import type { AlertUpdateInput } from '@/features/alerts/update';

type Issue = AlertUpdateInput['issue'];

export type UpdateIssueSectionProps = {
  issues: AlertUpdateConfig['issues'];
  value: Issue;
  error: string | undefined;
  /** Vấn đề đang chọn gợi ý chuyển sang "Cần hỗ trợ" (`suggestsSupport`). */
  suggestSupport: boolean;
  onChange: (issue: Issue) => void;
  onRequestSupport: () => void;
};

/** Khối "Vấn đề phát sinh": chọn một; mục cần mô tả → ô bắt buộc; "Cần thêm nhân sự" → gợi ý chuyển sang Cần hỗ trợ. */
export function UpdateIssueSection({ issues, value, error, suggestSupport, onChange, onRequestSupport }: UpdateIssueSectionProps) {
  const uid = useId();
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="text-lg font-semibold text-fg-secondary">
        Vấn đề phát sinh
      </h3>
      <StatusOptionGroup
        labelledBy={`${uid}-h`}
        label="Vấn đề phát sinh"
        options={issues.map((i) => ({ id: i.id, label: i.label }))}
        value={value.kind}
        onChange={(k) => onChange({ ...value, kind: k })}
        layout="inline"
        size="sm"
        columns={2}
      />
      {issues.find((i) => i.id === value.kind)?.needsNote && (
        <TextField label="Mô tả vấn đề" required value={value.note} onChange={(t) => onChange({ ...value, note: t })} maxLength={300} error={error} />
      )}
      {suggestSupport && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-fg">
          <span className="min-w-0 flex-1">Cần thêm nhân sự – nên chuyển trạng thái xử lý sang "Cần hỗ trợ" để chọn người hỗ trợ.</span>
          <Button size="sm" variant="subtle" onClick={onRequestSupport}>
            Chuyển sang Cần hỗ trợ
          </Button>
        </div>
      )}
    </section>
  );
}
