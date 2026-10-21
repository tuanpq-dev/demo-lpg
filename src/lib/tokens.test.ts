// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { tokenColor, tokenHex } from './tokens';

test('tokenHex/tokenColor đọc biến CSS kênh RGB', () => {
  document.documentElement.style.setProperty('--color-primary', '34 211 238');
  expect(tokenHex('primary')).toBe('#22D3EE');
  expect(tokenColor('primary', 0.5)).toBe('rgb(34 211 238 / 0.5)');
  expect(tokenHex('khong-co')).toBe('—');
});
