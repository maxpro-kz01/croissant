import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import type { Hub } from '../../realtime/hub.js';
import { HttpError, parse, randomId } from '../../utils/http.js';
import { startOnlinePayment } from '../../services/payments.js';
import { getSettings, isOpenNow } from '../../services/settings.js';
import { buildWhatsAppText, waLink, type WaOrder } from '../../services/whatsapp.js';

const TZ = 'Asia/Qyzylorda';

const orderSchema = z.object({
  type: z.enum(['dine_in', 'delivery', 'pickup']),
  table_code: z.string().max(40).optional(),
  table_number: z.number().int().min(1).max(999).optional(), // заказ «к столу» без QR
  customer_name: z.string().max(80).default(''),
  phone: z.string().max(30).default(''),
  address: z
    .object({
      street: z.string().max(120).default(''),
      house: z.string().max(20).default(''),
      apt: z.string().max(20).default(''),
      landmark: z.string().max(120).default(''),
    })
    .optional(),
  comment: z.string().max(500).default(''),
  payment_method: z.enum(['cash', 'card_terminal', 'kaspi', 'online']),
  lang: z.enum(['ru', 'kk']).default('ru'),
  scheduled_for: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        item_id: z.number().int(),
        qty: z.number().int().min(1).max(50),
        modifier_ids: z.array(z.number().int()).default([]),
        comment: z.string().max(200).default(''),
      }),
    )
    .min(1)
    .max(60),
});
export type OrderInput = z.infer<typeof orderSchema>;

interface ItemRow {
  id: number;
  name_ru: string;
  name_kk: string;
  price: number;
  available: boolean;
}

