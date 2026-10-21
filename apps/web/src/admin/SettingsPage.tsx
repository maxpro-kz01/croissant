import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { errMsg, useLoad } from './useStream';

interface S {
  brand: { name: string; instagram: string; address: string; phone: string };
  whatsapp_phone: string;
  hours: { enabled: boolean; open: string; close: string; tz: string };
  delivery: { enabled: boolean; fee: number; free_from: number; min_order: number };
  pickup_enabled: boolean;
  payments: { cash: boolean; card_terminal: boolean; kaspi: boolean; online: boolean };
  kaspi_link: string;
}
interface U {
  id: number;
  username: string;
  role: 'admin' | 'staff';
}

const PAY_LABEL = { cash: 'Наличные', card_terminal: 'Карта на месте', kaspi: 'Kaspi', online: 'Онлайн-оплата' } as const;

export function SettingsPage() {
  const { data, reload } = useLoad<S>('/api/admin/settings');
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setError('');
    setMsg('');
    try {
      await api.put('/api/admin/settings', s);
      await reload();
      setMsg('Сохранено');
    } catch (err) {
      setError(errMsg(err));
    }
  };

  if (!s) return null;
  const up = <K extends keyof S>(k: K, patch: Partial<S[K]> | S[K]) =>
    setS((x) => (x ? { ...x, [k]: typeof patch === 'object' && patch !== null ? { ...(x[k] as object), ...patch } : patch } : x));
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  return (
    <>
      <h1>Настройки</h1>
      <form onSubmit={save}>
        <section className="panel">
          <h2>Заведение</h2>
          <div className="grid2">
            <label className="field">
              <span>Название</span>
              <input value={s.brand.name} onChange={(e) => up('brand', { name: e.target.value })} />
            </label>
            <label className="field">
              <span>Instagram (без @)</span>
              <input value={s.brand.instagram} onChange={(e) => up('brand', { instagram: e.target.value })} />
            </label>
            <label className="field">
              <span>Адрес</span>
              <input value={s.brand.address} onChange={(e) => up('brand', { address: e.target.value })} />
            </label>
            <label className="field">
              <span>Телефон</span>
              <input value={s.brand.phone} onChange={(e) => up('brand', { phone: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>WhatsApp для заказов</h2>
          <label className="field">
            <span>Номер: только цифры, с кодом страны (например 77011234567)</span>
            <input value={s.whatsapp_phone} onChange={(e) => up('whatsapp_phone', e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
          </label>
          <p className="hint">Гость после заказа нажимает кнопку, и текст заказа открывается в WhatsApp на этот номер. Основной список заказов — вкладка «Заказы».</p>
        </section>

        <section className="panel">
          <h2>Часы работы</h2>
          <label className="check">
            <input type="checkbox" checked={s.hours.enabled} onChange={(e) => up('hours', { enabled: e.target.checked })} /> Принимать заказы только в рабочие часы
          </label>
          <div className="grid2">
            <label className="field">
              <span>Открытие</span>
              <input type="time" value={s.hours.open} onChange={(e) => up('hours', { open: e.target.value })} />
            </label>
            <label className="field">
              <span>Закрытие</span>
              <input type="time" value={s.hours.close} onChange={(e) => up('hours', { close: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Доставка и самовывоз</h2>
          <label className="check">
            <input type="checkbox" checked={s.delivery.enabled} onChange={(e) => up('delivery', { enabled: e.target.checked })} /> Доставка включена
          </label>
          <label className="check">
            <input type="checkbox" checked={s.pickup_enabled} onChange={(e) => up('pickup_enabled', e.target.checked)} /> Самовывоз включён
          </label>
          <div className="grid2">
            <label className="field">
              <span>Стоимость доставки, ₸</span>
              <input type="number" min={0} value={s.delivery.fee} onChange={(e) => up('delivery', { fee: num(e.target.value) })} />
            </label>
            <label className="field">
              <span>Бесплатно от суммы, ₸ (0 — всегда платно)</span>
              <input type="number" min={0} value={s.delivery.free_from} onChange={(e) => up('delivery', { free_from: num(e.target.value) })} />
            </label>
            <label className="field">
              <span>Минимальный заказ, ₸</span>
              <input type="number" min={0} value={s.delivery.min_order} onChange={(e) => up('delivery', { min_order: num(e.target.value) })} />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Способы оплаты</h2>
          {(Object.keys(PAY_LABEL) as (keyof typeof PAY_LABEL)[]).map((k) => (
            <label className="check" key={k}>
              <input type="checkbox" checked={s.payments[k]} onChange={(e) => up('payments', { [k]: e.target.checked })} /> {PAY_LABEL[k]}
            </label>
          ))}
          <label className="field">
            <span>Ссылка Kaspi (если есть — гость увидит кнопку оплаты)</span>
            <input value={s.kaspi_link} onChange={(e) => up('kaspi_link', e.target.value)} placeholder="https://pay.kaspi.kz/…" />
          </label>
        </section>

        {error && <p className="err">{error}</p>}
        {msg && <p style={{ color: 'var(--ok)', fontWeight: 700 }}>{msg}</p>}
        <button className="btn btn--berry">Сохранить настройки</button>
      </form>

      <Users />
    </>
  );
}

function Users() {
  const { data, reload } = useLoad<U[]>('/api/admin/users');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [error, setError] = useState('');

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/admin/users', { username: username.trim(), password, role });
      setUsername('');
      setPassword('');
      await reload();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <section className="panel" style={{ marginTop: 14 }}>
      <h2>Сотрудники</h2>
      {(data ?? []).map((u) => (
        <div className="row-item" key={u.id}>
          <span className="grow">
            <b>{u.username}</b> <span className="pill">{u.role === 'admin' ? 'админ' : 'сотрудник'}</span>
          </span>
          <button
            className="btn btn--sm btn--ghost"
            onClick={async () => {
              if (!confirm(`Удалить доступ ${u.username}?`)) return;
              try {
                await api.del(`/api/admin/users/${u.id}`);
                await reload();
              } catch (err) {
                setError(errMsg(err));
              }
            }}
          >
            Удалить
          </button>
        </div>
      ))}
      <form className="toolbar" style={{ marginTop: 12 }} onSubmit={add}>
        <input className="sel" placeholder="Логин (от 3 символов)" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
        <input className="sel" type="password" placeholder="Пароль (от 8 символов)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        <select className="sel" value={role} onChange={(e) => setRole(e.target.value as 'staff' | 'admin')}>
          <option value="staff">Сотрудник</option>
          <option value="admin">Админ</option>
        </select>
        <button className="btn btn--sm">Добавить</button>
      </form>
      {error && <p className="err">{error}</p>}
    </section>
  );
}
