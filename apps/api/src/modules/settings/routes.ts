import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { parse } from '../../utils/http.js';
import { getSettings, saveSettings, type Settings } from '../../services/settings.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const settingsPatch = z
  .object({
    brand: z.object({ name: z.string().max(60), instagram: z.string().max(60), address: z.string().max(200), phone: z.string().max(30) }),
    whatsapp_phone: z.string().regex(/^\d{10,15}$/, 'Только цифры, с кодом страны, например 77011234567'),
    hours: z.object({ enabled: z.boolean(), open: time, close: time, tz: z.string().max(60) }),
    delivery: z.object({
      enabled: z.boolean(),
      fee: z.number().int().min(0),
      free_from: z.number().int().min(0),
      min_order: z.number().int().min(0),
    }),
    pickup_enabled: z.boolean(),
    payments: z.object({ cash: z.boolean(), card_terminal: z.boolean(), kaspi: z.boolean(), online: z.boolean() }),
    kaspi_link: z.string().max(300),
  })
  .partial();

export function settingsRouter(db: Db) {
  const r = Router();
  r.use('/settings', requireAuth(['admin']));
  r.get('/settings', async (_req, res) => res.json(await getSettings(db)));
  r.put('/settings', async (req, res) => {
    const patch = parse(settingsPatch, req.body) as Partial<Settings>;
    res.json(await saveSettings(db, patch));
  });
  return r;
}