export async function createOrder(db: Db, hub: Hub, input: OrderInput) {
  const settings = await getSettings(db);
  if (!isOpenNow(settings.hours)) {
    throw new HttpError(409, `Closed. Working hours ${settings.hours.open}–${settings.hours.close}`, 'closed');
  }
  // «К столу»: без онлайн-оплаты, платят в заведении
  if (input.type === 'dine_in') input = { ...input, payment_method: 'cash' };
  if (!settings.payments[input.payment_method] && input.type !== 'dine_in') throw new HttpError(400, 'Payment method is disabled', 'payment_disabled');

  let tableId: number | null = null;
  let tableNumber: number | null = null;
  if (input.type === 'dine_in') {
    if (!input.table_code && !input.table_number) throw new HttpError(400, 'Table is required', 'table_required');
    const t = (
      input.table_code
        ? await db.query('SELECT id, number FROM tables WHERE code = $1', [input.table_code])
        : await db.query('SELECT id, number FROM tables WHERE number = $1', [input.table_number])
    ).rows[0];
    if (!t) throw new HttpError(400, 'Unknown table', 'table_unknown');
    tableId = t.id;
    tableNumber = t.number;
  } else {
    if (!input.phone.replace(/\D/g, '').match(/^\d{10,15}$/)) throw new HttpError(400, 'Phone is required', 'phone_required');
    if (input.type === 'delivery') {
      if (!settings.delivery.enabled) throw new HttpError(400, 'Delivery is disabled', 'delivery_disabled');
      if (!input.address?.street || !input.address.house) throw new HttpError(400, 'Address is required', 'address_required');
    }
    if (input.type === 'pickup' && !settings.pickup_enabled) throw new HttpError(400, 'Pickup is disabled', 'pickup_disabled');
  }

  // Цены всегда считаем на сервере.
  const ids = [...new Set(input.items.map((i) => i.item_id))];
  const dbItems = (await db.query('SELECT id,name_ru,name_kk,price,available FROM menu_items WHERE id = ANY($1)', [ids])).rows as ItemRow[];
  const byId = new Map(dbItems.map((i) => [i.id, i]));
  const groups = (await db.query('SELECT * FROM modifier_groups WHERE item_id = ANY($1)', [ids])).rows;
  const mods = (
    await db.query('SELECT m.* FROM modifiers m JOIN modifier_groups g ON g.id = m.group_id WHERE g.item_id = ANY($1)', [ids])
  ).rows;

  const lines = input.items.map((line) => {
    const item = byId.get(line.item_id);
    if (!item) throw new HttpError(400, `Item ${line.item_id} not found`, 'item_unknown');
    if (!item.available) throw new HttpError(409, `${item.name_ru} is unavailable`, 'item_unavailable');
    const itemGroups = groups.filter((g) => g.item_id === item.id);
    const chosen = line.modifier_ids.map((id) => {
      const m = mods.find((x) => x.id === id);
      if (!m || !itemGroups.some((g) => g.id === m.group_id)) throw new HttpError(400, 'Bad modifier', 'modifier_invalid');
      return m;
    });
    for (const g of itemGroups) {
      const n = chosen.filter((m) => m.group_id === g.id).length;
      if (g.required && n === 0) throw new HttpError(400, `Choose option: ${g.name_ru}`, 'modifier_required');
      if (!g.multi && n > 1) throw new HttpError(400, `Only one option: ${g.name_ru}`, 'modifier_multi');
    }
    const unit = item.price + chosen.reduce((s, m) => s + m.price_delta, 0);
    return {
      item_id: item.id,
      name: input.lang === 'kk' && item.name_kk ? item.name_kk : item.name_ru,
      qty: line.qty,
      unit_price: unit,
      modifiers: chosen.map((m) => ({ id: m.id, name: input.lang === 'kk' && m.name_kk ? m.name_kk : m.name_ru, price_delta: m.price_delta })),
      comment: line.comment,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  let deliveryFee = 0;
  if (input.type === 'delivery') {
    if (subtotal < settings.delivery.min_order) {
      throw new HttpError(400, `Minimum order for delivery is ${settings.delivery.min_order}`, 'min_order');
    }
    deliveryFee = settings.delivery.free_from > 0 && subtotal >= settings.delivery.free_from ? 0 : settings.delivery.fee;
  }
  const total = subtotal + deliveryFee;

  const client = await db.connect();
  let order;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7001)');
    const num = (
      await client.query(
        `SELECT COALESCE(MAX(number),0)+1 AS n FROM orders
         WHERE created_at >= (date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1)`,
        [TZ],
      )
    ).rows[0].n as number;
    const shift = (await client.query('SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1')).rows[0];
    const publicId = randomId(10);
    order = (
      await client.query(
        `INSERT INTO orders(public_id,number,type,table_id,customer_name,phone,address,comment,payment_method,subtotal,delivery_fee,total,lang,scheduled_for,shift_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [
          publicId,
          num,
          input.type,
          tableId,
          input.customer_name,
          input.phone,
          input.type === 'delivery' ? JSON.stringify(input.address) : null,
          input.comment,
          input.payment_method,
          subtotal,
          deliveryFee,
          total,
          input.lang,
          input.scheduled_for ?? null,
          shift?.id ?? null,
        ],
      )
    ).rows[0];
    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items(order_id,item_id,name,qty,unit_price,modifiers,comment) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [order.id, l.item_id, l.name, l.qty, l.unit_price, JSON.stringify(l.modifiers), l.comment],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  let paymentUrl: string | null = null;
  if (input.payment_method === 'online') {
    const session = await startOnlinePayment(db, order.id, order.public_id, total, settings);
    paymentUrl = session.paymentUrl;
    order.payment_status = 'pending';
  } else if (input.payment_method === 'kaspi' && settings.kaspi_link) {
    paymentUrl = settings.kaspi_link;
  }

  const wa: WaOrder = {
    number: order.number,
    type: order.type,
    tableNumber,
    customerName: order.customer_name,
    phone: order.phone,
    address: order.address,
    comment: order.comment,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    subtotal,
    deliveryFee,
    total,
    scheduledFor: input.scheduled_for ?? null,
    items: lines.map((l) => ({ name: l.name, qty: l.qty, unitPrice: l.unit_price, modifiers: l.modifiers, comment: l.comment })),
  };
  const text = buildWhatsAppText(wa, 'ru');
  hub.emit('order.created', { id: order.id, number: order.number, type: order.type, table_number: tableNumber, total });

  return {
    public_id: order.public_id as string,
    number: order.number as number,
    status: order.status as string,
    payment_status: order.payment_status as string,
    total,
    delivery_fee: deliveryFee,
    payment_url: paymentUrl,
    whatsapp: { text, url: waLink(settings.whatsapp_phone, text) },
  };
}

const ORDER_SELECT = `
  SELECT o.*, t.number AS table_number,
    COALESCE((SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'qty', i.qty, 'unit_price', i.unit_price,
      'modifiers', i.modifiers, 'comment', i.comment) ORDER BY i.id) FROM order_items i WHERE i.order_id = o.id), '[]'::json) AS items
  FROM orders o LEFT JOIN tables t ON t.id = o.table_id`;

export function publicOrdersRouter(db: Db, hub: Hub, limitPerMinute = 15) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: limitPerMinute, standardHeaders: true, legacyHeaders: false });
  r.post('/orders', limiter, async (req, res) => {
    const input = parse(orderSchema, req.body);
    res.status(201).json(await createOrder(db, hub, input));
  });
  r.get('/orders/:publicId', async (req, res) => {
    const row = (await db.query(`${ORDER_SELECT} WHERE o.public_id = $1`, [req.params.publicId])).rows[0];
    if (!row) throw new HttpError(404, 'Not found');
    res.json({
      public_id: row.public_id,
      number: row.number,
      type: row.type,
      status: row.status,
      payment_status: row.payment_status,
      total: row.total,
      table_number: row.table_number,
      items: row.items.map((i: { name: string; qty: number }) => ({ name: i.name, qty: i.qty })),
    });
  });
  return r;
}

const statusSchema = z.object({ status: z.enum(['new', 'preparing', 'ready', 'done', 'cancelled']) });
const paymentStatusSchema = z.object({ payment_status: z.enum(['unpaid', 'pending', 'paid', 'failed']) });

export function adminOrdersRouter(db: Db, hub: Hub) {
  const r = Router();
  r.get('/stream', requireAuth(), (req, res) => hub.subscribe(req, res));
  r.use(['/orders', '/hall'], requireAuth());

  r.get('/orders', async (req, res) => {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (req.query.status === 'active') where.push(`o.status IN ('new','preparing','ready')`);
    else if (typeof req.query.status === 'string') add('o.status = ?', req.query.status);
    if (typeof req.query.type === 'string') add('o.type = ?', req.query.type);
    if (typeof req.query.table === 'string') add('t.number = ?', Number(req.query.table));
    if (typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      params.push(req.query.date, TZ);
      where.push(`(o.created_at AT TIME ZONE $${params.length})::date = $${params.length - 1}::date`);
    }
    const rows = (
      await db.query(`${ORDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.created_at DESC LIMIT 200`, params)
    ).rows;
    res.json(rows);
  });

  /** Зал: какие столы сейчас заказывают. */
  r.get('/hall', async (_req, res) => {
    const tables = (await db.query('SELECT id, number, label FROM tables ORDER BY number')).rows;
    const active = (
      await db.query(`${ORDER_SELECT} WHERE o.type = 'dine_in' AND o.status IN ('new','preparing','ready') ORDER BY o.created_at`)
    ).rows;
    res.json(
      tables.map((t) => {
        const orders = active.filter((o) => o.table_id === t.id);
        return { ...t, busy: orders.length > 0, total: orders.reduce((s, o) => s + o.total, 0), orders };
      }),
    );
  });

  r.patch('/orders/:id/status', async (req, res) => {
    const { status } = parse(statusSchema, req.body);
    const row = (await db.query(`UPDATE orders SET status=$1, updated_at=now() WHERE id=$2 RETURNING id, number, status`, [status, req.params.id])).rows[0];
    if (!row) throw new HttpError(404, 'Not found');
    hub.emit('order.updated', row);
    res.json(row);
  });

  r.patch('/orders/:id/payment', async (req, res) => {
    const { payment_status } = parse(paymentStatusSchema, req.body);
    const row = (
      await db.query(`UPDATE orders SET payment_status=$1, updated_at=now() WHERE id=$2 RETURNING id, number, payment_status`, [payment_status, req.params.id])
    ).rows[0];
    if (!row) throw new HttpError(404, 'Not found');
    hub.emit('order.updated', row);
    res.json(row);
  });
  return r;
}
