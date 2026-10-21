import { useState } from 'react';
import { api } from '../api';
import { money } from '../i18n';
import type { Banner, Category, MenuItem } from '../types';
import { errMsg, useLoad } from './useStream';

interface ModDraft {
  name_ru: string;
  name_kk: string;
  price_delta: number;
}
interface GroupDraft {
  name_ru: string;
  name_kk: string;
  required: boolean;
  multi: boolean;
  modifiers: ModDraft[];
}
interface ItemDraft {
  id?: number;
  category_id: number;
  name_ru: string;
  name_kk: string;
  desc_ru: string;
  desc_kk: string;
  price: number;
  weight: string;
  image_url: string;
  available: boolean;
  popular: boolean;
  sort: number;
  groups: GroupDraft[];
}

const blankItem = (category_id: number): ItemDraft => ({
  category_id,
  name_ru: '',
  name_kk: '',
  desc_ru: '',
  desc_kk: '',
  price: 0,
  weight: '',
  image_url: '',
  available: true,
  popular: false,
  sort: 0,
  groups: [],
});

const toDraft = (i: MenuItem): ItemDraft => ({
  id: i.id,
  category_id: i.category_id,
  name_ru: i.name_ru,
  name_kk: i.name_kk,
  desc_ru: i.desc_ru,
  desc_kk: i.desc_kk,
  price: i.price,
  weight: i.weight,
  image_url: i.image_url,
  available: i.available,
  popular: i.popular,
  sort: i.sort,
  groups: i.groups.map((g) => ({
    name_ru: g.name_ru,
    name_kk: g.name_kk,
    required: g.required,
    multi: g.multi,
    modifiers: g.modifiers.map((m) => ({ name_ru: m.name_ru, name_kk: m.name_kk, price_delta: m.price_delta })),
  })),
});

