// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionDraft } from './sessionDraft';

const draft = createSessionDraft<{ note: string }>('test:draft:', (raw) =>
  raw && typeof raw === 'object' && typeof (raw as { note?: unknown }).note === 'string' ? { note: (raw as { note: string }).note } : null,
);

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('createSessionDraft', () => {
  it('lưu / đọc / xoá theo mã, khoá có tiền tố', () => {
    expect(draft.save('A-1', { note: 'x' })).toBe(true);
    expect(sessionStorage.getItem('test:draft:A-1')).toBe('{"note":"x"}');
    expect(draft.load('A-1')).toEqual({ note: 'x' });
    expect(draft.load('A-2')).toBeNull();
    draft.clear('A-1');
    expect(draft.load('A-1')).toBeNull();
  });

  it('JSON hỏng hoặc sai dạng → null', () => {
    sessionStorage.setItem('test:draft:B', '{oops');
    expect(draft.load('B')).toBeNull();
    sessionStorage.setItem('test:draft:B', '{"note":1}');
    expect(draft.load('B')).toBeNull();
  });

  it('sessionStorage ném lỗi → save false, load null, clear không ném', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('sessionStorage', { setItem: boom, getItem: boom, removeItem: boom });
    expect(draft.save('C', { note: 'x' })).toBe(false);
    expect(draft.load('C')).toBeNull();
    expect(() => draft.clear('C')).not.toThrow();
  });
});
