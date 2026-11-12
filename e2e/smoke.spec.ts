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

  test('chuyển trang: header KHÔNG dựng lại và không đổi nội dung ở khung hình nào (không nháy)', async ({ page }) => {
    await page.goto('/overview');
    const header = page.locator('header').first();
    // Số cảnh báo chưa xác nhận đã về (huy hiệu trên tab Cảnh báo) rồi mới bắt đầu đo.
    await expect(header.getByRole('tab', { name: /Cảnh báo/ })).toContainText(/\d/);
    // Ghi lại MỖI khung hình: header còn là phần tử cũ không + số cảnh báo đang hiện + bề rộng menu.
    await page.evaluate(() => {
      const first = document.querySelector('header');
      const w = window as unknown as { __header: { remounted: boolean; states: Set<string> } };
      w.__header = { remounted: false, states: new Set() };
      const tick = () => {
        const h = document.querySelector('header');
        if (h !== first) w.__header.remounted = true;
        // Tên trang trong nút Menu đổi theo trang là đúng → chỉ so các con số (số cảnh báo) + bề rộng menu.
        const counts = h ? (h.textContent?.match(/\d+/g) ?? []).join(',') : '(không có header)';
        w.__header.states.add(`${counts}|${h?.querySelector('nav')?.getBoundingClientRect().width ?? 0}`);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (let round = 0; round < 3; round++) {
      for (const [tab, url] of [
        [/Cảnh báo/, /\/alerts/],
        [/Bảo trì/, /\/maintenance/],
        [/Báo cáo/, /\/reports/],
        [/Tổng quan/, /\/overview/],
      ] as const) {
        await header.getByRole('tab', { name: tab }).click();
        await expect(page).toHaveURL(url);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      }
    }
    const result = await page.evaluate(() => {
      const { remounted, states } = (window as unknown as { __header: { remounted: boolean; states: Set<string> } }).__header;
      return { remounted, states: [...states] };
    });
    expect(result.remounted, 'header bị gỡ / dựng lại khi chuyển trang').toBe(false);
    expect(result.states, 'số cảnh báo / bề rộng menu đổi giữa chừng').toHaveLength(1);
  });

  test('Bản đồ nội khu: quay lại trang → tiêu đề đúng ngay, trang không đổi chiều cao sau khi hiện; luôn giữ chỗ thanh cuộn', async ({ page }) => {
    await page.goto('/overview');
    // Giữ sẵn chỗ thanh cuộn → thanh cuộn hiện / mất không làm header xô ngang (bản chạy ẩn giấu thanh cuộn nên kiểm CSS).
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter)).toBe('stable');
    const header = page.locator('header').first();
    const openMap = async () => {
      await header.getByRole('tab', { name: /Bản đồ nội khu/ }).click();
      await expect(page).toHaveURL(/\/map\/V-101/);
      await expect(page.getByRole('heading', { level: 1, name: /Bồn LPG V-101/ })).toBeVisible();
    };
    await openMap();
    await header.getByRole('tab', { name: /Tổng quan/ }).click();
    await expect(page).toHaveURL(/\/overview/);
    // Lần quay lại: ghi MỖI khung hình tên trang + chiều cao trang kể từ lúc trang bản đồ hiện.
    await page.evaluate(() => {
      const w = window as unknown as { __map: { titles: Set<string>; heights: Set<number> } };
      w.__map = { titles: new Set(), heights: new Set() };
      const tick = () => {
        if (location.pathname.startsWith('/map/')) {
          const h1 = document.querySelector('main h1');
          // URL đổi trước khi trang mới được vẽ → chỉ ghi khi tiêu đề đã là của trang bản đồ (chữ thế chỗ là "V-101").
          if (h1?.textContent?.includes('V-101')) {
            w.__map.titles.add(h1.textContent ?? '');
            w.__map.heights.add(document.documentElement.scrollHeight);
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await openMap();
    await page.waitForTimeout(1500);
    const seen = await page.evaluate(() => {
      const { titles, heights } = (window as unknown as { __map: { titles: Set<string>; heights: Set<number> } }).__map;
      return { titles: [...titles], heights: [...heights] };
    });
    expect(seen.titles, 'tiêu đề trang đổi chữ sau khi hiện (chữ thế chỗ → tên thật)').toEqual(['Bồn LPG V-101']);
    expect(seen.heights, 'trang đổi chiều cao sau khi hiện (dữ liệu thẻ về muộn)').toHaveLength(1);
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