export function MenuEditorPage() {
  const menu = useLoad<{ categories: Category[] }>('/api/admin/menu');
  const banners = useLoad<Banner[]>('/api/admin/banners');
  const [editing, setEditing] = useState<ItemDraft | null>(null);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setError('');
    try {
      await fn();
      await menu.reload();
      await banners.reload();
      after?.();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const addCategory = () => {
    const name = prompt('Название категории (по-русски)');
    if (!name?.trim()) return;
    const kk = prompt('Название по-казахски (можно пропустить)') ?? '';
    void run(() => api.post('/api/admin/categories', { name_ru: name.trim(), name_kk: kk.trim(), sort: (menu.data?.categories.length ?? 0) * 10 }));
  };

  const editCategory = (c: Category) => {
    const name = prompt('Название по-русски', c.name_ru);
    if (!name?.trim()) return;
    const kk = prompt('Название по-казахски', c.name_kk) ?? c.name_kk;
    void run(() => api.put(`/api/admin/categories/${c.id}`, { name_ru: name.trim(), name_kk: kk.trim(), sort: c.sort, active: c.active }));
  };

  const addBanner = () => {
    const title = prompt('Заголовок акции (по-русски)');
    if (!title?.trim()) return;
    const text = prompt('Короткий текст (по-русски)') ?? '';
    void run(() => api.post('/api/admin/banners', { title_ru: title.trim(), title_kk: '', text_ru: text.trim(), text_kk: '', image_url: '', active: true, sort: 0 }));
  };

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Меню</h1>
        <span className="spacer" />
        <button className="btn btn--sm" onClick={addCategory}>
          + Категория
        </button>
      </div>
      {(error || menu.error) && <p className="err">{error || menu.error}</p>}

      {(menu.data?.categories ?? []).map((c) => (
        <section className="panel editor-cat" key={c.id}>
          <div className="toolbar" style={{ marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>
              {c.name_ru} {!c.active && <span className="pill">скрыта</span>}
            </h2>
            <span className="spacer" />
            <button className="btn btn--sm btn--ghost" onClick={() => setEditing(blankItem(c.id))}>
              + Позиция
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => editCategory(c)}>
              Переименовать
            </button>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => run(() => api.put(`/api/admin/categories/${c.id}`, { name_ru: c.name_ru, name_kk: c.name_kk, sort: c.sort, active: !c.active }))}
            >
              {c.active ? 'Скрыть' : 'Показать'}
            </button>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => confirm(`Удалить категорию «${c.name_ru}» со всеми позициями?`) && run(() => api.del(`/api/admin/categories/${c.id}`))}
            >
              Удалить
            </button>
          </div>
          {c.items.map((i) => (
            <div className="row-item" key={i.id}>
              <button
                className="switch"
                role="switch"
                aria-checked={i.available}
                aria-label={`В наличии: ${i.name_ru}`}
                onClick={() => run(() => api.patch(`/api/admin/items/${i.id}/availability`, { available: !i.available }))}
              />
              <div className="grow">
                <b>{i.name_ru}</b> {i.popular && '★'}
                <div className="hint">
                  {money(i.price)}
                  {i.groups.length > 0 && ` · опций: ${i.groups.length}`}
                  {!i.available && ' · нет в наличии'}
                </div>
              </div>
              <button className="btn btn--sm btn--ghost" onClick={() => setEditing(toDraft(i))}>
                Изменить
              </button>
            </div>
          ))}
          {c.items.length === 0 && <p className="hint">Позиций нет</p>}
        </section>
      ))}

      <section className="panel">
        <div className="toolbar" style={{ marginBottom: 6 }}>
          <h2 style={{ margin: 0 }}>Акции на главной</h2>
          <span className="spacer" />
          <button className="btn btn--sm" onClick={addBanner}>
            + Акция
          </button>
        </div>
        {(banners.data ?? []).map((b) => (
          <div className="row-item" key={b.id}>
            <button
              className="switch"
              role="switch"
              aria-checked={b.active}
              aria-label={`Показывать: ${b.title_ru}`}
              onClick={() => run(() => api.put(`/api/admin/banners/${b.id}`, { ...b, active: !b.active }))}
            />
            <div className="grow">
              <b>{b.title_ru}</b>
              <div className="hint">{b.text_ru}</div>
            </div>
            <button className="btn btn--sm btn--ghost" onClick={() => confirm('Удалить акцию?') && run(() => api.del(`/api/admin/banners/${b.id}`))}>
              Удалить
            </button>
          </div>
        ))}
        {banners.data?.length === 0 && <p className="hint">Акций нет</p>}
      </section>

      {editing && (
        <ItemModal
          draft={editing}
          categories={menu.data?.categories ?? []}
          onClose={() => setEditing(null)}
          onSave={(d) =>
            run(
              () => (d.id ? api.put(`/api/admin/items/${d.id}`, d) : api.post('/api/admin/items', d)),
              () => setEditing(null),
            )
          }
          onDelete={
            editing.id
              ? () => confirm('Удалить позицию?') && run(() => api.del(`/api/admin/items/${editing.id}`), () => setEditing(null))
              : undefined
          }
        />
      )}
    </>
  );
}

