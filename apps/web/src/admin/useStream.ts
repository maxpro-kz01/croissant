import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, auth } from '../api';

/**
 * События заказов. Хостинг бессерверный (Vercel), поэтому вместо SSE админка каждые 4 секунды
 * спрашивает у API «отпечаток» заказов и сообщает об изменениях: новый заказ или обновление.
 */
export function useStream(onEvent: (name: string, data: unknown) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!auth.token) return;
    let prev: { maxId: number; last: string } | null = null;
    let stopped = false;
    const tick = async () => {
      try {
        const cur = await api.get<{ maxId: number; last: string }>('/api/admin/pulse');
        if (stopped) return;
        setLive(true);
        if (prev && cur.maxId > prev.maxId) handler.current('order.created', { id: cur.maxId });
        else if (prev && cur.last !== prev.last) handler.current('order.updated', null);
        prev = cur;
      } catch {
        if (!stopped) setLive(false);
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
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
