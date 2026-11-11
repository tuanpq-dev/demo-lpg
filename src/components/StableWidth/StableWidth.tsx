import type { ReactNode } from 'react';

export type StableWidthProps = {
  /** Mọi giá trị có thể hiện (vd các nhãn trạng thái) – ô rộng bằng giá trị dài nhất. */
  candidates: readonly string[];
  children: ReactNode;
};

/**
 * Giữ bề rộng cố định cho chữ đổi theo dữ liệu trực tiếp ("—" → "Đang hoạt động"): các giá trị ứng viên xếp chồng ẩn
 * (`invisible`, trình đọc màn hình bỏ qua) cùng ô lưới với giá trị thật → đổi giá trị không xô hàng chip / xuống dòng
 * (layout shift). Kế thừa cỡ chữ / độ đậm của phần tử cha.
 */
export function StableWidth({ candidates, children }: StableWidthProps) {
  return (
    <span className="inline-grid">
      {candidates.map((c) => (
        <span key={c} aria-hidden="true" className="invisible col-start-1 row-start-1">
          {c}
        </span>
      ))}
      <span className="col-start-1 row-start-1">{children}</span>
    </span>
  );
}
