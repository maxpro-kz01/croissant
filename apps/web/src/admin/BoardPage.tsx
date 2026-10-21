import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { money } from '../i18n';
import type { AdminOrder, OrderStatus, OrderType } from '../types';
import { PAYST_RU, PAY_RU, TYPE_RU, errMsg, fmtTime, useLoad, useStream } from './useStream';

const COLS: { status: OrderStatus; title: string }[] = [
  { status: 'new', title: 'Новые' },
  { status: 'preparing', title: 'Готовятся' },
  { status: 'ready', title: 'Готовы' },
];
const NEXT: Record<string, { to: OrderStatus; label: string }> = {
  new: { to: 'preparing', label: 'Принять' },
  preparing: { to: 'ready', label: 'Готово' },
  ready: { to: 'done', label: 'Выдан' },
};

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* звук недоступен */
  }
}

export function BoardPage() {
  const { data, reload, error } = useLoad<AdminOrder[]>('/api/admin/orders?status=active');
  const [type, setType] = useState<'all' | OrderType>('all');
  const [sound, setSound] = useState(false);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState('');
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const live = useStream(
    useCallback(
      (name, payload) => {
        void reload();
        if (name === 'order.created') {
          if (soundRef.current) beep();
          const id = (payload as { id?: number } | null)?.id;
          if (id) {
            setFresh((s) => new Set(s).add(id));
            setTimeout(() => setFresh((s) => (s.delete(id), new Set(s))), 2500);
          }
        }
      },
      [reload],
    ),
  );

  // Запасной опрос на случай, если соединение SSE оборвалось
  useEffect(() => {
    const id = setInterval(() => void reload(), 30_000);
    return () => clearInterval(id);
  }, [reload]);

  const act = async (fn: () => Promise<unknown>) => {
    setActionError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(errMsg(e));
    }
  };

  const orders = (data ?? []).filter((o) => type === 'all' || o.type === type);

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Заказы</h1>
        <span className="live" data-on={live} title={live ? 'Онлайн' : 'Нет связи, обновляем раз в 30 секунд'} />
        <span className="spacer" />
        <select className="sel" value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Тип заказа">
          <option value="all">Все типы</option>
          <option value="dine_in">В зале</option>
          <option value="delivery">Доставка</option>
          <option value="pickup">Самовывоз</option>
        </select>
        <button className={`btn btn--sm ${sound ? '' : 'btn--ghost'}`} onClick={() => setSound((s) => !s)}>
          {sound ? 'Звук включён' : 'Включить звук'}
        </button>
      </div>
      {(error || actionError) && <p className="err">{actionError || error}</p>}

      <div className="board">
        {COLS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section className="col" key={col.status}>
              <h2>
                {col.title} <span className="col__n">{list.length}</span>
              </h2>
              {list.map((o) => (
                <article key={o.id} className={`ord ${fresh.has(o.id) ? 'ord--fresh' : ''}`}>
                  <div className="ord__head">
                    <span className="ord__num">№{o.number}</span>
                    <span>
                      <span className={`pill pill--${o.type}`}>
                        {TYPE_RU[o.type]}
                        {o.table_number != null && ` · стол ${o.table_number}`}
                      </span>{' '}
                      <span className="ord__meta">{fmtTime(o.created_at)}</span>
                    </span>
                  </div>
                  <ul className="ord__items">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        <b>{i.qty}×</b> {i.name}
                        {(i.modifiers.length > 0 || i.comment) && (
                          <small>{[...i.modifiers.map((m) => m.name), i.comment].filter(Boolean).join(', ')}</small>
                        )}
                      </li>
                    ))}
                  </ul>
                  {o.comment && <p className="ord__meta">💬 {o.comment}</p>}
                  {o.type !== 'dine_in' && (
                    <p className="ord__meta">
                      {o.customer_name && `${o.customer_name} · `}
                      <a href={`tel:${o.phone}`}>{o.phone}</a>
                      {o.address?.street && (
                        <>
                          <br />
                          {o.address.street}, {o.address.house}
                          {o.address.apt && `, кв. ${o.address.apt}`}
                          {o.address.landmark && ` (${o.address.landmark})`}
                        </>
                      )}
                    </p>
                  )}
                  <p className="ord__meta">
                    <b>{money(o.total)}</b> · {PAY_RU[o.payment_method]} · {PAYST_RU[o.payment_status]}
                  </p>
                  <div className="ord__actions">
                    {NEXT[o.status] && (
                      <button className="btn btn--sm btn--berry" onClick={() => act(() => api.patch(`/api/admin/orders/${o.id}/status`, { status: NEXT[o.status].to }))}>
                        {NEXT[o.status].label}
                      </button>
                    )}
                    {o.payment_status !== 'paid' && (
                      <button className="btn btn--sm btn--sun" onClick={() => act(() => api.patch(`/api/admin/orders/${o.id}/payment`, { payment_status: 'paid' }))}>
                        Оплачен
                      </button>
                    )}
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => confirm(`Отменить заказ №${o.number}?`) && act(() => api.patch(`/api/admin/orders/${o.id}/status`, { status: 'cancelled' }))}
                    >
                      Отменить
                    </button>
                  </div>
                </article>
              ))}
              {list.length === 0 && <p className="hint">Пусто</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
