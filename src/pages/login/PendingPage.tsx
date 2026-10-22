import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';

type PendingState = { message?: string; email?: string } | null;

/** /pending – "Đang chờ duyệt": sau khi đăng ký, hoặc khi đăng nhập bị ACCOUNT_PENDING. */
export default function PendingPage() {
  const state = useLocation().state as PendingState;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <AuthLayout>
      <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-fg outline-none">
        Tài khoản đang chờ duyệt
      </h1>
      {state?.message && (
        <p role="status" className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-fg">
          {state.message}
        </p>
      )}
      <p className="text-sm text-fg-secondary">
        {state?.email ? (
          <>
            Tài khoản <span className="font-semibold text-fg">{state.email}</span> cần quản trị viên duyệt.
          </>
        ) : (
          'Tài khoản của bạn cần quản trị viên duyệt.'
        )}{' '}
        Bạn sẽ đăng nhập được sau khi được duyệt.
      </p>
      <Link to="/login" className="text-center text-sm text-accent underline">
        Về trang đăng nhập
      </Link>
    </AuthLayout>
  );
}
