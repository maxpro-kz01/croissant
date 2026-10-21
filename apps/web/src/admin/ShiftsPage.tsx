import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { money } from '../i18n';
import { PAY_RU, errMsg, fmtDateTime, useLoad } from './useStream';

interface Summary {
  shift: { id: number; opened_at: string; opening_cash: number };
  sales: { payment_method: keyof typeof PAY_RU; sum: number; count: number }[];
  total_sales: number;
  orders_count: number;
  cash_entries: { id: number; kind: 'in' | 'out'; amount: number; note: string }[];
  expected_cash: number;
  difference?: number;
}
interface ShiftRow {
  id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  note: string;
}

export function ShiftsPage() {
  const cur = useLoad<Summary | null>('/api/admin/shifts/current');
  const hist = useLoad<ShiftRow[]>('/api/admin/shifts');
  const [opening, setOpening] = useState('0');
  const [closing, setClosing] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<'in' | 'out'>('out');
  const [amount, setAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [error, setError] = useState('');
  const [closed, setClosed] = useState<Summary | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await cur.reload();
      await hist.reload();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const open = (e: FormEvent) => {
    e.preventDefault();
    setClosed(null);
    void run(() => api.post('/api/admin/shifts/open', { opening_cash: Math.max(0, Math.round(Number(opening))) }));
  };
  const addEntry = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.post('/api/admin/shifts/cash', { kind, amount: Math.round(Number(amount)), note: entryNote.trim() });
      setAmount('');
      setEntryNote('');
    });
  };
  const close = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setClosed(await api.post<Summary>('/api/admin/shifts/close', { closing_cash: Math.round(Number(closing)), note: note.trim() }));
      setClosing('');
      setNote('');
    });
  };

  const s = cur.data;
  return (
    <>
      <h1>Смена и касса</h1>
      {error && <p className="err">{error}</p>}

      {closed && (
        <section className="panel">
          <h2>Смена закрыта</h2>
          <p>
            Выручка: <b>{money(closed.total_sales)}</b>, заказов: {closed.orders_count}. Ожидалось в кассе {money(closed.expected_cash)}.{' '}
            {closed.difference === 0 ? (
              <b>Сходится.</b>
            ) : (
              <b style={{ color: 'var(--berry-dark)' }}>
                {(closed.difference ?? 0) > 0 ? 'Излишек' : 'Недостача'}: {money(Math.abs(closed.difference ?? 0))}
              </b>
            )}
          </p>
        </section>
      )}

      {!s ? (
        <form className="panel" onSubmit={open}>
          <h2>Смена не открыта</h2>
          <p className="hint">Заказы привязываются к смене. Откройте её в начале дня.</p>
          <label className="field">
            <span>Наличные в кассе на старте, ₸</span>
            <input type="number" min={0} value={opening} onChange={(e) => setOpening(e.target.value)} />
          </label>
          <button className="btn btn--berry" style={{ marginTop: 12 }}>
            Открыть смену
          </button>
        </form>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <b>{money(s.total_sales)}</b>
              <span>выручка за смену</span>
            </div>
            <div className="kpi">
              <b>{s.orders_count}</b>
              <span>заказов</span>
            </div>
            <div className="kpi">
              <b>{money(s.expected_cash)}</b>
              <span>должно быть в кассе</span>
            </div>
            <div className="kpi">
              <b>{fmtDateTime(s.shift.opened_at)}</b>
              <span>открыта</span>
            </div>
          </div>

          <section className="panel">
            <h2>По способам оплаты</h2>
            <table className="table">
              <tbody>
                {s.sales.map((x) => (
                  <tr key={x.payment_method}>
                    <td>{PAY_RU[x.payment_method]}</td>
                    <td className="num">{x.count}</td>
                    <td className="num">{money(x.sum)}</td>
                  </tr>
                ))}
                {s.sales.length === 0 && (
                  <tr>
                    <td className="hint">Продаж пока нет</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Внесение и изъятие</h2>
            <form className="toolbar" onSubmit={addEntry}>
              <select className="sel" value={kind} onChange={(e) => setKind(e.target.value as 'in' | 'out')}>
                <option value="out">Изъятие</option>
                <option value="in">Внесение</option>
              </select>
              <input className="sel" type="number" min={1} placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ width: 120 }} />
              <input className="sel" placeholder="Комментарий" value={entryNote} onChange={(e) => setEntryNote(e.target.value)} maxLength={200} />
              <button className="btn btn--sm">Записать</button>
            </form>
            {s.cash_entries.map((c) => (
              <div className="row-item" key={c.id}>
                <span className="grow">{c.note || (c.kind === 'in' ? 'Внесение' : 'Изъятие')}</span>
                <b>
                  {c.kind === 'in' ? '+' : '−'}
                  {money(c.amount)}
                </b>
              </div>
            ))}
          </section>

          <form className="panel" onSubmit={close}>
            <h2>Закрыть смену</h2>
            <div className="grid2">
              <label className="field">
                <span>Пересчитали в кассе, ₸</span>
                <input type="number" min={0} value={closing} onChange={(e) => setClosing(e.target.value)} required />
              </label>
              <label className="field">
                <span>Заметка</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
              </label>
            </div>
            <button className="btn btn--berry" style={{ marginTop: 12 }}>
              Закрыть смену
            </button>
          </form>
        </>
      )}

      <section className="panel">
        <h2>Прошлые смены</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Открыта</th>
              <th>Закрыта</th>
              <th className="num">Ожидалось</th>
              <th className="num">Посчитано</th>
            </tr>
          </thead>
          <tbody>
            {(hist.data ?? []).filter((h) => h.closed_at).map((h) => (
              <tr key={h.id}>
                <td>{fmtDateTime(h.opened_at)}</td>
                <td>{h.closed_at && fmtDateTime(h.closed_at)}</td>
                <td className="num">{h.expected_cash != null && money(h.expected_cash)}</td>
                <td className="num">{h.closing_cash != null && money(h.closing_cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
