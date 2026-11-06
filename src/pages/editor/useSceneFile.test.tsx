// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { newScene } from '@/features/scene-editor/ops';
import { useSceneFile } from './useSceneFile';

/*
 * Mở lần đầu của Scene Editor: đọc nháp / mở ?scene= / cảnh mới CHỈ một lần khi vào trang – kể cả dưới StrictMode
 * (effect chạy 2 lần ở dev) và khi trang vẽ lại.
 */
const calls = vi.hoisted(() => ({ readDraft: 0, fetchScene: 0, draft: null as unknown }));
vi.mock('@/features/scene-editor/draft', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/scene-editor/draft')>();
  return {
    ...mod,
    readDraft: () => {
      calls.readDraft++;
      return calls.draft;
    },
  };
});
vi.mock('@/data/scene', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/data/scene')>();
  return {
    ...mod,
    fetchScene: async (id: string) => {
      calls.fetchScene++;
      return newScene(id, 'Cảnh thử');
    },
  };
});

const wrap =
  (url: string, strict: boolean) =>
  ({ children }: { children: ReactNode }) => {
    const tree = <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };

afterEach(() => {
  calls.readDraft = 0;
  calls.fetchScene = 0;
  calls.draft = null;
});

describe('useSceneFile – mở lần đầu', () => {
  test.each([false, true])('?scene=: đọc nháp + mở cảnh đúng một lần; vẽ lại không mở lại (StrictMode = %s)', async (strict) => {
    const flash = vi.fn();
    const { rerender } = renderHook(() => useSceneFile({ setDialog: vi.fn(), flash }), { wrapper: wrap('/editor?scene=canh-thu', strict) });
    await waitFor(() => expect(flash).toHaveBeenCalledWith('Đã mở "Cảnh thử"'));
    rerender();
    rerender();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.readDraft).toBe(1);
    expect(calls.fetchScene).toBe(1);
    expect(flash).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])('có nháp: hỏi khôi phục đúng một lần, không mở cảnh (StrictMode = %s)', async (strict) => {
    calls.draft = { scene: newScene('ban-nhap', 'Nháp'), source: { kind: 'new' }, savedAt: new Date().toISOString() };
    const setDialog = vi.fn();
    renderHook(() => useSceneFile({ setDialog, flash: vi.fn() }), { wrapper: wrap('/editor?scene=canh-thu', strict) });
    await waitFor(() => expect(setDialog).toHaveBeenCalled());
    expect(setDialog).toHaveBeenCalledTimes(1);
    expect(setDialog.mock.calls[0]![0]).toMatchObject({ kind: 'restore' });
    expect(calls.fetchScene).toBe(0);
  });
});
