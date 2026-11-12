import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test: mọi trang chính + luồng mở drawer / modal render được, KHÔNG lỗi JS / console, không rơi vào trang lỗi.
 * Không so pixel (giao diện kiểm tay theo ảnh thiết kế) – chỉ chặn trang trắng, lỗi chunk, lỗi runtime.
 */

/** Gom lỗi runtime + console.error của trang. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  return errors;
}

/** Trang đã render xong: có h1, không phải trang lỗi chung. */
async function expectPage(page: Page, heading: RegExp) {
  await expect(page.getByRole('heading', { level: 1, name: heading }).first()).toBeVisible();
  await expect(page.getByText('Đã xảy ra lỗi', { exact: false })).toHaveCount(0);
}

const PAGES: [path: string, heading: RegExp][] = [
  ['/overview', /Tổng quan/],
  ['/alerts', /cảnh báo/i],
  ['/maintenance', /bảo trì/i],
  // h1 = tên yêu cầu (đổi theo mock) → chỉ cần có tiêu đề.
  ['/maintenance/MT-00125', /.+/],
  ['/reports', /báo cáo/i],
  ['/operations/devices/E-101A', /Chi tiết thiết bị/],
  ['/operations/devices/PLC-SCADA', /Chi tiết thiết bị/],
  ['/operations/logs', /Nhật ký/i],
  ['/operations/ai-simulation', /mô phỏng/i],
  ['/operations/ai-simulation/SC-001/config', /kịch bản|cấu hình/i],
  ['/operations/ai-simulation/SC-001/monitor', /diễn biến|theo dõi/i],
  ['/operations/ai-simulation/SC-001/result', /kết quả/i],
  ['/map/V-101', /V-101|tài sản/i],
];

for (const [path, heading] of PAGES) {
  test(`trang ${path}`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await expectPage(page, heading);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

test('mobile 390 px: mọi trang render không lỗi và KHÔNG tràn ngang', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  for (const [path, heading] of PAGES) {
    await page.goto(path);
    await expectPage(page, heading);
    await page.waitForLoadState('networkidle');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `${path}: trang rộng ${width}px trên màn 390px`).toBeLessThanOrEqual(390);
  }
  expect(errors).toEqual([]);
});

test('header bảo mật (vercel.json) được gửi và trang 3D không vi phạm CSP', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ← ${e.blockedURI}`);
    });
  });
  const res = await page.goto('/map/V-101');
  const h = res!.headers();
  expect(h['content-security-policy']).toContain("script-src 'self'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBeTruthy();
  // Cảnh 3D: three.js + zod (validate cảnh) + nhãn – các thư viện dễ đụng CSP nhất.
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('URL lạ → trang 404 (không trắng trang)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/khong-co-trang-nay');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/không tìm thấy/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('luồng chính', () => {
  test('cài đặt: menu Cài đặt → Chỉnh sửa bản đồ 3D; /editor cũ chuyển sang route mới', async ({ page }) => {
    const errors = watchErrors(page);
    // Bản e2e là VITE_AUTH=off: phiên giả admin có quyền scene:write → mục có trong menu, không cần ?edit=1.
    await page.goto('/overview');
    await page.getByRole('button', { name: 'Cài đặt' }).click();
    await page.getByRole('button', { name: 'Chỉnh sửa bản đồ 3D' }).click();
    await expect(page).toHaveURL(/\/settings\/map-editor$/);
    await expect(page.getByRole('complementary', { name: 'Thư viện và cây object' })).toBeVisible();
    await page.goto('/editor?scene=demo');
    await expect(page).toHaveURL(/\/settings\/map-editor\?scene=demo$/);
    expect(errors).toEqual([]);
  });

  test('cảnh báo: mở drawer chi tiết bằng query', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/alerts?alert=ALT-00128');
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await expect(page.getByRole('dialog').first()).toContainText('ALT-00128');
    expect(errors).toEqual([]);
  });

  test('cảnh báo: chọn tất cả → thanh thao tác hàng loạt', async ({ page }) => {
    await page.goto('/alerts');
    await page.getByRole('checkbox', { name: 'Chọn tất cả' }).first().check();
    await expect(page.getByText(/đã chọn/i).first()).toBeVisible();
  });

  test('bảo trì: modal tạo yêu cầu + các modal theo query', async ({ page }) => {
    const errors = watchErrors(page);
    for (const q of ['create=1', 'progress=MT-00125', 'assign=MT-00128', 'review=MT-00115']) {
      await page.goto(`/maintenance?${q}`);
      await expect(page.getByRole('dialog').first(), q).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('báo cáo: mở modal ký xác nhận và chi tiết ngày', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/reports');
    await page
      .getByRole('button', { name: /^Ký xác nhận/ })
      .first()
      .click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page
      .getByRole('link', { name: /^Xem báo cáo/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/reports\/daily\//);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Tổng quan: cuộn trang → nút bản đồ nằm DƯỚI header dính (không đè)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/overview');
    const zoom = page.getByRole('button', { name: 'Phóng to' }).first();
    await expect(zoom).toBeVisible();
    // Chờ bố cục đứng yên (khối bản đồ / số liệu tải xong làm xô vị trí) – đo khi còn dịch chuyển thì cuộn lệch.
    let last = -1;
    await expect
      .poll(async () => {
        const y = (await zoom.boundingBox())!.y + (await page.evaluate(() => window.scrollY));
        const stable = y === last;
        last = y;
        return stable;
      })
      .toBe(true);
    // Cuộn để tâm nút nằm giữa chiều cao header (60 px).
    await page.evaluate((y) => window.scrollTo(0, y), last - 30);
    await expect.poll(async () => (await zoom.boundingBox())!.y, { message: 'nút phải cuộn vào vùng header' }).toBeLessThan(45);
    const box = (await zoom.boundingBox())!;
    const onTop = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('header, [role="banner"]'), {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(onTop, 'header phải nằm trên nút bản đồ').toBe(true);
  });

  test('chi tiết thiết bị: CLS < 0,1 khi dữ liệu + số liệu trực tiếp về (390 và 1024 px)', async ({ page }) => {
    for (const width of [390, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto('/operations/devices/PLC-SCADA');
      // KPI "Trạng thái PLC" đổi "—" → "Trực tuyến" khi số liệu trực tiếp về.
      await expect(page.getByText('Trực tuyến').first()).toBeVisible();
      await page.waitForTimeout(1000);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, `CLS ở ${width}px`).toBeLessThan(0.1);
    }
  });
});
