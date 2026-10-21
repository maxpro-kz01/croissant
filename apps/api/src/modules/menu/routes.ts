import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { HttpError, parse } from '../../utils/http.js';
import { getSettings, isOpenNow } from '../../services/settings.js';

const categorySchema = z.object({
  name_ru: z.string().min(1).max(80),
  name_kk: z.string().max(80).default(''),
  sort: z.number().int().default(0),
  active: z.boolean().default(true),
});

const modifierSchema = z.object({
  name_ru: z.string().min(1).max(80),
  name_kk: z.string().max(80).default(''),
  price_delta: z.number().int().default(0),
});
const groupSchema = z.object({
  name_ru: z.string().min(1).max(80),
  name_kk: z.string().max(80).default(''),
  required: z.boolean().default(false),
  multi: z.boolean().default(false),
  modifiers: z.array(modifierSchema).min(1),
});
const itemSchema = z.object({
  category_id: z.number().int(),
  name_ru: z.string().min(1).max(120),
  name_kk: z.string().max(120).default(''),
  desc_ru: z.string().max(500).default(''),
  desc_kk: z.string().max(500).default(''),
  price: z.number().int().min(0),
  weight: z.string().max(40).default(''),
  image_url: z.string().max(500).default(''),
  available: z.boolean().default(true),
  popular: z.boolean().default(false),
  sort: z.number().int().default(0),
  groups: z.array(groupSchema).default([]),
});
const bannerSchema = z.object({
  title_ru: z.string().min(1).max(120),
  title_kk: z.string().max(120).default(''),
  text_ru: z.string().max(300).default(''),
  text_kk: z.string().max(300).default(''),
  image_url: z.string().max(500).default(''),
  active: z.boolean().default(true),
  sort: z.number().int().default(0),
});

export async function loadMenu(db: Db, includeHidden = false) {
  const cats = (
    await db.query(`SELECT * FROM categories ${includeHidden ? '' : 'WHERE active'} ORDER BY sort, id`)
  ).rows;
  const items = (await db.query('SELECT * FROM menu_items ORDER BY sort, id')).rows;
  const groups = (await db.query('SELECT * FROM modifier_groups ORDER BY sort, id')).rows;
  const mods = (await db.query('SELECT * FROM modifiers ORDER BY sort, id')).rows;
  const groupsByItem = new Map<number, unknown[]>();
  for (const g of groups) {
    const arr = groupsByItem.get(g.item_id) ?? [];
    arr.push({ ...g, modifiers: mods.filter((m) => m.group_id === g.id) });
    groupsByItem.set(g.item_id, arr);
  }
  return cats.map((c) => ({
    ...c,
    items: items.filter((i) => i.category_id === c.id).map((i) => ({ ...i, groups: groupsByItem.get(i.id) ?? [] })),
  }));
}

