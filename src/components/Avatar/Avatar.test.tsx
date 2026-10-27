// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { NotesThread } from '../NotesThread';
import { Avatar, initials } from './Avatar';

describe('initials (dùng chung Avatar + luồng ghi chú)', () => {
  test.each([
    ['Nguyễn Văn A', 'NA'],
    ['Trần Bình', 'TB'],
    ['  lê   thị c ', 'LC'],
    ['Admin', 'A'],
    ['', ''],
  ])('%s → %s', (name, out) => expect(initials(name)).toBe(out));

  test('cùng một người → cùng chữ ở Avatar và ở luồng ghi chú', () => {
    const { container } = render(
      <>
        <Avatar name="Nguyễn Văn A" />
        <NotesThread notes={[{ id: 'n1', author: 'Nguyễn Văn A', time: '10:50', text: 'Đã kiểm tra' }]} />
      </>,
    );
    const marks = [...container.querySelectorAll('[aria-hidden="true"]')].map((e) => e.textContent).filter((t) => t === 'NA');
    expect(marks.length).toBe(2);
    expect(screen.getByText('Đã kiểm tra')).toBeInTheDocument();
  });
});
