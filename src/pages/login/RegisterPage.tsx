import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, TextField } from '@/components';
import { useAuth } from '@/app/auth';
import { authErrorMessage } from '@/features/auth/errors';
import { AuthLayout, formErrorClass } from './AuthLayout';

/**
 * /register – POST /auth/register {email,name,password} → 201 {message} → màn "Đang chờ duyệt".
 * Luật mật khẩu/email do backend kiểm tra (VALIDATION_ERROR → hiện nguyên thông báo của backend).
 */
export default function RegisterPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (status === 'authenticated') return <Navigate to="/overview" replace />;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Nhập đủ họ tên, email và mật khẩu');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate('/pending', { replace: true, state: { message, email: form.email.trim() } });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="register-title" className="flex flex-col gap-4">
        <div>
          <h1 id="register-title" className="text-xl font-semibold text-fg">
            Đăng ký tài khoản
          </h1>
          <p className="mt-1 text-sm text-fg-muted">Tài khoản mới cần quản trị viên duyệt trước khi đăng nhập.</p>
        </div>
        {error && (
          <p ref={errorRef} role="alert" tabIndex={-1} className={formErrorClass}>
            {error}
          </p>
        )}
        <TextField label="Họ tên" name="name" autoComplete="name" required value={form.name} onChange={set('name')} />
        <TextField label="Email" type="email" name="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <TextField
          label="Mật khẩu"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
        />
        <Button type="submit" variant="primary" disabled={busy} className="mt-2 h-10">
          {busy ? 'Đang gửi…' : 'Đăng ký'}
        </Button>
        <p className="text-center text-sm text-fg-muted">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-accent underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
