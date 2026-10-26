/*
 * Luật màu chữ đỏ (eslint.config.js `DANGER_TEXT_RULES`): chạy ESLint thật trên mã mẫu để chắc luật bắt đúng và không bắt nhầm.
 * Mục đích 4 token đỏ: GUIDE.md mục 4g · CLAUDE.md mục 3.
 */
import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });
async function errors(code: string) {
  const [r] = await eslint.lintText(code, { filePath: 'src/__color_rule_fixture__.tsx' });
  return r!.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message.slice(0, 20));
}

describe('luật chữ đỏ', { timeout: 30_000 }, () => {
  test('cấm text-danger trần (JSX, chuỗi, template, có tiền tố hover:)', async () => {
    expect(await errors('export const a = <span className="text-danger">x</span>;')).toHaveLength(1);
    expect(await errors("export const b = 'px-2 hover:text-danger';")).toHaveLength(1);
    expect(await errors('export const c = `px-2 ${1} text-danger`;')).toHaveLength(1);
  });
  test('cấm text-danger-strong cho chữ (trừ khi ghi ngoại lệ chữ lớn/icon)', async () => {
    expect(await errors("export const a = 'text-sm text-danger-strong';")).toHaveLength(1);
    expect(
      await errors("// eslint-disable-next-line no-restricted-syntax -- chữ lớn 28px đậm\nexport const a = 'text-kpi font-bold text-danger-strong';"),
    ).toHaveLength(0);
  });
  test('cấm độ mờ trên chữ đỏ: text-danger*/NN', async () => {
    for (const cls of ['text-danger/80', 'text-danger-strong/70', 'text-danger-text/60', 'text-danger-solid/50']) {
      expect(await errors(`export const a = '${cls}';`), cls).toHaveLength(1);
    }
  });
  test('không bắt nhầm: danger-text, viền/nền/chấm, nền có độ mờ', async () => {
    expect(
      await errors(
        "export const a = 'text-danger-text font-bold border-danger bg-danger/10 bg-danger-strong/15 border-danger-strong/30 bg-danger-solid text-fg';",
      ),
    ).toEqual([]);
  });
});
