import { tokenHex } from '@/lib/tokens';

/** Tên token (giá trị hex đọc từ tokens.css lúc chạy – không chép tay để khỏi lệch). */
const colorGroups: { title: string; tokens: { name: string }[] }[] = [
  {
    title: 'Background / Surface',
    tokens: [
      { name: 'bg-app' },
      { name: 'bg-header' },
      { name: 'bg-canvas' },
      { name: 'surface' },
      { name: 'surface-raised' },
      { name: 'surface-sunken' },
      { name: 'surface-muted' },
      { name: 'surface-chip' },
    ],
  },
  {
    title: 'Border',
    tokens: [
      { name: 'line' },
      { name: 'line-card' },
      { name: 'divider' },
    ],
  },
  {
    title: 'Text',
    tokens: [
      { name: 'text-primary' },
      { name: 'text-secondary' },
      { name: 'text-muted' },
      { name: 'text-label' },
      { name: 'text-inverse' },
      { name: 'text-disabled' },
    ],
  },
  {
    title: 'Brand',
    tokens: [
      { name: 'primary' },
      { name: 'accent' },
      { name: 'info' },
    ],
  },
  {
    title: 'Status',
    tokens: [
      { name: 'success' },
      { name: 'success-strong' },
      { name: 'live' },
      { name: 'warning' },
      { name: 'warning-soft' },
      { name: 'danger' },
      { name: 'danger-text' },
      { name: 'danger-solid' },
      { name: 'danger-strong' },
      { name: 'neutral' },
    ],
  },
];

const typeScale = [
  { cls: 'text-3xl font-bold', label: '3xl · 32/40 · bold – Tiêu đề trang' },
  { cls: 'text-kpi font-semibold', label: 'kpi · 28/42 · semibold – Số KPI' },
  { cls: 'text-2xl font-bold', label: '2xl · 28/32 · bold' },
  { cls: 'text-xl font-semibold', label: 'xl · 24/28 · semibold – Section heading' },
  { cls: 'text-lg', label: 'lg · 18/27 – Tên app' },
  { cls: 'text-md font-semibold', label: 'md · 16/24 · semibold – Card title' },
  { cls: 'text-base', label: 'base · 14/20 – Body' },
  { cls: 'text-sm', label: 'sm · 12/16 – Table, meta' },
  { cls: 'text-xs', label: 'xs · 11/16 – Caption' },
  { cls: 'text-2xs font-bold', label: '2xs · 10/15 · bold – Badge' },
  { cls: 'text-sm font-mono', label: 'mono · 12/16 – Giá trị/ngưỡng' },
];

