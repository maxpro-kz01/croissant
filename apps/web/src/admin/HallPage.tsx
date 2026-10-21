import { useCallback, useEffect } from 'react';
import { money } from '../i18n';
import type { AdminOrder } from '../types';
import { fmtTime, useLoad, useStream } from './useStream';

interface HallTable {
  id: number;
  number: number;
  label: string;
  busy: boolean;
  total: number;
  orders: AdminOrder[];
}

const ST_RU = { new: 'новый', preparing: 'готовится', ready: 'готов', done: 'выдан', cancelled: 'отмена' } as const;

/** Какие столы сейчас что-то заказали. Только для сотрудников — гости эту страницу не видят. */
export function HallPage() {
  const { data, reload, error } = useLoad<HallTable[]>('/api/admin/hall');
  const live = useStream(useCallback(() => void reload(), [reload]));
  useEffect(() => {
    const id = setInterval(() => void reload(), 30_000);
    return () => clearInterval(id);
  }, [reload]);

  const busy = (data ?? []).filter((t) => t.busy).length;

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Зал</h1>
        <span className="live" data-on={live} />
        <span className="hint">Заняты столы: {busy} из {data?.length ?? 0}</span>
      </div>
      {error && <p className="err">{error}</p>}
      {data && data.length === 0 && <p className="hint">Столов пока нет. Добавьте их в разделе «Столы и QR».</p>}
      <div className="hall">
        {(data ?? []).map((t) => (
          <article key={t.id} className={`tbl ${t.busy ? 'tbl--busy' : ''}`}>
            <div className="tbl__n">{t.number}</div>
            {t.label && <span className="hint">{t.label}</span>}
            {t.busy ? (
              <>
                <b>{money(t.total)}</b>
                <ul>
                  {t.orders.map((o) => (
                    <li key={o.id}>
                      №{o.number} · {ST_RU[o.status]} · {fmtTime(o.created_at)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <span className="hint">Свободен</span>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
