// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { EmergencyBanner } from './EmergencyBanner';

describe('EmergencyBanner', () => {
  test('một vùng role="alert" (đủ tiêu đề + câu); phần nhìn thấy ẩn khỏi trình đọc; render lại cùng mức không tạo vùng mới', () => {
    const { rerender, container } = render(<EmergencyBanner title="Quy trình Khẩn cấp (ESD)" text="Câu A" stage="before-esd" />);
    const a = screen.getByRole('alert');
    expect(a).toHaveTextContent('Quy trình Khẩn cấp (ESD). Câu A');
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('Câu A');
    rerender(<EmergencyBanner title="Quy trình Khẩn cấp (ESD)" text="Câu A" stage="before-esd" />);
    expect(screen.getByRole('alert')).toBe(a);
    rerender(<EmergencyBanner title="Quy trình Khẩn cấp (ESD)" text="Câu B" stage="after-esd" />);
    expect(screen.getByRole('alert')).not.toBe(a);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull(); // không đóng được
  });
});
