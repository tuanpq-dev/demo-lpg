# demo-lpg – Digital Twin 2026 (Plant Control)

Dashboard giám sát hệ thống LPG: Tổng quan · Cảnh báo · Bảo trì · Báo cáo · Vận hành (thiết bị, nhật ký, AI mô phỏng) · Chi tiết tài sản · Scene Editor 3D. Dữ liệu hiện là **mock** đi qua lớp `src/data/` (thay bằng API sau, không sửa giao diện).

Stack: Vite 6 · React 18 · TypeScript strict · Tailwind 3 · react-router 7 · recharts 3 · three/R3F (tải lười) · zod 4 · vitest.

## Bắt đầu

Yêu cầu: **Node 20 hoặc 22** (`.nvmrc` = 20), npm 10.

```bash
npm ci
VITE_AUTH=off npm run dev     # không cần backend – phiên giả admin, http://localhost:5173
npm run dev                   # có đăng nhập – cần backend ở VITE_API_URL (mặc định http://localhost:3000)
```

Backend nằm ở repo riêng `../demo-lpg-server` (NestJS + PostgreSQL): `npm run db:up && npm run dev` trong repo đó.

## Lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint + Prettier (`npm run format` để tự sửa định dạng) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm test` | Unit test (vitest, chỉ logic thuần – xem bên dưới) · `npm run test:watch` khi đang sửa |
| `npm run test:e2e` | Smoke test trình duyệt (Playwright) trên bản build – máy chưa cài trình duyệt Playwright: `PW_CHROMIUM_PATH=/usr/bin/brave-browser npm run test:e2e` hoặc `npx playwright install chromium` |
| `npm run build` | Build production vào `dist/` |
| `npm run check` | Chạy cả 4 bước trên như CI – **chạy trước khi tạo merge request** |
| `npx vite preview --port 4317` | Xem bản build |

## Biến môi trường

Xem `.env.example`. Chính: `VITE_API_URL` (gốc URL backend), `VITE_AUTH` (`api` mặc định / `off` = demo tĩnh không đăng nhập). `VITE_SENTRY_DSN` bật giám sát lỗi (bỏ trống = tắt). Chỉ biến tiền tố `VITE_` lộ ra trình duyệt – **không đặt bí mật**.

## Test

Chỉ test logic thuần có rủi ro nghiệp vụ / an toàn (chạy trong node, không test giao diện):

| File | Bảo vệ |
|---|---|
| `src/api/client.test.ts` | Gọi API: lỗi theo `code`, timeout, huỷ, refresh 401 một lần, mất phiên, sai hợp đồng |
| `src/lib/createCollectionStore.test.ts` | Store dữ liệu: kết quả cũ về muộn không đè dữ liệu vừa ghi, huỷ lượt cũ |
| `src/features/alerts/workflow.test.ts` · `maintenance/workflow.test.ts` | Quy trình trạng thái cảnh báo / bảo trì chỉ đi tiến, không nhảy bước |
| `src/features/reports/sign.test.ts` | 8 điều kiện ký báo cáo ngày |
| `src/features/live/signal.test.ts` | Quy tắc "Mất tín hiệu" (không hiện số cũ) |
| `src/lib/plantTime.test.ts` | "Hôm nay" theo giờ nhà máy |
| `packages/shared/src/roles.test.ts` | Phân quyền theo vai trò |
| `src/mocks/contracts.test.ts` | Mock khớp hợp đồng dữ liệu dùng chung |

Giao diện: smoke test Playwright `e2e/smoke.spec.ts` (20 test, ~20 s) – 13 trang chính + 390 px + trang 404 không lỗi JS/console, mở drawer / modal theo query, ký báo cáo, CLS trang chi tiết thiết bị < 0,1. Không so pixel. Thêm test mới chỉ khi logic có hậu quả nghiệp vụ nếu sai; đặt cạnh module (`foo.ts` → `foo.test.ts`).

## CI / Deploy

- **GitLab CI** (`.gitlab-ci.yml`): mỗi merge request và nhánh chạy job `verify` (`lint → typecheck → test → build` + kiểm `dist/` không chứa ảnh thiết kế) rồi job `e2e` (Playwright trên đúng `dist/` đó; trace + ảnh lỗi + junit giữ 7 ngày). Image Playwright phải trùng phiên bản `@playwright/test` (ghim 1.64.1). CI chỉ chạy trên gitlab.com – git.tbo.vn chưa có runner nên `workflow.rules` bỏ qua (không tạo pipeline).
- **Deploy**: Vercel (`vercel.json`) build từ repo, bản demo đặt `VITE_AUTH=off`. Header bảo mật (CSP…) khai trong `vercel.json`; bản xem trước của Vite và smoke test dùng cùng bộ header.

## Tài liệu

- `CLAUDE.md` – quy ước bắt buộc (token màu, breakpoint, a11y, gọi API…) + trạng thái hiện tại.
- `GUIDE.md` – mục lục đọc code theo luồng → `docs/guide/<luồng>.md`.
- `docs/decisions.md` (quyết định, nhật ký) · `docs/figma-diffs.md` (sai khác thiết kế) · `docs/questions.md` (câu hỏi chờ designer/khách).
