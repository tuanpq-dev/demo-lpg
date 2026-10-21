import type { ReactNode } from 'react';

/**
 * Khung một mẫu trong playground (dùng chung mọi mục): tiêu đề + node Figma (nếu có) + vùng nội dung cuộn ngang được,
 * tuỳ chọn ảnh Figma tham chiếu đặt cạnh (`refImg`, 2 cột từ xl).
 * Vùng cuộn focus được bằng bàn phím (axe `scrollable-region-focusable`, WCAG 2.1.1) và có tên theo tiêu đề.
 */
export function Demo({ title, node, refImg, children }: { title: string; node?: string; refImg?: string; children: ReactNode }) {
  const body = (
    <div
      role="region"
      aria-label={title}
      tabIndex={0}
      className="flex flex-col gap-4 overflow-x-auto rounded-lg border border-dashed border-line/30 bg-bg-app p-4"
    >
      {children}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h3 className="text-md font-semibold">{title}</h3>
        {node && <span className="font-mono text-xs text-fg-muted/65">Figma {node}</span>}
      </div>
      {refImg ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {body}
          <figure className="flex flex-col gap-2 rounded-lg border border-dashed border-line/30 p-4">
            <figcaption className="text-xs text-fg-muted/65">Figma (tham chiếu)</figcaption>
            <img src={refImg} alt={`Figma ${node ?? title}`} className="max-w-full self-start" />
          </figure>
        </div>
      ) : (
        body
      )}
    </div>
  );
}
