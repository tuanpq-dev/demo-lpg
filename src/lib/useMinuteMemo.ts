import { useMemo, type DependencyList } from 'react';

/**
 * `useMemo` tính lại theo PHÚT của `now` (ms) thay vì mỗi lần `now` đổi – cho chuỗi lịch sử/xu hướng không cần vẽ lại mỗi giây.
 * `factory` nhận `now` của lần tính; `deps` là phụ thuộc khác (dữ liệu nguồn).
 */
export function useMinuteMemo<T>(factory: (now: number) => T, now: number, deps: DependencyList): T {
  const minute = Math.floor(now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` đại diện `now`; `factory` là hàm inline mỗi render
  return useMemo(() => factory(now), [...deps, minute]);
}
