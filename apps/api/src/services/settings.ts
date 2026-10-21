import type { Db } from '../db/pool.js';

export interface Settings {
  brand: { name: string; instagram: string; address: string; phone: string };
  whatsapp_phone: string;
  hours: { enabled: boolean; open: string; close: string; tz: string };
  delivery: { enabled: boolean; fee: number; free_from: number; min_order: number };
  pickup_enabled: boolean;
  payments: { cash: boolean; card_terminal: boolean; kaspi: boolean; online: boolean };
  kaspi_link: string;
}

export const DEFAULT_SETTINGS: Settings = {
  brand: { name: 'Croissant', instagram: 'croissant.maison', address: 'Кызылорда', phone: '' },
  whatsapp_phone: '77000000000',
  hours: { enabled: true, open: '08:00', close: '23:00', tz: 'Asia/Qyzylorda' },
  delivery: { enabled: true, fee: 700, free_from: 8000, min_order: 2000 },
  pickup_enabled: true,
  payments: { cash: true, card_terminal: true, kaspi: true, online: true },
  kaspi_link: '',
};

export async function getSettings(db: Db): Promise<Settings> {
  const rows = (await db.query('SELECT key, value FROM settings')).rows as { key: string; value: unknown }[];
  const merged: Record<string, unknown> = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
  for (const r of rows) {
    const def = merged[r.key];
    merged[r.key] =
      def && typeof def === 'object' && !Array.isArray(def) && r.value && typeof r.value === 'object'
        ? { ...(def as object), ...(r.value as object) }
        : r.value;
  }
  return merged as unknown as Settings;
}

export async function saveSettings(db: Db, patch: Partial<Settings>): Promise<Settings> {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await db.query(
      `INSERT INTO settings(key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)],
    );
  }
  return getSettings(db);
}

/** Открыто ли заведение сейчас (учитывает часовой пояс и ночные смены вида 18:00–02:00). */
export function isOpenNow(hours: Settings['hours'], now = new Date()): boolean {
  if (!hours.enabled) return true;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: hours.tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')!.value) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')!.value);
  const cur = h * 60 + m;
  const toMin = (s: string) => {
    const [hh, mm] = s.split(':').map(Number);
    return hh * 60 + (mm || 0);
  };
  const open = toMin(hours.open);
  const close = toMin(hours.close);
  return open <= close ? cur >= open && cur < close : cur >= open || cur < close;
}
