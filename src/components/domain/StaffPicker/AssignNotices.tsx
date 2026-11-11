import type { ReactNode } from 'react';

export type AssignNotice = {
  id: string;
  label: string;
  /** Nút gợi ý cạnh cảnh báo (vd "Đổi sang Ca 2") – nằm NGOÀI vùng aria-live. */ action?: ReactNode;
};

export type AssignNoticesProps = {
  /** Cảnh báo KHÔNG chặn. */
  warnings: readonly AssignNotice[];
  /** Lỗi CHẶN xác nhận – nút xác nhận `aria-describedby={blockId}`. */
  issues: readonly { id: string; label: string }[];
  blockId: string;
  /** "Chưa thể phân công – còn thiếu:" */
  blockTitle: string;
  /** Đuôi mỗi cảnh báo nhìn thấy (mặc định "vẫn phân công được"). */
  warningSuffix?: string;
};

/**
 * Khối cảnh báo + lý do chặn dùng chung cho modal phân công bảo trì và cảnh báo (đặt cuối cột phải, trên footer).
 * Vùng aria-live (polite) ẩn chỉ chứa CHỮ – không đặt nút trong vùng live; khối nhìn thấy có nút gợi ý.
 */
export function AssignNotices({ warnings, issues, blockId, blockTitle, warningSuffix = 'vẫn phân công được' }: AssignNoticesProps) {
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {warnings.map((w) => `Cảnh báo: ${w.label}.`).join(' ')}
      </p>
      {warnings.length > 0 && (
        <ul aria-label="Cảnh báo phân công" className="flex flex-col gap-1.5">
          {warnings.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-fg"
            >
              <span className="flex min-w-0 flex-1 items-start gap-2">
                <span aria-hidden="true" className="text-warning">
                  ⚠
                </span>
                <span>
                  {w.label} – {warningSuffix}.
                </span>
              </span>
              {w.action}
            </li>
          ))}
        </ul>
      )}
      {issues.length > 0 && (
        <div id={blockId} className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-fg">
          <p className="font-semibold">{blockTitle}</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i.id}>{i.label}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
