import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';
import { useMenu, useT } from '../hooks';
import { money } from '../i18n';
import { cartSubtotal, useApp } from '../store';
import type { PaymentMethod, PlacedOrder } from '../types';
import { deliveryFee } from './CartSheet';

const ERR_KEYS: Record<string, string> = {
  network: 'err.network',
  closed: 'err.closed',
  min_order: 'err.min_order',
  item_unavailable: 'err.item_unavailable',
  phone_required: 'err.phone_required',
  address_required: 'err.address_required',
  table_unknown: 'err.table_unknown',
  table_required: 'err.table_unknown',
  payment_disabled: 'err.payment_disabled',
};

/** Время «ко времени» (ЧЧ:ММ) → ISO. Если время уже прошло сегодня, берём завтра. */
function toIso(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function CheckoutPage() {
  const t = useT();
  const navigate = useNavigate();
  const { data } = useMenu();
  const { cart, lang, mode, tableCode, tableNumber, clearCart } = useApp();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [house, setHouse] = useState('');
  const [apt, setApt] = useState('');
  const [landmark, setLandmark] = useState('');
  const [comment, setComment] = useState('');
  const [later, setLater] = useState(false);
  const [time, setTime] = useState('');
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // После оформления корзина очищается, но редирект «пустая корзина → меню» тогда не нужен.
  const placed = useRef(false);

  const settings = data?.settings;
  const methods = useMemo(
    () => (['cash', 'card_terminal', 'kaspi', 'online'] as PaymentMethod[]).filter((m) => (settings ? settings.payments[m] : m === 'cash')),
    [settings],
  );
  const chosen = payment && methods.includes(payment) ? payment : methods[0];

  if (cart.length === 0 && !placed.current) return <Navigate to="/" replace />;

  const subtotal = cartSubtotal(cart);
  const fee = mode === 'delivery' && settings ? deliveryFee(subtotal, settings.delivery) : 0;
  const isHome = mode !== 'dine_in';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setError('');
    setBusy(true);
    try {
      const order = await api.post<PlacedOrder>('/api/orders', {
        type: mode,
        table_code: mode === 'dine_in' ? tableCode ?? undefined : undefined,
        customer_name: name.trim(),
        phone: phone.trim(),
        address: mode === 'delivery' ? { street: street.trim(), house: house.trim(), apt: apt.trim(), landmark: landmark.trim() } : undefined,
        comment: comment.trim(),
        payment_method: chosen,
        lang,
        scheduled_for: isHome && later && time ? toIso(time) : undefined,
        items: cart.map((l) => ({ item_id: l.item_id, qty: l.qty, modifier_ids: l.modifier_ids, comment: l.comment })),
      });
      try {
        sessionStorage.setItem(`croissant_order_${order.public_id}`, JSON.stringify({ wa: order.whatsapp.url, pay: order.payment_url }));
      } catch {
        /* sessionStorage недоступен — страница заказа обойдётся без ссылок */
      }
      placed.current = true;
      clearCart();
      if (chosen === 'online' && order.payment_url) {
        const u = new URL(order.payment_url, window.location.origin);
        if (u.pathname.startsWith('/pay/mock/')) navigate(u.pathname + u.search);
        else window.location.href = order.payment_url;
      } else {
        navigate(`/order/${order.public_id}`);
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code ?? '' : '';
      setError(t(ERR_KEYS[code] ?? 'err.generic'));
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="wrap">
        <div className="page__bar">
          <Link to="/" className="back" aria-label="←">
            ←
          </Link>
          <h1>{t('checkout.title')}</h1>
        </div>

        <form onSubmit={submit}>
          <div className="card">
            <h2>{mode === 'dine_in' ? t('checkout.at_table', { n: tableNumber ?? '' }) : t(`mode.${mode}`)}</h2>
            <label className="field">
              <span>{t('checkout.name')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
            </label>
            {isHome && (
              <label className="field">
                <span>{t('checkout.phone')}</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t('checkout.phone_hint')}
                  required
                />
              </label>
            )}
            {mode === 'delivery' && (
              <>
                <div className="row2">
                  <label className="field">
                    <span>{t('checkout.street')}</span>
                    <input value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="address-line1" required />
                  </label>
                  <label className="field">
                    <span>{t('checkout.house')}</span>
                    <input value={house} onChange={(e) => setHouse(e.target.value)} required />
                  </label>
                </div>
                <label className="field">
                  <span>{t('checkout.apt')}</span>
                  <input value={apt} onChange={(e) => setApt(e.target.value)} />
                </label>
                <label className="field">
                  <span>{t('checkout.landmark')}</span>
                  <input value={landmark} onChange={(e) => setLandmark(e.target.value)} />
                </label>
              </>
            )}
            <label className="field">
              <span>{t('checkout.comment')}</span>
              <textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
          </div>

          {isHome && (
            <div className="card">
              <h2>{t('checkout.when')}</h2>
              <div className="seg">
                <button type="button" role="radio" aria-checked={!later} className="opt" onClick={() => setLater(false)}>
                  {t('checkout.asap')}
                </button>
                <button type="button" role="radio" aria-checked={later} className="opt" onClick={() => setLater(true)}>
                  {t('checkout.later')}
                </button>
              </div>
              {later && (
                <label className="field">
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                </label>
              )}
            </div>
          )}

          <div className="card">
            <h2>{t('checkout.payment')}</h2>
            <div className="pays" role="radiogroup">
              {methods.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={chosen === m} className="opt" onClick={() => setPayment(m)}>
                  <span className="opt__dot" />
                  <span className="opt__label">{t(`pay.${m}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="totals" style={{ paddingTop: 0 }}>
              <div>
                <span>{t('sum.items')}</span>
                <span>{money(subtotal)}</span>
              </div>
              {mode === 'delivery' && (
                <div>
                  <span>{t('sum.delivery')}</span>
                  <span>{fee === 0 ? t('sum.free') : money(fee)}</span>
                </div>
              )}
              <div className="grand">
                <span>{t('sum.total')}</span>
                <span>{money(subtotal + fee)}</span>
              </div>
            </div>
          </div>

          {error && (
            <p className="notice notice--err" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn--berry btn--block" style={{ marginTop: 16 }} disabled={busy || !chosen}>
            {busy ? t('checkout.sending') : t('checkout.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
