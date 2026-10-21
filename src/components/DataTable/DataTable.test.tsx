// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { DataTable } from './DataTable';

type Row = { id: string; name: string };
const rows: Row[] = [
  { id: '1', name: 'V-101' },
  { id: '2', name: 'P-101A' },
  { id: '3', name: 'F-101' },
];

function Harness({ initial = [] as string[] }) {
  const [sel, setSel] = useState<string[]>(initial);
  return (
    <>
      <DataTable label="Thiết bị" columns={[{ id: 'name', header: 'Tên' }]} rows={rows} getRowId={(r) => r.id} selectable selectedIds={sel} onSelectionChange={setSel} />
      <output data-testid="sel">{sel.join(',')}</output>
    </>
  );
}

describe('DataTable – chọn tất cả', () => {
  test('chọn tất cả → mọi dòng; bấm lại → bỏ hết', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: 'Chọn tất cả' }));
    expect(screen.getByTestId('sel')).toHaveTextContent('1,2,3');
    await user.click(screen.getByRole('checkbox', { name: 'Bỏ chọn tất cả' }));
    expect(screen.getByTestId('sel')).toHaveTextContent('');
  });

  test('chọn một phần → ô header ở trạng thái indeterminate (mixed)', () => {
    render(<Harness initial={['2']} />);
    const all = screen.getByRole('checkbox', { name: 'Chọn tất cả' }) as HTMLInputElement;
    expect(all.indeterminate || all.getAttribute('aria-checked') === 'mixed').toBe(true);
  });

  test('bảng có tên truy cập, header cột là columnheader', () => {
    render(<Harness />);
    expect(screen.getByRole('table', { name: 'Thiết bị' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tên' })).toBeInTheDocument();
  });
});
