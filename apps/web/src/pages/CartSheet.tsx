import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { useT } from '../hooks';
import { money } from '../i18n';
import { cartSubtotal, useApp } from '../store';
import type { PublicSettings } from '../types';

export function deliveryFee(subtotal: number, s: PublicSettings['delivery']) {
  return s.free_from > 0 && subtotal >= s.free_from ? 0 : s.fee;
}

export function CartSheet({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: PublicSettings | null }) {
  const t = useT();
  const navigate = useNavigate();
  const { cart, lang, mode, changeQty, clearCart } = useApp();
  const subtotal = cartSubtotal(cart);
  const fee = mode === 'delivery' && settings ? deliveryFee(subtotal, settings.delivery) : 0;
  const minOrder = mode === 'delivery' && settings ? settings.delivery.min_order : 0;
  const tooLow = mode === 'delivery' && subtotal < minOrder;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('cart.title')}
      footer={
        cart.length > 0 && (
          <>
            {tooLow && <p className="notice notice--err" style={{ margin: '0 0 10px' }}>{t('checkout.min_order', { sum: money(minOrder) })}</p>}
            <button
              type="button"
              className="btn btn--berry btn--block"
              disabled={tooLow}
              onClick={() => {
                onClose();
                navigate('/checkout');
              }}
            >
              {t('checkout.title')} · {money(subtotal + fee)}
            </button>
          </>
        )
      }
    >
      {cart.length === 0 ? (
        <p className="empty">{t('cart.empty')}</p>
      ) : (
        <>
          {cart.map((l) => {
            const mods = (lang === 'kk' ? l.modifier_names_kk : l.modifier_names_ru).join(', ');
            return (
              <div className="line" key={l.key}>
                <div>
                  <div className="line__name">{lang === 'kk' ? l.name_kk : l.name_ru}</div>
                </div>
                <div className="line__sum">{money(l.unit_price * l.qty)}</div>
                <div className="line__mods">{[mods, l.comment].filter(Boolean).join(' · ')}</div>
                <Stepper value={l.qty} onChange={(n) => changeQty(l.key, n - l.qty)} label={l.name_ru} />
              </div>
            );
          })}
          <div className="totals">
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
            {mode === 'delivery' && settings && settings.delivery.free_from > 0 && fee > 0 && (
              <p className="hint">{t('checkout.free_from', { sum: money(settings.delivery.free_from) })}</p>
            )}
          </div>
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 14 }} onClick={clearCart}>
            {t('cart.clear')}
          </button>
        </>
      )}
    </Sheet>
  );
}
