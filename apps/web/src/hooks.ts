import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { tr } from './i18n';
import { useApp } from './store';
import type { MenuResponse } from './types';

/** Функция перевода, привязанная к текущему языку. */
export function useT() {
  const lang = useApp((s) => s.lang);
  return useCallback((key: string, vars?: Record<string, string | number>) => tr(lang, key, vars), [lang]);
}

/** Меню и публичные настройки; обновляются раз в минуту, чтобы «нет в наличии» подтягивалось само. */
export function useMenu() {
  const [data, setData] = useState<MenuResponse | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    api
      .get<MenuResponse>('/api/menu')
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);
  return { data, error, reload: load };
}
