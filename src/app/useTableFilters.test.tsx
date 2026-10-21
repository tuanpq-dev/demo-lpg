// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { useTableFilters } from './useTableFilters';

type Row = { id: string; status: 'open' | 'done'; area: string };
const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, status: i % 3 === 0 ? 'done' : 'open', area: i < 6 ? 'A' : 'B' }));
const PARAMS = {
  tab: { values: ['all', 'open', 'done'], default: 'all' },
  area: {},
  q: { default: '' },
} as const;

/** Render hook trong router bộ nhớ, trả về cả URL hiện tại để kiểm tra đồng bộ query. */
function setup(initial = '/') {
  let location = '';
  const Spy = () => {
    const l = useLocation();
    location = l.search;
    return null;
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {children}
      <Spy />
    </MemoryRouter>
  );
  const hook = renderHook(
    () =>
      useTableFilters({
        rows,
        getId: (r) => r.id,
        params: PARAMS,
        match: (r, v) => (v.tab === 'all' || r.status === v.tab) && (!v.area || r.area === v.area),
        pageSize: 5,
        tabKey: 'tab',
      }),
    { wrapper },
  );
  return { ...hook, url: () => location };
}

describe('useTableFilters – đồng bộ URL', () => {
  test('đọc bộ lọc từ URL; giá trị ngoài values bị bỏ qua (về mặc định)', () => {
    expect(setup('/?tab=done&area=A').result.current.values).toEqual({ tab: 'done', area: 'A', q: '' });
    expect(setup('/?tab=hack').result.current.values.tab).toBe('all');
  });

  test('đổi bộ lọc → ghi URL, mặc định không ghi, về trang 1', () => {
    const { result, url } = setup('/?page=2');
    expect(result.current.page).toBe(2);
    act(() => result.current.setValues({ tab: 'open' }));
    expect(url()).toBe('?tab=open');
    expect(result.current.page).toBe(1);
    act(() => result.current.setValues({ tab: 'all', area: 'B' }));
    expect(url()).toBe('?area=B');
    act(() => result.current.reset());
    expect(url()).toBe('');
  });

  test('số đếm tab theo bộ lọc còn lại; phân trang kẹp trang vượt quá', () => {
    const { result } = setup('/?area=A&page=9');
    expect(result.current.tabCounts).toEqual({ all: 6, open: 4, done: 2 });
    expect(result.current.pageCount).toBe(2);
    expect(result.current.page).toBe(2);
    expect(result.current.pageRows.map((r) => r.id)).toEqual(['r5']);
  });

  test('bản ghi đang mở + tham số phụ qua URL', () => {
    const { result, url } = setup('/');
    act(() => result.current.setOpenId('r3'));
    expect(result.current.openId).toBe('r3');
    expect(url()).toBe('?open=r3');
    act(() => result.current.setExtra({ create: '1', device: 'V-101' }));
    expect(url()).toBe('?open=r3&create=1&device=V-101');
  });

  test('lựa chọn tự bỏ dòng không còn trong kết quả lọc', () => {
    const { result } = setup('/');
    act(() => result.current.setSelected(['r0', 'r1']));
    act(() => result.current.setValues({ tab: 'done' }));
    expect(result.current.selected).toEqual(['r0']);
  });
});