async function saveGroups(db: Db, itemId: number, groups: z.infer<typeof groupSchema>[]) {
  await db.query('DELETE FROM modifier_groups WHERE item_id = $1', [itemId]);
  let gi = 0;
  for (const g of groups) {
    const gr = await db.query(
      `INSERT INTO modifier_groups(item_id, name_ru, name_kk, required, multi, sort) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [itemId, g.name_ru, g.name_kk, g.required, g.multi, gi++],
    );
    let mi = 0;
    for (const m of g.modifiers) {
      await db.query(`INSERT INTO modifiers(group_id, name_ru, name_kk, price_delta, sort) VALUES ($1,$2,$3,$4,$5)`, [
        gr.rows[0].id,
        m.name_ru,
        m.name_kk,
        m.price_delta,
        mi++,
      ]);
    }
  }
}

export function publicMenuRouter(db: Db) {
  const r = Router();
  r.get('/menu', async (_req, res) => {
    const settings = await getSettings(db);
    const categories = (await loadMenu(db)).filter((c) => c.items.length > 0);
    const banners = (await db.query('SELECT * FROM banners WHERE active ORDER BY sort, id')).rows;
    res.json({
      categories,
      banners,
      settings: {
        brand: settings.brand,
        hours: settings.hours,
        delivery: settings.delivery,
        pickup_enabled: settings.pickup_enabled,
        payments: settings.payments,
        whatsapp_phone: settings.whatsapp_phone,
      },
      is_open: isOpenNow(settings.hours),
    });
  });
  return r;
}

export function adminMenuRouter(db: Db) {
  const r = Router();
  // Защита только своих путей: роутеры смонтированы на общий префикс /admin.
  r.use(['/menu', '/categories', '/items', '/banners'], requireAuth(['admin']));

  r.get('/menu', async (_req, res) => res.json({ categories: await loadMenu(db, true) }));

  r.post('/categories', async (req, res) => {
    const b = parse(categorySchema, req.body);
    const row = (
      await db.query(`INSERT INTO categories(name_ru,name_kk,sort,active) VALUES ($1,$2,$3,$4) RETURNING *`, [
        b.name_ru,
        b.name_kk,
        b.sort,
        b.active,
      ])
    ).rows[0];
    res.status(201).json(row);
  });
  r.put('/categories/:id', async (req, res) => {
    const b = parse(categorySchema, req.body);
    const row = (
      await db.query(`UPDATE categories SET name_ru=$1,name_kk=$2,sort=$3,active=$4 WHERE id=$5 RETURNING *`, [
        b.name_ru,
        b.name_kk,
        b.sort,
        b.active,
        req.params.id,
      ])
    ).rows[0];
    if (!row) throw new HttpError(404, 'Not found');
    res.json(row);
  });
  r.delete('/categories/:id', async (req, res) => {
    await db.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    res.status(204).end();
  });

  r.post('/items', async (req, res) => {
    const b = parse(itemSchema, req.body);
    const row = (
      await db.query(
        `INSERT INTO menu_items(category_id,name_ru,name_kk,desc_ru,desc_kk,price,weight,image_url,available,popular,sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [b.category_id, b.name_ru, b.name_kk, b.desc_ru, b.desc_kk, b.price, b.weight, b.image_url, b.available, b.popular, b.sort],
      )
    ).rows[0];
    await saveGroups(db, row.id, b.groups);
    res.status(201).json(row);
  });
  r.put('/items/:id', async (req, res) => {
    const b = parse(itemSchema, req.body);
    const row = (
      await db.query(
        `UPDATE menu_items SET category_id=$1,name_ru=$2,name_kk=$3,desc_ru=$4,desc_kk=$5,price=$6,weight=$7,image_url=$8,
           available=$9,popular=$10,sort=$11 WHERE id=$12 RETURNING *`,
        [b.category_id, b.name_ru, b.name_kk, b.desc_ru, b.desc_kk, b.price, b.weight, b.image_url, b.available, b.popular, b.sort, req.params.id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Not found');
    await saveGroups(db, row.id, b.groups);
    res.json(row);
  });
  r.patch('/items/:id/availability', async (req, res) => {
    const { available } = parse(z.object({ available: z.boolean() }), req.body);
    const row = (await db.query('UPDATE menu_items SET available=$1 WHERE id=$2 RETURNING *', [available, req.params.id])).rows[0];
    if (!row) throw new HttpError(404, 'Not found');
    res.json(row);
  });
  r.delete('/items/:id', async (req, res) => {
    await db.query('DELETE FROM menu_items WHERE id=$1', [req.params.id]);
    res.status(204).end();
  });

  r.get('/banners', async (_req, res) => res.json((await db.query('SELECT * FROM banners ORDER BY sort, id')).rows));
  r.post('/banners', async (req, res) => {
    const b = parse(bannerSchema, req.body);
    const row = (
      await db.query(
        `INSERT INTO banners(title_ru,title_kk,text_ru,text_kk,image_url,active,sort) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [b.title_ru, b.title_kk, b.text_ru, b.text_kk, b.image_url, b.active, b.sort],
      )
    ).rows[0];
    res.status(201).json(row);
  });
  r.put('/banners/:id', async (req, res) => {
    const b = parse(bannerSchema, req.body);
    const row = (
      await db.query(
        `UPDATE banners SET title_ru=$1,title_kk=$2,text_ru=$3,text_kk=$4,image_url=$5,active=$6,sort=$7 WHERE id=$8 RETURNING *`,
        [b.title_ru, b.title_kk, b.text_ru, b.text_kk, b.image_url, b.active, b.sort, req.params.id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Not found');
    res.json(row);
  });
  r.delete('/banners/:id', async (req, res) => {
    await db.query('DELETE FROM banners WHERE id=$1', [req.params.id]);
    res.status(204).end();
  });
  return r;
}
