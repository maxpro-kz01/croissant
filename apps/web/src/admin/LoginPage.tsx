import { useState, type FormEvent } from 'react';
import { ApiError, api, auth } from '../api';
import { Mark } from '../components/Logo';

export interface AdminUser {
  id: number;
  username: string;
  role: 'admin' | 'staff';
}

export function LoginPage({ onLogin }: { onLogin: (u: AdminUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ token: string; user: AdminUser }>('/api/auth/login', { username: username.trim(), password });
      auth.set(r.token);
      onLogin(r.user);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Неверный логин или пароль' : err instanceof ApiError && err.status === 429 ? 'Слишком много попыток. Подождите минуту.' : 'Не удалось войти. Проверьте связь.');
      setBusy(false);
    }
  };

  return (
    <div className="login adm">
      <form onSubmit={submit}>
        <div style={{ textAlign: 'center' }}>
          <Mark size={84} animate />
          <h1 style={{ margin: '4px 0 12px' }}>Вход для сотрудников</h1>
        </div>
        <label className="field">
          <span>Логин</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn btn--berry btn--block" style={{ marginTop: 12 }} disabled={busy}>
          Войти
        </button>
      </form>
    </div>
  );
}
