import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, auth } from '../api';

/** Подписка на события заказов (SSE). EventSource не умеет заголовки, поэтому токен идёт в query. */
export function useStream(onEvent: (name: string, data: unknown) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  const [live, setLive] = useState(false);
  useEffect(() => {
    const token = auth.token;
    if (!token) return;
    const es = new EventSource(`/api/admin/stream?token=${encodeURIComponent(token)}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    for (const name of ['order.created', 'order.updated']) {
      es.addEventListener(name, (e) => {
        try {
          handler.current(name, JSON.parse((e as MessageEvent).data));
        } catch {
          handler.current(name, null);
        }
      });
    }
    return () => es.close();
  }, []);
  return live;
}

/** Загрузка данных с перезагрузкой по требованию. */
export function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    if (!url) return;
    try {
      setData(await api.get<T>(url));
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, [url]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload, setData };
}

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.status === 0 ? 'Нет связи с сервером' : e.message;
  return 'Что-то пошло не так';
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qyzylorda' });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qyzylorda' });

export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Qyzylorda' }).format(new Date());

export const TYPE_RU = { dine_in: 'В зале', delivery: 'Доставка', pickup: 'Самовывоз' } as const;
export const PAY_RU = { cash: 'Наличные', card_terminal: 'Карта на месте', kaspi: 'Kaspi', online: 'Онлайн' } as const;
export const PAYST_RU = { unpaid: 'Не оплачен', pending: 'Ждём оплату', paid: 'Оплачен', failed: 'Ошибка оплаты' } as const;
