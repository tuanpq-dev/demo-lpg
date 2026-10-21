// Chạy trước mọi file test. Matcher DOM (toBeInTheDocument…) cho test component; dọn DOM sau mỗi test.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});

// jsdom thiếu một số API trình duyệt mà component dùng.
if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
