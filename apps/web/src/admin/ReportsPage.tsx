import { useState } from 'react';
import { downloadFile } from '../api';
import { money } from '../i18n';
import { PAY_RU, TYPE_RU, todayStr, useLoad } from './useStream';

interface Report {
  from: string;
  to: string;
  revenue: number;
  orders: number;
  avg_check: number;
  by_day: { day: string; revenue: number; orders: number }[];
  by_type: { type: keyof typeof TYPE_RU; revenue: number; orders: number }[];
  by_payment: { payment_method: keyof typeof PAY_RU; revenue: number; orders: number }[];
  top_items: { name: string; qty: number; revenue: number }[];
}

const shift = (days: number) => {
  const d = new Date(todayStr() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar" key={r.label}>
          <span>{r.label}</span>
          <i style={{ width: `${(r.value / max) * 100}%` }} />
          <span className="num">{money(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const { data, error } = useLoad<Report>(`/api/admin/reports?from=${from}&to=${to}`);

  const preset = (days: number) => {
    setFrom(shift(-days));
    setTo(todayStr());
  };

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Отчёты</h1>
        <span className="spacer" />
        <button className="btn btn--sm btn--ghost" onClick={() => preset(0)}>Сегодня</button>
        <button className="btn btn--sm btn--ghost" onClick={() => preset(6)}>7 дней</button>
        <button className="btn btn--sm btn--ghost" onClick={() => preset(29)}>30 дней</button>
        <input className="sel" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="С" />
        <input className="sel" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="По" />
        <button className="btn btn--sm" onClick={() => downloadFile(`/api/admin/reports/export.csv?from=${from}&to=${to}`, `orders-${from}_${to}.csv`)}>
          Скачать CSV
        </button>
      </div>
      {error && <p className="err">{error}</p>}
      {data && (
        <>
          <div className="kpis">
            <div className="kpi">
              <b>{money(data.revenue)}</b>
              <span>выручка</span>
            </div>
            <div className="kpi">
              <b>{data.orders}</b>
              <span>заказов</span>
            </div>
            <div className="kpi">
              <b>{money(data.avg_check)}</b>
              <span>средний чек</span>
            </div>
          </div>
          <p className="hint" style={{ marginBottom: 12 }}>Отменённые заказы в выручку не входят.</p>

          {data.by_day.length > 1 && (
            <section className="panel">
              <h2>По дням</h2>
              <Bars rows={data.by_day.map((d) => ({ label: d.day.slice(5), value: d.revenue }))} />
            </section>
          )}
          <div className="grid2">
            <section className="panel">
              <h2>По типу заказа</h2>
              <Bars rows={data.by_type.map((r) => ({ label: TYPE_RU[r.type], value: r.revenue }))} />
            </section>
            <section className="panel">
              <h2>По оплате</h2>
              <Bars rows={data.by_payment.map((r) => ({ label: PAY_RU[r.payment_method], value: r.revenue }))} />
            </section>
          </div>
          <section className="panel">
            <h2>Что берут чаще всего</h2>
            <table className="table">
              <tbody>
                {data.top_items.map((i) => (
                  <tr key={i.name}>
                    <td>{i.name}</td>
                    <td className="num">{i.qty} шт.</td>
                    <td className="num">{money(i.revenue)}</td>
                  </tr>
                ))}
                {data.top_items.length === 0 && (
                  <tr>
                    <td className="hint">За этот период заказов нет</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
