// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AssigneeCard } from '../AssigneeCard';
import { AttachmentCard, attachmentKind } from '../AttachmentCard';
import { StickyActionBar } from './StickyActionBar';

describe('StickyActionBar', () => {
  test('vùng có tên; chèn đệm cùng chiều cao; scroll-padding khi hiện, gỡ khi ẩn', () => {
    const { unmount } = render(
      <StickyActionBar label="Thao tác MT-1">
        <button type="button">Tiếp nhận ngay</button>
      </StickyActionBar>,
    );
    const region = screen.getByRole('region', { name: 'Thao tác MT-1' });
    expect((region.previousElementSibling as HTMLElement).style.height).toBe('var(--action-bar-height)');
    expect(document.documentElement.style.scrollPaddingBottom).toBe('calc(var(--action-bar-height) + 16px)');
    unmount();
    expect(document.documentElement.style.scrollPaddingBottom).toBe('');
  });
});

describe('AttachmentCard / AssigneeCard', () => {
  test('nút Xem/Tải xuống có tên kèm tệp; đoán loại theo đuôi', () => {
    render(<AttachmentCard id="f1" name="a.pdf" onView={() => {}} onDownload={() => {}} />);
    expect(screen.getByRole('button', { name: 'Xem a.pdf' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Tải xuống a.pdf' })).toBeEnabled();
    expect(attachmentKind('x.JPG')).toBe('image');
    expect(attachmentKind('x.pdf')).toBe('document');
    expect(attachmentKind('x.pdf', 'manual')).toBe('manual');
  });
  test('chưa phân công → nhắc chỉ định + nút "Phân công người xử lý"; có người → "Đổi người xử lý"', () => {
    const { rerender } = render(<AssigneeCard assignee={null} department="Bảo trì Cơ khí" shift="Ca 1" onAssign={() => {}} />);
    expect(screen.getByText('Cần chỉ định kỹ thuật viên')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Phân công người xử lý' })).toBeEnabled();
    rerender(<AssigneeCard assignee="Trần Bình" onAssign={() => {}} assignDisabled />);
    expect(screen.getByRole('button', { name: 'Đổi người xử lý' })).toBeDisabled();
    expect(screen.getByText('Trần Bình')).toBeInTheDocument();
  });
});
