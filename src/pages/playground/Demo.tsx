import type { ReactNode } from 'react';

/**
 * Khung một mẫu trong playground: tiêu đề + node Figma + vùng nội dung cuộn ngang được.
 * Vùng cuộn focus được bằng bàn phím (axe `scrollable-region-focusable`, WCAG 2.1.1) và có tên theo tiêu đề.
 */
export function Demo({ title, node, children }: { title: string; node: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h3 className="text-md font-semibold">{title}</h3>
        <span className="font-mono text-xs text-fg-muted/65">Figma {node}</span>
      </div>
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className="flex flex-col gap-4 overflow-x-auto rounded-lg border border-dashed border-line/30 p-4"
      >
        {children}
      </div>
    </div>
  );
}
