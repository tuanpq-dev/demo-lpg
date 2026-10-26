import type { Config } from 'tailwindcss';

/** Map CSS variable (kênh RGB) → Tailwind color, hỗ trợ opacity modifier (bg-danger/10). */
const v = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Thay toàn bộ palette mặc định → component chỉ dùng được màu token.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: 'rgb(0 0 0 / <alpha-value>)',
      bg: {
        app: v('bg-app'),
        header: v('bg-header'),
        canvas: v('bg-canvas'),
      },
      surface: {
        DEFAULT: v('surface'),
        raised: v('surface-raised'),
        sunken: v('surface-sunken'),
        muted: v('surface-muted'),
        chip: v('surface-chip'),
      },
      line: {
        DEFAULT: v('line'),
        card: v('line-card'),
        divider: v('divider'),
      },
      fg: {
        DEFAULT: v('text-primary'),
        secondary: v('text-secondary'),
        muted: v('text-muted'),
        label: v('text-label'),
        inverse: v('text-inverse'),
        disabled: v('text-disabled'),
      },
      primary: v('primary'),
      accent: v('accent'),
      info: v('info'),
      success: { DEFAULT: v('success'), strong: v('success-strong') },
      live: v('live'),
      warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
      // `text-danger-text` cho CHỮ; `danger` cho viền/nền/chấm/icon (ESLint chặn `text-danger` trần).
      danger: { DEFAULT: v('danger'), strong: v('danger-strong'), text: v('danger-text'), solid: v('danger-solid') },
      neutral: v('neutral'),
    },
    borderRadius: {
      none: '0',
      xs: 'var(--radius-xs)',
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      full: 'var(--radius-full)',
    },
    fontFamily: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
    fontWeight: {
      normal: 'var(--font-weight-regular)',
      semibold: 'var(--font-weight-semibold)',
      bold: 'var(--font-weight-bold)',
    },
    /**
     * Breakpoint CHUNG (không rải số tuỳ ý trong class). Figma vẽ ở 1565px (≥ wide).
     * - < lg (1024): dùng được, không cần đẹp tuyệt đối · lg–xl: sidebar xuống dưới, menu thu gọn thành nút
     * - xl (1280) – wide: bố cục đầy đủ, menu chỉ icon, KPI 3 cột · ≥ wide (1520): như Figma (KPI 1 hàng, menu đủ chữ)
     * - 3xl (1920): nội dung giới hạn `max-w-content`, căn giữa (màn 2560 không giãn thẻ).
     */
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      wide: '1520px',
      '3xl': '1920px',
    },
    // Thang chữ lấy từ các cặp size/line-height xuất hiện nhiều nhất trong Figma.
    fontSize: {
      '2xs': ['10px', '15px'],
      xs: ['11px', '16px'],
      sm: ['12px', '16px'],
      base: ['14px', '20px'],
      md: ['16px', '24px'],
      lg: ['18px', '27px'],
      xl: ['24px', '28px'],
      '2xl': ['28px', '32px'],
      kpi: ['28px', '42px'],
      '3xl': ['32px', '40px'],
    },
    extend: {
      spacing: {
        card: 'var(--space-card)',
        gutter: 'var(--space-gutter)',
        page: 'var(--space-page)',
        header: 'var(--header-height)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'glow-accent': 'var(--shadow-glow-accent)',
        'glow-success': 'var(--shadow-glow-success)',
        'glow-danger': 'var(--shadow-glow-danger)',
        'glow-warning': 'var(--shadow-glow-warning)',
      },
      letterSpacing: {
        label: '0.55px',
        caps: '0.8px',
      },
      maxWidth: {
        /** Bề rộng tối đa vùng nội dung trang (màn rất lớn: căn giữa, không giãn thẻ). */
        content: 'var(--content-max-width)',
      },
    },
  },
  plugins: [],
} satisfies Config;
