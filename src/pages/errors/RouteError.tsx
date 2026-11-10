import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { isChunkLoadError, reloadForNewVersion } from '@/lib/chunkReload';
import ForbiddenPage from './ForbiddenPage';
import NotFoundPage from './NotFoundPage';
import ServerErrorPage from './ServerErrorPage';

/**
 * `errorElement` của router: lỗi ném khi render / trong loader của route con.
 * - 403 / 404 (Response của loader hoặc ApiError FORBIDDEN / NOT_FOUND) → trang tương ứng.
 * - Lỗi tải chunk sau khi deploy bản mới → tải lại trang một lần.
 * - Còn lại → 500.
 * `withHeader = false` ở tầng gốc (lỗi có thể nằm ở chính header).
 */
export default function RouteError({ withHeader = true }: { withHeader?: boolean }) {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : error instanceof ApiError ? error.status : 0;
  if (status === 403) return <ForbiddenPage withHeader={withHeader} />;
  if (status === 404) return <NotFoundPage withHeader={withHeader} />;
  if (isChunkLoadError(error) && reloadForNewVersion()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-app text-sm text-fg-muted" aria-busy="true">
        Đang tải phiên bản mới…
      </div>
    );
  }
  if (import.meta.env.DEV) console.error(error);
  return <ServerErrorPage error={error} withHeader={withHeader} />;
}
