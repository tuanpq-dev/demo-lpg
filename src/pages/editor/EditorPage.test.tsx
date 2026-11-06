// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Link, RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { AuthService, AuthState } from '@/api/auth';
import { AuthProvider } from '@/app/auth';
import { writeDraft } from '@/features/scene-editor/draft';
import { newScene } from '@/features/scene-editor/ops';
import { useEditorUi, useSceneDoc } from '@/features/scene-editor/store';
import EditorPage from './EditorPage';

/*
 * Scene Editor (/editor): hành vi trang trước khi tách thành khối (06/11/2026) – thanh tệp, thanh trạng thái, bảng phải,
 * phím tắt, hộp thoại (khôi phục nháp, xác nhận bỏ thay đổi, lưu bản mới, import lỗi), chặn rời trang khi chưa lưu.
 * Canvas 3D (EditorViewport → SceneViewer, cần WebGL) thay bằng khung rỗng.
 */
vi.mock('./EditorViewport', () => ({ EditorViewport: () => <div data-testid="viewport" /> }));

const state: AuthState = { status: 'authenticated', user: { id: 'u1', email: 'a@example.com', name: 'Admin', role: 'admin', status: 'active' } };
const service: AuthService = {
  getState: () => state,
  subscribe: () => () => {},
  init: async () => {},
  login: async () => state.user!,
  register: async () => '',
  logout: async () => {},
  refresh: async () => true,
  expiresAt: () => null,
};

