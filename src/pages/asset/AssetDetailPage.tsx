import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_ASSET_ID, assetPath } from '@/app/assetRoutes';
import { Button } from '@/components';
import { ASSET_IDS, resolveAssetId } from '@/data/assetDetail';
import NotFoundPage from '../errors/NotFoundPage';
import { AssetDetail } from './detail/AssetDetail';

/**
 * Route `/map/:assetId` (tab "Bản đồ nội khu"; `/map` mở V-101): chuẩn hoá mã trước khi tải trang.
 * - khác kiểu chữ (`/map/v-101`) → chuyển sang mã chuẩn `/map/V-101` (giữ query);
 * - không có trang → "Không tìm thấy tài sản".
 */
export default function AssetDetailRoute() {
  const { assetId: raw = '' } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const id = resolveAssetId(raw);
  if (!id) {
    return (
      <NotFoundPage
        title="Không tìm thấy tài sản"
        breadcrumb={[{ label: 'Bản đồ nội khu' }, { label: raw || '—' }]}
        message={
          <>
            Không có tài sản <code className="font-mono text-fg">{raw}</code>. Tài sản có trang chi tiết: {ASSET_IDS.join(', ')}.
          </>
        }
        actions={<Button onClick={() => void navigate(assetPath(DEFAULT_ASSET_ID))}>Mở {DEFAULT_ASSET_ID}</Button>}
      />
    );
  }
  if (id !== raw) return <Navigate to={`${assetPath(id)}${search}`} replace />;
  return <AssetDetail assetId={id} />;
}
