import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, TextField } from '@/components';
import { useAuth } from '@/app/auth';
import { ApiError } from '@/api/client';
import { authErrorMessage } from '@/features/auth/errors';
import { safeRedirect } from '@/features/auth/session';
import { AuthLayout, formErrorClass } from './AuthLayout';

/**
 * /login – lỗi hiển thị theo mã (sai mật khẩu, chờ duyệt, quá nhiều lần thử, không kết nối được máy chủ…).
 * Đăng nhập xong quay lại trang định vào (`?next=`, chỉ đường dẫn nội bộ).
 */
export default function LoginPage() {
  const { status, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeRedirect(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ text: string; pending: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Vào trang → focus ô email (effect thay cho autoFocus – quy ước a11y của dự án).
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  }, []);
  // Lỗi mới → focus thông báo (role="alert" để trình đọc màn hình đọc ngay).
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (status === 'authenticated' && !busy) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError({ text: 'Nhập email và mật khẩu', pending: false });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
      navigate(next, { replace: true });
    } catch (err) {
      setPassword('');
      setError({ text: authErrorMessage(err), pending: err instanceof ApiError && err.code === 'ACCOUNT_PENDING' });
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="login-title" className="flex flex-col gap-4">
        <div>
          <h1 id="login-title" className="text-xl font-semibold text-fg">
            Đăng nhập
          </h1>
          <p className="mt-1 text-sm text-fg-muted">Dùng tài khoản đã được quản trị viên duyệt.</p>
        </div>
        {error && (
          <div ref={errorRef} role="alert" tabIndex={-1} className={formErrorClass}>
            {error.text}
            {error.pending && (
              <>
                {' '}
                <Link to="/pending" className="text-accent underline">
                  Xem trạng thái
                </Link>
              </>
            )}
          </div>
        )}
        <TextField label="Email" type="email" name="email" autoComplete="username" required value={email} onChange={setEmail} />
        <TextField
          label="Mật khẩu"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />
        <Button type="submit" variant="primary" disabled={busy} className="mt-2 h-10">
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </Button>
        <p className="text-center text-sm text-fg-muted">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-accent underline">
            Đăng ký
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
