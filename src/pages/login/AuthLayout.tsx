import type { ReactNode } from 'react';
import { Icon } from '@/components';

/** Khung chung các trang /login, /register, /pending (chưa có thiết kế Figma – dựng theo token). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-app px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
            <Icon name="logo" box={20} />
          </span>
          <div className="flex flex-col">
            <span className="text-lg text-fg">Plant Control</span>
            <span className="text-2xs text-fg-muted">Operational Intelligence</span>
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-line-card bg-surface p-6 shadow-card">{children}</div>
      </div>
    </main>
  );
}

/** Thông báo lỗi của form: role="alert" + nhận focus khi xuất hiện (effect ở trang). */
export const formErrorClass = 'rounded-md border border-danger-strong/50 bg-danger/10 px-3 py-2 text-sm text-fg';
