import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../api';
import { Mark } from '../components/Logo';
import { useT } from '../hooks';
import { money } from '../i18n';
import type { OrderStatus, OrderStatusView } from '../types';

const STEPS: OrderStatus[] = ['new', 'preparing', 'ready', 'done'];

export function OrderPage() {
  const { id = '' } = useParams();
  const t = useT();
  const [order, setOrder] = useState<OrderStatusView | null>(null);
  const [missing, setMissing] = useState(false);

  const links = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`croissant_order_${id}`) ?? 'null') as { wa?: string; pay?: string | null } | null;
    } catch {
      return null;
    }
  }, [id]);

  // Статус обновляем каждые 5 секунд, пока заказ не завершён.
  useEffect(() => {
    let stop = false;
    const load = () =>
      api
        .get<OrderStatusView>(`/api/orders/${encodeURIComponent(id)}`)
        .then((o) => !stop && setOrder(o))
        .catch((e) => e instanceof ApiError && e.status === 404 && !stop && setMissing(true));
    load();
    const timer = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [id]);

  if (missing)
    return (
      <div className="page wrap">
        <p className="empty">{t('order.not_found')}</p>
        <Link className="btn btn--block" to="/">
          {t('order.new_order')}
        </Link>
      </div>
    );
  if (!order) return null;

  const stepIdx = STEPS.indexOf(order.status);
  const cancelled = order.status === 'cancelled';
  const payBadge = order.payment_status === 'paid' ? 'ok' : order.payment_status === 'failed' ? 'bad' : 'warn';

  return (
    <div className="page">
      <div className="wrap">
        <div className="done">
          <Mark animate />
          <h1>{t('order.accepted')}</h1>
          <div className="done__num">№{order.number}</div>
          {order.table_number != null && <p className="hint" style={{ marginTop: 6 }}>{t('table.n', { n: order.table_number })}</p>}
        </div>

        {cancelled ? (
          <p className="notice notice--err" style={{ textAlign: 'center' }}>
            {t('status.cancelled')}
          </p>
        ) : (
          <div className="track" aria-label={t(`status.${order.status}`)}>
            {STEPS.map((s, i) => (
              <div key={s} className="track__step" data-on={i <= stepIdx} data-now={i === stepIdx && s !== 'done'}>
                {t(`status.${s}`)}
              </div>
            ))}
          </div>
        )}

        {links?.wa && !cancelled && (
          <div className="card">
            <p style={{ marginBottom: 12 }}>{t('order.send_wa_hint')}</p>
            <a className="btn btn--berry btn--block" href={links.wa} target="_blank" rel="noreferrer">
              {t('order.send_wa')}
            </a>
          </div>
        )}

        <div className="card">
          <ul className="list-plain">
            {order.items.map((i, n) => (
              <li key={n} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{i.name}</span>
                <span>× {i.qty}</span>
              </li>
            ))}
          </ul>
          <div className="totals">
            <div className="grand">
              <span>{t('sum.total')}</span>
              <span>{money(order.total)}</span>
            </div>
            <div>
              <span className={`badge badge--${payBadge}`}>{t(`pay.status.${order.payment_status}`)}</span>
            </div>
          </div>
          {links?.pay && order.payment_status !== 'paid' && !cancelled && (
            <a className="btn btn--sun btn--block" style={{ marginTop: 12 }} href={links.pay}>
              {t('pay.now')}
            </a>
          )}
        </div>

        <Link className="btn btn--ghost btn--block" style={{ marginTop: 16 }} to="/">
          {t('order.new_order')}
        </Link>
      </div>
    </div>
  );
}
