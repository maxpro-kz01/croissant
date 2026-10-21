import { useEffect, useState, type FormEvent } from 'react';
import { api, downloadFile, fetchBlobUrl } from '../api';
import { Wordmark } from '../components/Logo';
import { errMsg, useLoad } from './useStream';

interface Tbl {
  id: number;
  number: number;
  label: string;
  code: string;
  link: string;
}

export function TablesPage() {
  const { data, reload, error } = useLoad<Tbl[]>('/api/admin/tables');
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState('');
  const [qrs, setQrs] = useState<Record<number, string>>({});

  // Картинки QR берём с авторизацией, поэтому через blob-ссылки
  useEffect(() => {
    let dead = false;
    const urls: string[] = [];
    (async () => {
      const next: Record<number, string> = {};
      for (const t of data ?? []) {
        try {
          const u = await fetchBlobUrl(`/api/admin/tables/${t.id}/qr`);
          urls.push(u);
          next[t.id] = u;
        } catch {
          /* пропускаем */
        }
      }
      if (!dead) setQrs(next);
    })();
    return () => {
      dead = true;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [data]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/api/admin/tables', { number: Number(number), label: label.trim() });
      setNumber('');
      setLabel('');
      await reload();
    } catch (err) {
      setMsg(errMsg(err).includes('exists') ? 'Стол с таким номером уже есть' : errMsg(err));
    }
  };

  return (
    <>
      <div className="adm-hide-print">
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Столы и QR</h1>
          <span className="spacer" />
          <button className="btn btn--sm" disabled={!data?.length} onClick={() => window.print()}>
            Печать всех QR
          </button>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Каждый QR ведёт на меню с номером стола. Гость заказывает, а заказ появляется у вас в «Зале».
        </p>
        {(error || msg) && <p className="err">{msg || error}</p>}

        <form className="panel toolbar" onSubmit={add}>
          <input className="sel" type="number" min={1} max={999} placeholder="Номер" value={number} onChange={(e) => setNumber(e.target.value)} required style={{ width: 110 }} />
          <input className="sel" placeholder="Подпись (терраса, у окна…)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
          <button className="btn btn--sm btn--berry">Добавить стол</button>
        </form>

        <div className="hall">
          {(data ?? []).map((t) => (
            <article key={t.id} className="panel qr-card" style={{ marginBottom: 0 }}>
              <b style={{ fontSize: 22 }}>Стол {t.number}</b>
              {t.label && <span className="hint">{t.label}</span>}
              {qrs[t.id] && <img src={qrs[t.id]} alt={`QR стола ${t.number}`} />}
              <div className="ord__actions" style={{ justifyContent: 'center' }}>
                <button className="btn btn--sm btn--ghost" onClick={() => downloadFile(`/api/admin/tables/${t.id}/qr`, `table-${t.number}.png`)}>
                  PNG
                </button>
                <button className="btn btn--sm btn--ghost" onClick={() => downloadFile(`/api/admin/tables/${t.id}/qr?format=svg`, `table-${t.number}.svg`)}>
                  SVG
                </button>
                <button className="btn btn--sm btn--ghost" onClick={() => navigator.clipboard?.writeText(t.link)}>
                  Ссылка
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={async () => {
                    if (!confirm(`Удалить стол ${t.number}? Его QR перестанет работать.`)) return;
                    await api.del(`/api/admin/tables/${t.id}`);
                    await reload();
                  }}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Лист для печати: на экране скрыт, в печати показывается только он */}
      <div className="qr-sheet" aria-hidden="true">
        {(data ?? []).map((t) => (
          <div key={t.id} className="qr-card">
            <Wordmark />
            {qrs[t.id] && <img src={qrs[t.id]} alt="" />}
            <b style={{ fontSize: 28 }}>Стол {t.number}</b>
            <span>Наведите камеру — откроется меню</span>
          </div>
        ))}
      </div>
    </>
  );
}