const radii = ['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const;
const radiusClass: Record<(typeof radii)[number], string> = {
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

/** Mục đích 4 token đỏ – cùng nội dung với GUIDE.md mục 4g. */
const RED_TOKENS = [
  {
    name: 'danger',
    use: 'VIỀN, NỀN có độ mờ (bg-danger/10), CHẤM, ICON. Không dùng cho chữ.',
    sample: (
      <span className="inline-flex items-center gap-2 rounded-sm border border-danger bg-danger/10 px-2 py-1">
        <span className="size-2 rounded-full bg-danger" />
        <span className="text-sm text-danger-text">viền + nền /10 + chấm</span>
      </span>
    ),
    contrast: 'Làm chữ chỉ 3.3–4.4:1 → không đạt AA.',
  },
  {
    name: 'danger-text',
    use: 'MỌI CHỮ đỏ cỡ thường (nhãn, mã cảnh báo, lỗi form, link "Xem chi tiết", số nhỏ).',
    sample: <span className="text-base text-danger-text">Cần chỉ định kỹ thuật viên · ALT-00128 · 11.8 bar</span>,
    contrast: '5.5:1 trên surface; ≥ 4.8:1 trên mọi nền tối/đỏ mờ đang dùng. Sáng hơn Figma ~20 % (đã duyệt).',
  },
  {
    name: 'danger-strong',
    use: 'Viền/vòng sáng cảnh báo, icon, và SỐ LỚN (≥ 24px thường / ≥ 18.66px đậm – số KPI, đồng hồ quá hạn).',
    sample: (
      // eslint-disable-next-line no-restricted-syntax -- mẫu chữ lớn 28px đậm
      <span className="text-kpi font-bold text-danger-strong">12</span>
    ),
    contrast: '4.54:1 trên surface – chỉ đạt AA cho CHỮ LỚN (chuẩn 3:1).',
  },
  {
    name: 'danger-solid',
    use: 'NỀN ĐẶC có chữ trắng (ô chọn "Nghiêm trọng" của SegmentedControl field…).',
    sample: <span className="inline-block rounded-md bg-danger-solid px-3 py-1 text-sm font-semibold text-fg">Nghiêm trọng</span>,
    contrast: 'Chữ fg trên nền 5.07:1 (nền danger cũ 3.34:1).',
  },
] as const;

export function TokensSection() {
  return (
    <div className="flex flex-col gap-8">
      {colorGroups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-3 text-md font-semibold">{group.title}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {group.tokens.map((t) => (
              <div key={t.name} className="flex flex-col gap-2">
                <div
                  className="h-14 rounded-lg border border-line/30"
                  style={{ backgroundColor: `rgb(var(--color-${t.name}))` }}
                />
                <div className="text-sm text-fg">{t.name}</div>
                <div className="font-mono text-xs text-fg-muted/70">{tokenHex(t.name)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div>
        <h3 className="mb-3 text-md font-semibold">Bốn token đỏ – dùng cho gì (để không dùng nhầm)</h3>
        <p className="mb-3 text-sm text-fg-secondary">
          ESLint chặn <code>text-danger</code> trần, <code>text-danger-strong</code> cho chữ thường và mọi độ mờ trên chữ đỏ (
          <code>text-danger*/NN</code>). Tỉ lệ đo trên nền card <code>surface</code> #111827.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {RED_TOKENS.map((t) => (
            <div key={t.name} className="flex flex-col gap-2 rounded-lg border border-line/30 bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="size-5 shrink-0 rounded-sm border border-line/30" style={{ backgroundColor: `rgb(var(--color-${t.name}))` }} />
                <code className="text-sm text-fg">{t.name}</code>
                <span className="font-mono text-xs text-fg-muted/70">{tokenHex(t.name)}</span>
              </div>
              <p className="text-sm text-fg-secondary">{t.use}</p>
              <div className="rounded-md border border-line/30 bg-bg-app p-2">{t.sample}</div>
              <p className="text-xs text-fg-secondary">{t.contrast}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-md font-semibold">Border alpha (line)</h3>
        <div className="flex gap-4">
          {['border-line/10', 'border-line/30', 'border-line'].map((c) => (
            <div key={c} className={`flex h-14 w-40 items-center justify-center rounded-lg border bg-surface text-sm ${c}`}>
              {c}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-md font-semibold">Typography (Segoe UI)</h3>
        <div className="flex flex-col gap-2 rounded-xl border border-line/30 bg-surface p-card">
          {typeScale.map((t) => (
            <div key={t.label} className="flex items-baseline gap-6">
              <span className={`w-64 shrink-0 ${t.cls}`}>Plant 152,340</span>
              <span className="text-sm text-fg-muted/70">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-md font-semibold">Radius</h3>
        <div className="flex flex-wrap gap-4">
          {radii.map((r) => (
            <div key={r} className="flex flex-col items-center gap-2">
              <div className={`h-14 w-14 border border-accent/30 bg-surface-raised ${radiusClass[r]}`} />
              <span className="text-sm text-fg-muted/70">{r}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-md font-semibold">Shadow</h3>
        <div className="flex flex-wrap gap-6">
          {['shadow-card', 'shadow-glow-accent', 'shadow-glow-success', 'shadow-glow-danger'].map((s) => (
            <div key={s} className={`flex h-16 w-44 items-center justify-center rounded-lg bg-surface text-sm ${s}`}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
