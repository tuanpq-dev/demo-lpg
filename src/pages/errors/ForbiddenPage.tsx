import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { useAuth } from '@/app/auth';
import { ROLE_LABELS } from '@/features/auth/permissions';
import { StatusLayout } from './StatusLayout';

export type ForbiddenPageProps = {
  /** Tên chức năng bị chặn, vd "Scene Editor". */
  feature?: string;
  withHeader?: boolean;
};

/** 403 "Không có quyền truy cập": route cần quyền mà vai trò hiện tại không có, hoặc API trả FORBIDDEN. */
export default function ForbiddenPage({ feature, withHeader }: ForbiddenPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user ? ROLE_LABELS[user.role] : undefined;
  return (
    <StatusLayout
      code="403"
      title="Không có quyền truy cập"
      heading={feature ? `Bạn không được mở ${feature}` : 'Bạn không được mở trang này'}
      withHeader={withHeader}
      message={
        <>
          {role ? (
            <>
              Vai trò hiện tại của bạn là <strong className="text-fg">{role}</strong>.{' '}
            </>
          ) : null}
          Liên hệ quản trị viên nếu bạn cần quyền này.
        </>
      }
      actions={
        <Button variant="primary" onClick={() => void navigate('/overview')}>
          Về Tổng quan
        </Button>
      }
    />
  );
}
