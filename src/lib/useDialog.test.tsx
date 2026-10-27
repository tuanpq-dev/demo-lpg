// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { useDialog } from './useDialog';

function Dialog({ name, onClose, children }: { name: string; onClose: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useDialog({ open: true, onClose, panelRef: ref });
  return (
    <div role="presentation" onKeyDown={onKeyDown}>
      <div ref={ref} role="dialog" aria-label={name}>
        <button type="button">{`Nút ${name}`}</button>
        {children}
      </div>
    </div>
  );
}

function Stack() {
  const [drawer, setDrawer] = useState(true);
  const [modal, setModal] = useState(false);
  return (
    <>
      <button type="button">Mở</button>
      {drawer && (
        <Dialog name="Drawer" onClose={() => setDrawer(false)}>
          <button type="button" onClick={() => setModal(true)}>
            Tạo yêu cầu
          </button>
        </Dialog>
      )}
      {modal && <Dialog name="Modal" onClose={() => setModal(false)} />}
    </>
  );
}

describe('useDialog – hộp chồng nhau', () => {
  test('Esc chỉ đóng hộp trên cùng, trả focus về nút đã mở; Esc lần hai đóng drawer', async () => {
    const user = userEvent.setup();
    render(<Stack />);
    await user.click(screen.getByRole('button', { name: 'Tạo yêu cầu' }));
    expect(screen.getByRole('dialog', { name: 'Modal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nút Modal' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Modal' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Drawer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo yêu cầu' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Drawer' })).toBeNull();
  });
});
