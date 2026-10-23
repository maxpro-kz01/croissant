import { useEffect, useMemo, useRef, useState } from 'react';
import { HeroBanner } from '../components/HeroBanner';
import { Mark } from '../components/Logo';
import { Link } from 'react-router-dom';

import { useMenu, useT } from '../hooks';
import { money, pick } from '../i18n';
import { cartCount, cartSubtotal, useApp } from '../store';
import type { Category, MenuItem, OrderType } from '../types';
import { CartSheet } from './CartSheet';
import { ItemSheet } from './ItemSheet';

export function MenuPage() {
  const t = useT();
  const { data, error, reload } = useMenu();
  const { lang, setLang, mode, setMode, tableCode, tableNumber, setTable, cart } = useApp();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<number | null>(null);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const sections = useRef<Record<number, HTMLElement | null>>({});

  const settings = data?.settings ?? null;
  const modes = useMemo<OrderType[]>(() => {
    if (tableCode) return ['dine_in'];
    const m: OrderType[] = [];
    if (!settings || settings.delivery.enabled) m.push('delivery');
    if (!settings || settings.pickup_enabled) m.push('pickup');
    return m;
  }, [tableCode, settings]);

  useEffect(() => {
    if (modes.length && !modes.includes(mode)) setMode(modes[0]);
  }, [modes, mode, setMode]);

  const q = query.trim().toLowerCase();
  const categories = useMemo<Category[]>(() => {
    if (!data) return [];
    if (!q) return data.categories;
    return data.categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => [i.name_ru, i.name_kk, i.desc_ru, i.desc_kk].some((s) => s?.toLowerCase().includes(q))),
      }))
      .filter((c) => c.items.length > 0);
  }, [data, q]);

  // Подсветка текущей категории при прокрутке
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(Number((vis.target as HTMLElement).dataset.cat));
      },
      { rootMargin: '-120px 0px -65% 0px' },
    );
    Object.values(sections.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [categories]);

  const popular = useMemo(() => (data ? data.categories.flatMap((c) => c.items).filter((i) => i.popular && i.available) : []), [data]);
  const count = cartCount(cart);

  return (
    <div className="page" style={{ paddingBottom: count ? 100 : 40 }}>
      <header className="hero">
        <div className="wrap">
          <div className="topbar">
            <img className="hero__logo" src="/logo-brand.png" alt="Croissant — cakes and coffee" width={104} height={50} />
            <div className="lang" role="group" aria-label="Language">
              {(['ru', 'kk'] as const).map((l) => (
                <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
                  {t(`lang.${l}`)}
                </button>
              ))}
            </div>
          </div>
          <HeroBanner />
          <div className="hero__body">
            <div>
              <h1 className="hero__title">{t('hero.title')}</h1>
              <p className="hero__sub">{t('hero.sub')}</p>
            </div>
          </div>

          {tableCode ? (
            <div className="table-chip">
              {t('table.n', { n: tableNumber ?? '' })}
              <button onClick={() => setTable(null, null)}>{t('table.not_here')}</button>
            </div>
          ) : (
            modes.length > 1 && (
              <div className="modes" role="group" aria-label={t('checkout.when')}>
                {modes.map((m) => (
                  <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                    {t(`mode.${m}`)}
                  </button>
                ))}
              </div>
            )
          )}

          {data && !data.is_open && (
            <p className="notice">{t('closed', { open: data.settings.hours.open, close: data.settings.hours.close })}</p>
          )}
        </div>
      </header>

      <main className="wrap">
        {error && !data && (
          <p className="notice notice--err">
            {t('err.network')}{' '}
            <button className="btn btn--sm" onClick={reload}>
              ↻
            </button>
          </p>
        )}

        {data && data.banners.length > 0 && !q && (
          <div className="banners" style={{ marginTop: 18 }}>
            {data.banners.map((b) => (
              <article className="banner" key={b.id}>
                <h3>{pick(lang, b, 'title')}</h3>
                {pick(lang, b, 'text') && <p>{pick(lang, b, 'text')}</p>}
              </article>
            ))}
          </div>
        )}
      </main>

      {data && (
        <div className="menu-top" style={{ marginTop: 14 }}>
          <div className="wrap">
            <div className="search">
              <label className="sr" htmlFor="q">
                {t('menu.search')}
              </label>
              <input id="q" type="search" placeholder={t('menu.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <nav className="chips" aria-label="Categories">
              {data.categories.map((c) => (
                <button
                  key={c.id}
                  className="chip"
                  aria-current={active === c.id}
                  onClick={() => sections.current[c.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {pick(lang, c, 'name')}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="wrap">
        {!q && popular.length > 0 && (
          <section className="section" style={{ scrollMarginTop: 120 }}>
            <h2>{t('menu.popular')}</h2>
            <div className="items">
              {popular.slice(0, 3).map((i) => (
                <ItemCard key={`p${i.id}`} item={i} onOpen={setItem} />
              ))}
            </div>
          </section>
        )}

        {categories.map((c) => (
          <section className="section" key={c.id} data-cat={c.id} ref={(el) => void (sections.current[c.id] = el)}>
            <h2>{pick(lang, c, 'name')}</h2>
            <div className="items">
              {c.items.map((i) => (
                <ItemCard key={i.id} item={i} onOpen={setItem} />
              ))}
            </div>
          </section>
        ))}

        {data && categories.length === 0 && <p className="empty">{t('menu.nothing')}</p>}

        {data?.settings.brand.instagram && (
          <p className="hint" style={{ textAlign: 'center', marginTop: 40 }}>
            <a href={`https://instagram.com/${data.settings.brand.instagram}`} target="_blank" rel="noreferrer">
              @{data.settings.brand.instagram}
            </a>
            {data.settings.brand.address && ` · ${data.settings.brand.address}`}
            {' · '}
            <Link to="/admin">·</Link>
          </p>
        )}
      </main>

      {count > 0 && (
        <button key={count} className="cartbar bump" onClick={() => setCartOpen(true)}>
          <span>
            <span className="cartbar__count">{count}</span>
            {t('cart.open')}
          </span>
          <span className="cartbar__go">{money(cartSubtotal(cart))}</span>
        </button>
      )}

      <ItemSheet item={item} onClose={() => setItem(null)} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} settings={settings} />
    </div>
  );
}

function ItemCard({ item, onOpen }: { item: MenuItem; onOpen: (i: MenuItem) => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  return (
    <button className={`item ${item.available ? '' : 'item--off'}`} disabled={!item.available} onClick={() => onOpen(item)}>
      <div className="item__pic">
        {item.image_url ? <img src={item.image_url} alt="" loading="lazy" /> : <Mark />}
        {item.popular && item.available && <span className="item__star">★</span>}
      </div>
      <div className="item__text">
        <div className="item__name">{pick(lang, item, 'name')}</div>
        {pick(lang, item, 'desc') && <p className="item__desc">{pick(lang, item, 'desc')}</p>}
        <div className="item__meta">
          <span className="price">{money(item.price)}</span>
          {!item.available && <span className="tag tag--berry">{t('item.unavailable')}</span>}
          {item.available && <span className="item__plus">+</span>}
        </div>
      </div>
    </button>
  );
}
