import { useId } from 'react';
import { cn } from '@/lib/cn';
import { inputClass } from '../FormField/FormField';
import { Select, type SelectOption } from '../Select';

export type InspectionRowView<S extends string = string> = {
  id: string;
  text: string;
  status: S;
  /** Người kiểm tra (trống → "–"). */
  by?: string;
  /** Giờ đã định dạng "10:50" (trống → "–"). */
  time?: string;
  note: string;
  /** Lỗi của dòng (vd "Có vấn đề" chưa có ghi chú) – viền đỏ ô ghi chú + chữ dưới ô. */
  error?: string;
};

export type InspectionTableProps<S extends string = string> = {
  /** `<caption>` (ẩn khỏi màn hình, đọc được) – vd "Kết quả kiểm tra thiết bị ALT-00128". */
  caption: string;
  rows: readonly InspectionRowView<S>[];
  statusOptions: readonly SelectOption<S>[];
  onStatusChange: (id: string, status: S) => void;
  onNoteChange: (id: string, note: string) => void;
  /** Chỉ đọc (cảnh báo đã hoàn thành / không có quyền). */
  readOnly?: boolean;
  className?: string;
};

/**
 * Bảng "Kết quả kiểm tra thiết bị" (modal cập nhật xử lý cảnh báo áp suất – ảnh 28/10/2026, chưa có node): Hạng mục ·
 * Trạng thái (ô chọn, nhãn ẩn "Trạng thái: <hạng mục>") · Người kiểm tra · Thời gian · Ghi chú (sửa ngay trong dòng, nhãn ẩn
 * "Ghi chú: <hạng mục>"). Ảnh có cột checkbox – bỏ (trạng thái đã đủ nghĩa). `<caption>` + `th scope`; khung tự cuộn ngang
 * dưới ~760 px (role=region có tên, Tab tới được) – trang/modal không tràn.
 */
export function InspectionTable<S extends string = string>({
  caption,
  rows,
  statusOptions,
  onStatusChange,
  onNoteChange,
  readOnly,
  className,
}: InspectionTableProps<S>) {
  const uid = useId();
  return (
    <div role="region" aria-label={caption} tabIndex={0} className={cn('overflow-x-auto rounded-lg border border-line/30', className)}>
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line/30 text-md text-fg-secondary">
            <th scope="col" className="w-[32%] px-4 py-3 font-medium">
              Hạng mục kiểm tra
            </th>
            <th scope="col" className="w-[18%] px-3 py-3 font-medium">
              Trạng thái
            </th>
            <th scope="col" className="w-[15%] px-3 py-3 font-medium">
              Người kiểm tra
            </th>
            <th scope="col" className="w-[10%] px-3 py-3 font-medium">
              Thời gian
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Ghi chú
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const errId = `${uid}-${r.id}-err`;
            const label = statusOptions.find((o) => o.value === r.status)?.label ?? r.status;
            return (
              <tr key={r.id} className="border-b border-line/30 align-top text-base last:border-b-0">
                <th scope="row" className="px-4 py-2.5 font-normal text-fg">
                  <span className="flex min-h-field items-center">{r.text}</span>
                </th>
                <td className="px-3 py-2.5">
                  {readOnly ? (
                    <span className="flex min-h-field items-center text-fg">{label}</span>
                  ) : (
                    <>
                      {/* Tên ô chọn = "Trạng thái: <hạng mục>" + giá trị đang chọn (Select field ghép aria-labelledby). */}
                      <span id={`${uid}-${r.id}-lbl`} className="sr-only">
                        Trạng thái: {r.text}
                      </span>
                      <Select
                        variant="field"
                        label={`Trạng thái: ${r.text}`}
                        labelledBy={`${uid}-${r.id}-lbl`}
                        options={statusOptions}
                        value={r.status}
                        onChange={(v) => v && onStatusChange(r.id, v)}
                      />
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 text-fg">
                  <span className="flex min-h-field items-center">{r.by ?? '–'}</span>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-fg-secondary">
                  <span className="flex min-h-field items-center">{r.time ?? '–'}</span>
                </td>
                <td className="px-3 py-2.5">
                  {readOnly ? (
                    <span className="flex min-h-field items-center text-fg">{r.note || '–'}</span>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={r.note}
                        maxLength={300}
                        onChange={(e) => onNoteChange(r.id, e.target.value)}
                        aria-label={`Ghi chú: ${r.text}`}
                        aria-invalid={r.error ? true : undefined}
                        aria-describedby={r.error ? errId : undefined}
                        placeholder="Thêm ghi chú…"
                        className={cn(inputClass(!!r.error), 'h-field text-sm')}
                      />
                      {r.error && (
                        <p id={errId} className="mt-1 text-sm text-danger-text">
                          {r.error}
                        </p>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
