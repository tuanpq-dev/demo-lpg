const colorGroups: { title: string; tokens: { name: string; hex: string }[] }[] = [
  {
    title: 'Background / Surface',
    tokens: [
      { name: 'bg-app', hex: '#07111F' },
      { name: 'bg-header', hex: '#0F1C2D' },
      { name: 'bg-canvas', hex: '#0A111A' },
      { name: 'surface', hex: '#111827' },
      { name: 'surface-raised', hex: '#0E1A2B' },
      { name: 'surface-sunken', hex: '#0E1417' },
      { name: 'surface-muted', hex: '#303639' },
      { name: 'surface-chip', hex: '#3C4148' },
    ],
  },
  {
    title: 'Border',
    tokens: [
      { name: 'line', hex: '#3C494E' },
      { name: 'line-card', hex: '#3D4850' },
      { name: 'divider', hex: '#737373' },
    ],
  },
  {
    title: 'Text',
    tokens: [
      { name: 'text-primary', hex: '#DDE3E7' },
      { name: 'text-secondary', hex: '#BDC8D2' },
      { name: 'text-muted', hex: '#BBC9CF' },
      { name: 'text-label', hex: '#A9C7EA' },
      { name: 'text-inverse', hex: '#07111F' },
      { name: 'text-disabled', hex: '#3B4048' },
    ],
  },
  {
    title: 'Brand',
    tokens: [
      { name: 'primary', hex: '#22D3EE' },
      { name: 'accent', hex: '#00B7FF' },
      { name: 'info', hex: '#87CFFF' },
    ],
  },
  {
    title: 'Status',
    tokens: [
      { name: 'success', hex: '#34D399' },
      { name: 'success-strong', hex: '#0FA876' },
      { name: 'live', hex: '#0DE635' },
      { name: 'warning', hex: '#FFBB43' },
      { name: 'warning-soft', hex: '#FFD9A1' },
      { name: 'danger', hex: '#D34957' },
      { name: 'danger-strong', hex: '#FA2439' },
      { name: 'neutral', hex: '#BDC8D2' },
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
                <div className="font-mono text-xs text-fg-muted/70">{t.hex}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

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