function renderAt(url = '/editor') {
  const router = createMemoryRouter(
    [
      { path: '/editor', element: <EditorPage /> },
      { path: '/overview', element: <Link to="/editor">Tổng quan</Link> },
    ],
    { initialEntries: [url] },
  );
  render(
    <AuthProvider service={service}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}
const status = () => screen.getByRole('contentinfo', { name: 'Trạng thái' });
const toolbar = () => screen.getByRole('toolbar', { name: 'Tệp cảnh' });
/** Tệp JSON có `text()` (jsdom chưa có Blob.text). */
const jsonFile = (content: string, name: string) => Object.assign(new File([content], name, { type: 'application/json' }), { text: async () => content });
/** Sửa cảnh như người dùng (qua store có lịch sử) → "Chưa lưu". */
const edit = () => act(() => useSceneDoc.getState().setScene((s) => ({ ...s, name: `${s.name} (sửa)` })));

beforeEach(() => {
  localStorage.clear();
  useEditorUi.setState({ tool: 'translate', grid: true, ortho: true });
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('EditorPage', () => {
  test('vào trang không có nháp / ?scene → cảnh mới chưa có trong kho; Hoàn tác / Làm lại khoá', async () => {
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('Cảnh mới'));
    expect(status()).toHaveTextContent('canh-moi');
    expect(status()).toHaveTextContent('✓ Đã lưu');
    expect(status()).toHaveTextContent('chưa có trong kho');
    expect(within(toolbar()).getByRole('heading', { level: 1, name: 'Scene Editor' })).toBeInTheDocument();
    expect(within(toolbar()).getByRole('button', { name: 'Hoàn tác (Ctrl+Z)' })).toBeDisabled();
    expect(within(toolbar()).getByRole('button', { name: 'Làm lại (Ctrl+Shift+Z)' })).toBeDisabled();
    expect(within(toolbar()).queryByRole('link', { name: /Xem ở Tổng quan/ })).toBeNull();
    // Bảng phải: 3 tab, mặc định Thuộc tính
    expect(screen.getByRole('tab', { name: /Thuộc tính/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Góc nhìn/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Kiểm tra/ })).toBeInTheDocument();
  });

  test('?scene=<cảnh mẫu> → mở cảnh mẫu (chỉ đọc); Lưu → hỏi "Lưu thành bản mới" với id bản sao', async () => {
    const user = userEvent.setup();
    renderAt('/editor?scene=v-101');
    await waitFor(() => expect(status()).toHaveTextContent('cảnh mẫu (chỉ đọc)'));
    expect(within(status()).getByRole('status')).toHaveTextContent(/^Đã mở ".+"$/);
    await user.click(within(toolbar()).getByRole('button', { name: 'Lưu' }));
    const dlg = await screen.findByRole('dialog', { name: 'Lưu thành bản mới' });
    expect(within(dlg).getByDisplayValue('v-101-ban-sao')).toBeInTheDocument();
  });

  test('sửa → "Chưa lưu", Hoàn tác mở; Ctrl+S lưu vào kho → "đã lưu trong trình duyệt" + link Tổng quan', async () => {
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    edit();
    expect(status()).toHaveTextContent('● Chưa lưu');
    expect(within(toolbar()).getByRole('button', { name: 'Hoàn tác (Ctrl+Z)' })).toBeEnabled();
    await user.keyboard('{Control>}s{/Control}');
    await waitFor(() => expect(status()).toHaveTextContent('đã lưu trong trình duyệt'));
    expect(status()).toHaveTextContent('✓ Đã lưu');
    expect(within(status()).getByRole('status')).toHaveTextContent(/^Đã lưu "Cảnh mới \(sửa\)" \(v1\)/);
    expect(within(toolbar()).getByRole('link', { name: 'Xem ở Tổng quan →' })).toHaveAttribute('href', '/overview?scene=canh-moi');
  });

  test('phím tắt: W/E/R/P/Q đổi công cụ, G/O bật tắt lưới / trực giao, Ctrl+Z hoàn tác; không chạy khi đang gõ', async () => {
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    for (const [k, tool] of [['e', 'rotate'], ['r', 'scale'], ['p', 'pipe'], ['q', 'select'], ['w', 'translate']] as const) {
      await user.keyboard(k);
      expect(useEditorUi.getState().tool).toBe(tool);
    }
    await user.keyboard('g');
    expect(useEditorUi.getState().grid).toBe(false);
    await user.keyboard('o');
    expect(useEditorUi.getState().ortho).toBe(false);

    edit();
    await user.keyboard('{Control>}z{/Control}');
    expect(status()).toHaveTextContent('✓ Đã lưu');
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(status()).toHaveTextContent('● Chưa lưu');

    // Đang gõ ở ô nhập → bỏ qua phím tắt
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    await user.keyboard('e');
    expect(useEditorUi.getState().tool).toBe('translate');
    input.remove();
  });

  test('bấm "x lỗi · y cảnh báo" ở thanh trạng thái → sang tab Kiểm tra', async () => {
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    await user.click(within(status()).getByRole('button', { name: /\d+ lỗi · \d+ cảnh báo/ }));
    expect(screen.getByRole('tab', { name: /Kiểm tra/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('"Cảnh mới" khi chưa lưu → hỏi bỏ thay đổi; Bỏ thay đổi → cảnh mới', async () => {
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    edit();
    await user.click(within(toolbar()).getByRole('button', { name: 'Cảnh mới' }));
    const dlg = await screen.findByRole('dialog', { name: 'Tạo cảnh mới?' });
    expect(dlg).toHaveTextContent('Cảnh đang sửa có thay đổi chưa lưu. Bỏ các thay đổi đó?');
    await user.click(within(dlg).getByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(status()).toHaveTextContent('✓ Đã lưu'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('import JSON sai → hộp thoại lỗi; JSON hợp lệ → cảnh import chưa lưu', async () => {
    const user = userEvent.setup();
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    const input = screen.getByLabelText('Chọn tệp JSON để import');
    await user.upload(input, jsonFile('{oops', 'hong.json'));
    const err = await screen.findByRole('dialog', { name: 'Không import được cảnh' });
    expect(err).toHaveTextContent(/JSON không hợp lệ: .*JSON/);
    await user.keyboard('{Escape}');

    const scene = { ...newScene('nhap-khau', 'Cảnh nhập'), version: 3 };
    await user.upload(input, jsonFile(JSON.stringify(scene), 'nhap-khau.json'));
    await waitFor(() => expect(within(status()).getByRole('status')).toHaveTextContent('Đã import "Cảnh nhập" (0 object) – chưa lưu'));
    expect(status()).toHaveTextContent('nhap-khau');
    expect(status()).toHaveTextContent('● Chưa lưu');
  });

  test('Export JSON → tải tệp <id>.json + thông báo', async () => {
    const user = userEvent.setup();
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    await user.click(within(toolbar()).getByRole('button', { name: 'Export JSON' }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(within(status()).getByRole('status')).toHaveTextContent('Đã xuất canh-moi.json');
    click.mockRestore();
  });

  test('có bản nháp → hỏi khôi phục; Khôi phục → nạp nháp (chưa lưu)', async () => {
    const user = userEvent.setup();
    writeDraft(newScene('ban-nhap', 'Cảnh nháp'), { kind: 'new' });
    renderAt();
    const dlg = await screen.findByRole('dialog', { name: 'Khôi phục bản nháp?' });
    expect(dlg).toHaveTextContent('Cảnh nháp');
    await user.click(within(dlg).getByRole('button', { name: 'Khôi phục' }));
    await waitFor(() => expect(within(status()).getByRole('status')).toHaveTextContent('Đã khôi phục bản nháp "Cảnh nháp"'));
    expect(status()).toHaveTextContent('ban-nhap');
    expect(status()).toHaveTextContent('● Chưa lưu');
  });

  test('tự lưu nháp mỗi 3 giây khi chưa lưu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    edit();
    expect(localStorage.getItem('demo-lpg:editor-draft')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    expect(localStorage.getItem('demo-lpg:editor-draft')).toContain('Cảnh mới (sửa)');
  });

  test('rời trang khi chưa lưu → hỏi "Rời Scene Editor?"; Ở lại giữ trang', async () => {
    const user = userEvent.setup();
    const router = renderAt();
    await waitFor(() => expect(status()).toHaveTextContent('canh-moi'));
    edit();
    await act(() => router.navigate('/overview'));
    const dlg = await screen.findByRole('dialog', { name: 'Rời Scene Editor?' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Rời Scene Editor?' })).toBeNull());
    expect(dlg).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/editor');
  });
});
