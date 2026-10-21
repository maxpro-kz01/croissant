import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Mark } from '../components/Logo';
import { useT } from '../hooks';
import { money } from '../i18n';
import type { OrderStatusView } from '../types';

/** Тестовая страница оплаты: работает только при PAYMENT_PROVIDER=mock. Деньги не списываются. */
export function MockPayPage() {
  const { externalId = '' } = useParams();
  const [params] = useSearchParams();
  const orderId = params.get('order') ?? '';
  const t = useT();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderStatusView | null>(null);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (orderId) api.get<OrderStatusView>(`/api/orders/${encodeURIComponent(orderId)}`).then(setOrder).catch(() => setFailed(true));
  }, [orderId]);

  const pay = async () => {
    setBusy(true);
    try {
      await api.post(`/api/payments/mock/${encodeURIComponent(externalId)}/confirm`);
      setPaid(true);
      setTimeout(() => navigate(`/order/${orderId}`, { replace: true }), 1200);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="page wrap">
      <div className="done">
        <Mark animate={paid} />
        <h1>{t('mock.title')}</h1>
        <p className="hint" style={{ marginTop: 8 }}>
          {t('mock.text')}
        </p>
      </div>
      <div className="card">
        {paid ? (
          <p>{t('mock.done')}</p>
        ) : (
          <>
            {order && <div className="done__num" style={{ fontSize: 40, marginBottom: 14 }}>{money(order.total)}</div>}
            {failed && <p className="notice notice--err">{t('err.generic')}</p>}
            <button className="btn btn--berry btn--block" disabled={busy || !order} onClick={pay}>
              {order ? t('mock.pay', { sum: money(order.total) }) : '…'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