function ItemModal({
  draft,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  draft: ItemDraft;
  categories: Category[];
  onClose: () => void;
  onSave: (d: ItemDraft) => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState(draft);
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setGroup = (gi: number, patch: Partial<GroupDraft>) => set('groups', d.groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setMod = (gi: number, mi: number, patch: Partial<ModDraft>) =>
    setGroup(gi, { modifiers: d.groups[gi].modifiers.map((m, i) => (i === mi ? { ...m, ...patch } : m)) });

  const valid = d.name_ru.trim() && d.price >= 0 && d.groups.every((g) => g.name_ru.trim() && g.modifiers.length > 0 && g.modifiers.every((m) => m.name_ru.trim()));

  return (
    <div className="modal-back" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave({ ...d, name_ru: d.name_ru.trim(), name_kk: d.name_kk.trim() });
        }}
      >
        <h2>{d.id ? 'Изменить позицию' : 'Новая позиция'}</h2>
        <label className="field">
          <span>Категория</span>
          <select value={d.category_id} onChange={(e) => set('category_id', Number(e.target.value))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ru}
              </option>
            ))}
          </select>
        </label>
        <div className="grid2">
          <label className="field">
            <span>Название (рус)</span>
            <input value={d.name_ru} onChange={(e) => set('name_ru', e.target.value)} required />
          </label>
          <label className="field">
            <span>Название (қаз)</span>
            <input value={d.name_kk} onChange={(e) => set('name_kk', e.target.value)} />
          </label>
          <label className="field">
            <span>Описание (рус)</span>
            <textarea rows={2} value={d.desc_ru} onChange={(e) => set('desc_ru', e.target.value)} />
          </label>
          <label className="field">
            <span>Описание (қаз)</span>
            <textarea rows={2} value={d.desc_kk} onChange={(e) => set('desc_kk', e.target.value)} />
          </label>
          <label className="field">
            <span>Цена, ₸</span>
            <input type="number" min={0} value={d.price} onChange={(e) => set('price', Math.max(0, Math.round(Number(e.target.value))))} required />
          </label>
          <label className="field">
            <span>Вес / объём</span>
            <input value={d.weight} onChange={(e) => set('weight', e.target.value)} placeholder="250 мл" />
          </label>
          <label className="field">
            <span>Ссылка на фото</span>
            <input value={d.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" />
          </label>
          <label className="field">
            <span>Порядок (меньше — выше)</span>
            <input type="number" value={d.sort} onChange={(e) => set('sort', Math.round(Number(e.target.value)))} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={d.available} onChange={(e) => set('available', e.target.checked)} /> В наличии
        </label>
        <label className="check">
          <input type="checkbox" checked={d.popular} onChange={(e) => set('popular', e.target.checked)} /> Показать в «Любимое у гостей»
        </label>

        <h2 style={{ marginTop: 14 }}>Опции (размер, молоко, сироп…)</h2>
        {d.groups.map((g, gi) => (
          <div className="mod-group" key={gi}>
            <div className="grid2">
              <input type="text" placeholder="Название группы (рус)" value={g.name_ru} onChange={(e) => setGroup(gi, { name_ru: e.target.value })} />
              <input type="text" placeholder="Название группы (қаз)" value={g.name_kk} onChange={(e) => setGroup(gi, { name_kk: e.target.value })} />
            </div>
            <label className="check">
              <input type="checkbox" checked={g.required} onChange={(e) => setGroup(gi, { required: e.target.checked })} /> Обязательно выбрать
            </label>
            <label className="check">
              <input type="checkbox" checked={g.multi} onChange={(e) => setGroup(gi, { multi: e.target.checked })} /> Можно выбрать несколько
            </label>
            {g.modifiers.map((m, mi) => (
              <div className="mod-row" key={mi}>
                <input placeholder="Вариант (рус)" value={m.name_ru} onChange={(e) => setMod(gi, mi, { name_ru: e.target.value })} />
                <input placeholder="Вариант (қаз)" value={m.name_kk} onChange={(e) => setMod(gi, mi, { name_kk: e.target.value })} />
                <input type="number" aria-label="Доплата" value={m.price_delta} onChange={(e) => setMod(gi, mi, { price_delta: Math.round(Number(e.target.value)) })} />
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  aria-label="Убрать вариант"
                  onClick={() => setGroup(gi, { modifiers: g.modifiers.filter((_, i) => i !== mi) })}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setGroup(gi, { modifiers: [...g.modifiers, { name_ru: '', name_kk: '', price_delta: 0 }] })}>
                + Вариант
              </button>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => set('groups', d.groups.filter((_, i) => i !== gi))}>
                Удалить группу
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          style={{ marginTop: 12 }}
          onClick={() => set('groups', [...d.groups, { name_ru: '', name_kk: '', required: false, multi: false, modifiers: [{ name_ru: '', name_kk: '', price_delta: 0 }] }])}
        >
          + Группа опций
        </button>

        <div className="toolbar" style={{ marginTop: 20, marginBottom: 0 }}>
          <button className="btn btn--berry" disabled={!valid}>
            Сохранить
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <span className="spacer" />
          {onDelete && (
            <button type="button" className="btn btn--ghost" onClick={onDelete}>
              Удалить
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
