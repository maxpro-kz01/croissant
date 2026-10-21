import { useMemo, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { useT } from '../hooks';
import { money, pick } from '../i18n';
import { useApp } from '../store';
import type { MenuItem } from '../types';

export function ItemSheet({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  return (
    <Sheet open={!!item} onClose={onClose} title={item ? pickName(item) : ''} footer={null}>
      {item && <ItemBody key={item.id} item={item} onClose={onClose} />}
    </Sheet>
  );
}

function pickName(item: MenuItem) {
  return useApp.getState().lang === 'kk' && item.name_kk ? item.name_kk : item.name_ru;
}

function ItemBody({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const addLine = useApp((s) => s.addLine);
  const [qty, setQty] = useState(1);
  const [comment, setComment] = useState('');
  // Для обязательных групп с одним выбором заранее отмечаем первый вариант.
  const [chosen, setChosen] = useState<Record<number, number[]>>(() =>
    Object.fromEntries(item.groups.filter((g) => g.required && !g.multi && g.modifiers[0]).map((g) => [g.id, [g.modifiers[0].id]])),
  );

  const picked = useMemo(
    () => item.groups.flatMap((g) => g.modifiers.filter((m) => (chosen[g.id] ?? []).includes(m.id))),
    [item.groups, chosen],
  );
  const unit = item.price + picked.reduce((s, m) => s + m.price_delta, 0);
  const missing = item.groups.some((g) => g.required && (chosen[g.id] ?? []).length === 0);

  const toggle = (gid: number, mid: number, multi: boolean) =>
    setChosen((c) => {
      const cur = c[gid] ?? [];
      if (!multi) return { ...c, [gid]: cur.includes(mid) ? [] : [mid] };
      return { ...c, [gid]: cur.includes(mid) ? cur.filter((x) => x !== mid) : [...cur, mid] };
    });

  const add = () => {
    addLine({
      item_id: item.id,
      name_ru: item.name_ru,
      name_kk: item.name_kk || item.name_ru,
      unit_price: unit,
      qty,
      modifier_ids: picked.map((m) => m.id),
      modifier_names_ru: picked.map((m) => m.name_ru),
      modifier_names_kk: picked.map((m) => m.name_kk || m.name_ru),
      comment: comment.trim(),
    });
    onClose();
  };

  return (
    <>
      {item.image_url && <img src={item.image_url} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 12 }} />}
      {pick(lang, item, 'desc') && <p style={{ color: 'var(--ink-soft)' }}>{pick(lang, item, 'desc')}</p>}
      {item.weight && <p className="hint" style={{ marginTop: 6 }}>{item.weight}</p>}

      {item.groups.map((g) => (
        <div className="group" key={g.id} role={g.multi ? 'group' : 'radiogroup'} aria-label={pick(lang, g, 'name')}>
          <h3>
            {pick(lang, g, 'name')}
            <small>{g.required ? t('item.required') : g.multi ? t('item.multi') : ''}</small>
          </h3>
          {g.modifiers.map((m) => {
            const on = (chosen[g.id] ?? []).includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                role={g.multi ? 'checkbox' : 'radio'}
                aria-checked={on}
                className={`opt ${g.multi ? 'opt--multi' : ''}`}
                onClick={() => toggle(g.id, m.id, g.multi)}
              >
                <span className="opt__dot" />
                <span className="opt__label">{pick(lang, m, 'name')}</span>
                {m.price_delta !== 0 && (
                  <span className="opt__delta">
                    {m.price_delta > 0 ? '+' : '−'}
                    {money(Math.abs(m.price_delta))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <textarea
        className="textarea"
        rows={2}
        maxLength={200}
        placeholder={t('item.comment')}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <div className="foot-row" style={{ marginTop: 20 }}>
        <Stepper value={qty} min={1} onChange={setQty} label={String(qty)} />
        <button type="button" className="btn btn--berry" disabled={missing} onClick={add}>
          {t('item.add_for', { sum: money(unit * qty) })}
        </button>
      </div>
    </>
  );
}
