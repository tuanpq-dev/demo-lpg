import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Icon, TextField } from '@/components';
import { useAuth } from '@/app/auth';
import { AuthError } from '@/data/auth';
import { safeRedirect } from '@/features/auth/session';

function lockMessage(err: AuthError): string {
  if (!err.retryAfter) return err.message;
  const minutes = Math.ceil(err.retryAfter / 60);
  return `${err.message} (khoảng ${minutes} phút)`;
}

/**
 * /login – chưa có thiết kế Figma, dựng theo token (logo + thẻ form giữa màn hình).
 * Thông báo lỗi không phân biệt "sai email" và "sai mật khẩu" (backend trả cùng một câu).
 */
export default function LoginPage() {
  const { status, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeRedirect(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Vào trang → focus ô email (effect thay cho autoFocus – quy ước a11y của dự án).
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  }, []);

  // Lỗi mới → đưa focus tới thông báo (trình đọc màn hình đọc ngay, role="alert").
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (status === 'authenticated' && !busy) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setPassword('');
      setError(err instanceof AuthError ? (err.kind === 'locked' ? lockMessage(err) : err.message) : 'Đăng nhập thất bại');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-app px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
            <Icon name="logo" box={20} />
          </span>
          <div className="flex flex-col">
            <span className="text-lg text-fg">Plant Control</span>
            <span className="text-2xs text-fg-muted">Operational Intelligence</span>
          </div>
        </div>
        <form
          ref={formRef}
          onSubmit={submit}
          noValidate
          aria-labelledby="login-title"
          className="flex flex-col gap-4 rounded-xl border border-line-card bg-surface p-6 shadow-card"
        >
          <div>
            <h1 id="login-title" className="text-xl font-semibold text-fg">
              Đăng nhập
            </h1>
            <p className="mt-1 text-sm text-fg-muted">Dùng tài khoản được quản trị viên cấp.</p>
          </div>
          {error && (
            <p
              ref={errorRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md border border-danger-strong/50 bg-danger/10 px-3 py-2 text-sm text-fg"
            >
              {error}
            </p>
          )}
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={setEmail}
          />
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
        </form>
      </div>
    </main>
  );
}
