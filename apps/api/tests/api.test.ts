import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signWebhook } from '../src/services/payments.js';
import { isOpenNow } from '../src/services/settings.js';
import { startTestApp, type TestCtx } from './helpers.js';

let c: TestCtx;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  c = await startTestApp();
}, 120_000);
afterAll(async () => {
  await c?.stop();
});

async function item(name: string) {
  const r = (await c.db.query('SELECT * FROM menu_items WHERE name_ru = $1', [name])).rows[0];
  return r as { id: number; price: number };
}
async function tableCode(n = 3) {
  return (await c.db.query('SELECT code FROM tables WHERE number = $1', [n])).rows[0].code as string;
}

describe('menu', () => {
  it('отдаёт меню с категориями, модификаторами и настройками', async () => {
    const r = await c.http.get('/api/menu').expect(200);
    expect(r.body.categories.length).toBeGreaterThanOrEqual(4);
    const cappuccino = r.body.categories.flatMap((x: any) => x.items).find((i: any) => i.name_ru === 'Капучино');
    expect(cappuccino.groups.map((g: any) => g.name_ru)).toEqual(['Размер', 'Молоко', 'Сироп']);
    expect(r.body.settings.delivery.fee).toBe(700);
    expect(r.body.is_open).toBe(true);
  });
});

describe('orders', () => {
  it('заказ в зале: цена считается на сервере, есть текст и ссылка WhatsApp', async () => {
    const cap = await item('Капучино');
    const mods = (await c.db.query(`SELECT m.id, m.name_ru FROM modifiers m JOIN modifier_groups g ON g.id=m.group_id WHERE g.item_id=$1`, [cap.id])).rows;
    const m350 = mods.find((m) => m.name_ru === '350 мл').id; // +300
    const oat = mods.find((m) => m.name_ru === 'Овсяное').id; // +350
    const cro = await item('Круассан классический');
    const res = await c.http
      .post('/api/orders')
      .send({
        type: 'dine_in',
        table_code: await tableCode(3),
        customer_name: 'Алия',
        payment_method: 'cash',
        items: [
          { item_id: cap.id, qty: 2, modifier_ids: [m350, oat] },
          { item_id: cro.id, qty: 1 },
        ],
      })
      .expect(201);
    expect(res.body.total).toBe((cap.price + 300 + 350) * 2 + cro.price);
    expect(res.body.whatsapp.text).toContain('Стол 3');
    expect(res.body.whatsapp.text).toContain('Капучино');
    expect(res.body.whatsapp.url).toMatch(/^https:\/\/wa\.me\/77000000000\?text=/);
    const st = await c.http.get(`/api/orders/${res.body.public_id}`).expect(200);
    expect(st.body.status).toBe('new');
    expect(st.body.table_number).toBe(3);
  });

  it('игнорирует цену от клиента', async () => {
    const cro = await item('Круассан классический');
    const res = await c.http
      .post('/api/orders')
      .send({ type: 'dine_in', table_code: await tableCode(1), payment_method: 'cash', items: [{ item_id: cro.id, qty: 1, price: 1 }] })
      .expect(201);
    expect(res.body.total).toBe(cro.price);
  });

  it('зал: без кода стола или с неизвестным кодом — ошибка', async () => {
    const cro = await item('Круассан классический');
    const base = { type: 'dine_in', payment_method: 'cash', items: [{ item_id: cro.id, qty: 1 }] };
    await c.http.post('/api/orders').send(base).expect(400);
    await c.http.post('/api/orders').send({ ...base, table_code: 'nope' }).expect(400);
  });

  it('зал без QR: заказ по номеру стола, несуществующий стол — ошибка', async () => {
    const cro = await item('Круассан классический');
    const base = { type: 'dine_in', payment_method: 'cash', items: [{ item_id: cro.id, qty: 1 }] };
    const ok = await c.http.post('/api/orders').send({ ...base, table_number: 2 }).expect(201);
    expect(ok.body.whatsapp.text).toContain('Стол 2');
    await c.http.post('/api/orders').send({ ...base, table_number: 999 }).expect(400);
  });

  it('доставка: нужен адрес и телефон, минимальная сумма, стоимость доставки', async () => {
    const cro = await item('Круассан классический');
    const tiramisu = await item('Тирамису');
    const addr = { street: 'Айтеке би', house: '12', apt: '5', landmark: 'у аптеки' };
    const ok = { type: 'delivery', phone: '+7 701 123 45 67', address: addr, payment_method: 'kaspi' };

    // мало: 1100 < минимум 2000
    const low = await c.http.post('/api/orders').send({ ...ok, items: [{ item_id: cro.id, qty: 1 }] }).expect(400);
    expect(low.body.code).toBe('min_order');
    // без адреса
    await c.http.post('/api/orders').send({ ...ok, address: undefined, items: [{ item_id: tiramisu.id, qty: 1 }] }).expect(400);
    // без телефона
    await c.http.post('/api/orders').send({ ...ok, phone: '', items: [{ item_id: tiramisu.id, qty: 1 }] }).expect(400);
    // нормальный заказ: 2400 → доставка 700
    const r = await c.http.post('/api/orders').send({ ...ok, items: [{ item_id: tiramisu.id, qty: 1 }] }).expect(201);
    expect(r.body.delivery_fee).toBe(700);
    expect(r.body.total).toBe(tiramisu.price + 700);
    expect(r.body.whatsapp.text).toContain('Айтеке би');
    // бесплатная доставка от 8000
    const big = await c.http.post('/api/orders').send({ ...ok, items: [{ item_id: tiramisu.id, qty: 4 }] }).expect(201);
    expect(big.body.delivery_fee).toBe(0);
  });

  it('обязательный модификатор и чужой модификатор отклоняются', async () => {
    const cap = await item('Капучино');
    const lat = await item('Американо');
    const base = { type: 'pickup', phone: '87011234567', payment_method: 'cash' };
    const noSize = await c.http.post('/api/orders').send({ ...base, items: [{ item_id: cap.id, qty: 1 }] }).expect(400);
    expect(noSize.body.code).toBe('modifier_required');
    const foreign = (await c.db.query(`SELECT m.id FROM modifiers m JOIN modifier_groups g ON g.id=m.group_id WHERE g.item_id=$1 LIMIT 1`, [lat.id])).rows[0].id;
    const sizeId = (await c.db.query(`SELECT m.id FROM modifiers m JOIN modifier_groups g ON g.id=m.group_id WHERE g.item_id=$1 AND g.name_ru='Размер' LIMIT 1`, [cap.id])).rows[0].id;
    await c.http.post('/api/orders').send({ ...base, items: [{ item_id: cap.id, qty: 1, modifier_ids: [sizeId, foreign] }] }).expect(400);
    await c.http.post('/api/orders').send({ ...base, items: [{ item_id: cap.id, qty: 1, modifier_ids: [sizeId] }] }).expect(201);
  });

  it('позиция «нет в наличии» не заказывается', async () => {
    const eclair = await item('Эклер ванильный');
    await c.http.patch(`/api/admin/items/${eclair.id}/availability`).set(auth(c.adminToken)).send({ available: false }).expect(200);
    const r = await c.http
      .post('/api/orders')
      .send({ type: 'pickup', phone: '87011234567', payment_method: 'cash', items: [{ item_id: eclair.id, qty: 1 }] })
      .expect(409);
    expect(r.body.code).toBe('item_unavailable');
    await c.http.patch(`/api/admin/items/${eclair.id}/availability`).set(auth(c.adminToken)).send({ available: true }).expect(200);
  });

  it('isOpenNow: обычный и ночной график', () => {
    const at = (iso: string) => new Date(iso); // Asia/Qyzylorda = UTC+5
    const day = { enabled: true, open: '08:00', close: '23:00', tz: 'Asia/Qyzylorda' };
    expect(isOpenNow(day, at('2026-10-21T05:00:00Z'))).toBe(true); // 10:00
    expect(isOpenNow(day, at('2026-10-21T02:00:00Z'))).toBe(false); // 07:00
    const night = { ...day, open: '18:00', close: '02:00' };
    expect(isOpenNow(night, at('2026-10-21T20:00:00Z'))).toBe(true); // 01:00
    expect(isOpenNow(night, at('2026-10-21T10:00:00Z'))).toBe(false); // 15:00
  });

  it('вне часов работы заказ блокируется', async () => {
    // окно работы, которое заведомо не включает «сейчас»: берём час, отстоящий на 12 часов
    const hh = (new Date().getUTCHours() + 5 + 12) % 24;
    const open = `${String(hh).padStart(2, '0')}:00`;
    const close = `${String(hh).padStart(2, '0')}:30`;
    await c.db.query(`UPDATE settings SET value = $1::jsonb WHERE key='hours'`, [JSON.stringify({ enabled: true, open, close, tz: 'Asia/Qyzylorda' })]);
    const cro = await item('Круассан классический');
    const r = await c.http.post('/api/orders').send({ type: 'pickup', phone: '87011234567', payment_method: 'cash', items: [{ item_id: cro.id, qty: 1 }] }).expect(409);
    expect(r.body.code).toBe('closed');
    await c.db.query(`UPDATE settings SET value = '{"enabled":false}'::jsonb WHERE key='hours'`);
  });
});

describe('admin: заказы и зал', () => {
  it('требует вход; сотрудник видит заказы, меняет статус; зал показывает занятый стол', async () => {
    await c.http.get('/api/admin/orders').expect(401);
    const list = await c.http.get('/api/admin/orders?status=active').set(auth(c.staffToken)).expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    const dine = list.body.find((o: any) => o.type === 'dine_in');
    await c.http.patch(`/api/admin/orders/${dine.id}/status`).set(auth(c.staffToken)).send({ status: 'preparing' }).expect(200);
    await c.http.patch(`/api/admin/orders/${dine.id}/status`).set(auth(c.staffToken)).send({ status: 'bogus' }).expect(400);
    const hall = await c.http.get('/api/admin/hall').set(auth(c.staffToken)).expect(200);
    const t = hall.body.find((x: any) => x.number === dine.table_number);
    expect(t.busy).toBe(true);
    expect(hall.body.some((x: any) => !x.busy)).toBe(true);
  });

  it('сотрудник не может редактировать меню и смотреть отчёты', async () => {
    await c.http.get('/api/admin/menu').set(auth(c.staffToken)).expect(403);
    await c.http.get('/api/admin/reports').set(auth(c.staffToken)).expect(403);
    await c.http.get('/api/admin/settings').set(auth(c.staffToken)).expect(403);
  });
});

describe('авторизация', () => {
  it('неверный пароль → 401, верный → токен', async () => {
    await c.http.post('/api/auth/login').send({ username: 'admin', password: 'wrong' }).expect(401);
    await c.http.post('/api/auth/login').send({ username: 'ghost', password: 'wrong' }).expect(401);
    const ok = await c.http.post('/api/auth/login').send({ username: 'admin', password: 'password123' }).expect(200);
    expect(ok.body.user.role).toBe('admin');
    await c.http.get('/api/auth/me').set(auth(ok.body.token)).expect(200);
    await c.http.get('/api/auth/me').set(auth('garbage')).expect(401);
  });
});

describe('столы и QR', () => {
  it('создаёт стол, выдаёт ссылку и PNG/SVG QR', async () => {
    const t = await c.http.post('/api/admin/tables').set(auth(c.adminToken)).send({ number: 42 }).expect(201);
    expect(t.body.link).toContain(`?t=${t.body.code}`);
    await c.http.post('/api/admin/tables').set(auth(c.adminToken)).send({ number: 42 }).expect(409);
    const png = await c.http.get(`/api/admin/tables/${t.body.id}/qr`).set(auth(c.adminToken)).expect(200);
    expect(png.headers['content-type']).toContain('image/png');
    expect(Buffer.from(png.body).subarray(1, 4).toString()).toBe('PNG');
    const svg = await c.http
      .get(`/api/admin/tables/${t.body.id}/qr?format=svg`)
      .set(auth(c.adminToken))
      .buffer(true)
      .parse((res, cb) => {
        let d = '';
        res.on('data', (chunk) => (d += chunk));
        res.on('end', () => cb(null, d));
      })
      .expect(200);
    expect(svg.headers['content-type']).toContain('image/svg+xml');
    expect(String(svg.body)).toContain('<svg');
    const pub = await c.http.get(`/api/tables/${t.body.code}`).expect(200);
    expect(pub.body.number).toBe(42);
    await c.http.get('/api/tables/unknown').expect(404);
  });
});

describe('оплата', () => {
  it('онлайн: ссылка на оплату, подтверждение mock и вебхук с подписью', async () => {
    const cro = await item('Круассан классический');
    const o = await c.http
      .post('/api/orders')
      .send({ type: 'pickup', phone: '87011234567', payment_method: 'online', items: [{ item_id: cro.id, qty: 2 }] })
      .expect(201);
    expect(o.body.payment_status).toBe('pending');
    expect(o.body.payment_url).toContain('/pay/mock/');
    const ext = (await c.db.query('SELECT external_id FROM payments ORDER BY id DESC LIMIT 1')).rows[0].external_id as string;

    // вебхук без подписи / с неверной подписью отклоняется
    const body = JSON.stringify({ external_id: ext, status: 'paid' });
    await c.http.post('/api/payments/webhook').set('Content-Type', 'text/plain').send(body).expect(401);
    await c.http.post('/api/payments/webhook').set('Content-Type', 'text/plain').set('x-signature', 'bad').send(body).expect(401);
    await c.http.post('/api/payments/webhook').set('Content-Type', 'text/plain').set('x-signature', signWebhook(body)).send(body).expect(200);
    expect((await c.http.get(`/api/orders/${o.body.public_id}`)).body.payment_status).toBe('paid');
  });

  it('демо-подтверждение работает только для mock', async () => {
    const cro = await item('Круассан классический');
    await c.http.post('/api/orders').send({ type: 'pickup', phone: '87011234567', payment_method: 'online', items: [{ item_id: cro.id, qty: 1 }] }).expect(201);
    const ext = (await c.db.query('SELECT external_id FROM payments ORDER BY id DESC LIMIT 1')).rows[0].external_id as string;
    await c.http.post(`/api/payments/mock/${ext}/confirm`).expect(200);
    await c.http.post('/api/payments/mock/real_123/confirm').expect(400);
  });

  it('отключённый способ оплаты отклоняется', async () => {
    await c.http.put('/api/admin/settings').set(auth(c.adminToken)).send({ payments: { cash: true, card_terminal: true, kaspi: true, online: false } }).expect(200);
    const cro = await item('Круассан классический');
    const r = await c.http.post('/api/orders').send({ type: 'pickup', phone: '87011234567', payment_method: 'online', items: [{ item_id: cro.id, qty: 1 }] }).expect(400);
    expect(r.body.code).toBe('payment_disabled');
    await c.http.put('/api/admin/settings').set(auth(c.adminToken)).send({ payments: { cash: true, card_terminal: true, kaspi: true, online: true } }).expect(200);
  });
});

describe('смены, касса, отчёты', () => {
  it('смена: открыть → продажи → внесение/изъятие → закрыть с расхождением', async () => {
    await c.http.post('/api/admin/shifts/close').set(auth(c.staffToken)).send({ closing_cash: 0 }).expect(409);
    await c.http.post('/api/admin/shifts/open').set(auth(c.staffToken)).send({ opening_cash: 5000 }).expect(201);
    await c.http.post('/api/admin/shifts/open').set(auth(c.staffToken)).send({ opening_cash: 1 }).expect(409);

    const cro = await item('Круассан классический');
    const o = await c.http.post('/api/orders').send({ type: 'pickup', phone: '87011234567', payment_method: 'cash', items: [{ item_id: cro.id, qty: 2 }] }).expect(201);
    const id = (await c.db.query('SELECT id FROM orders WHERE public_id=$1', [o.body.public_id])).rows[0].id;
    await c.http.patch(`/api/admin/orders/${id}/payment`).set(auth(c.staffToken)).send({ payment_status: 'paid' }).expect(200);
    await c.http.post('/api/admin/shifts/cash').set(auth(c.staffToken)).send({ kind: 'out', amount: 1000, note: 'молоко' }).expect(201);
    const cur = await c.http.get('/api/admin/shifts/current').set(auth(c.staffToken)).expect(200);
    expect(cur.body.expected_cash).toBe(5000 + cro.price * 2 - 1000);
    const closed = await c.http.post('/api/admin/shifts/close').set(auth(c.staffToken)).send({ closing_cash: 5000 + cro.price * 2 - 1000 - 200 }).expect(200);
    expect(closed.body.difference).toBe(-200);
    expect((await c.http.get('/api/admin/shifts/current').set(auth(c.staffToken))).body).toBeNull();
  });

  it('отчёт считает выручку без отменённых и отдаёт CSV', async () => {
    const before = await c.http.get('/api/admin/reports').set(auth(c.adminToken)).expect(200);
    expect(before.body.orders).toBeGreaterThan(0);
    expect(before.body.top_items.length).toBeGreaterThan(0);
    expect(before.body.by_type.length).toBeGreaterThan(0);

    const cro = await item('Круассан классический');
    const o = await c.http.post('/api/orders').send({ type: 'pickup', phone: '87011234567', payment_method: 'cash', items: [{ item_id: cro.id, qty: 3 }] }).expect(201);
    const id = (await c.db.query('SELECT id FROM orders WHERE public_id=$1', [o.body.public_id])).rows[0].id;
    const mid = await c.http.get('/api/admin/reports').set(auth(c.adminToken));
    expect(mid.body.revenue).toBe(before.body.revenue + cro.price * 3);
    await c.http.patch(`/api/admin/orders/${id}/status`).set(auth(c.adminToken)).send({ status: 'cancelled' }).expect(200);
    const after = await c.http.get('/api/admin/reports').set(auth(c.adminToken));
    expect(after.body.revenue).toBe(before.body.revenue);

    const csv = await c.http.get('/api/admin/reports/export.csv').set(auth(c.adminToken)).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('payment_method');
  });
});

describe('админка меню и настройки', () => {
  it('создаёт позицию с модификаторами и обновляет настройки с валидацией', async () => {
    const cat = (await c.db.query('SELECT id FROM categories LIMIT 1')).rows[0].id;
    const created = await c.http
      .post('/api/admin/items')
      .set(auth(c.adminToken))
      .send({
        category_id: cat,
        name_ru: 'Тест-латте',
        price: 999,
        groups: [{ name_ru: 'Сироп', modifiers: [{ name_ru: 'Мята', price_delta: 100 }] }],
      })
      .expect(201);
    const menu = await c.http.get('/api/menu');
    const found = menu.body.categories.flatMap((x: any) => x.items).find((i: any) => i.id === created.body.id);
    expect(found.groups[0].modifiers[0].price_delta).toBe(100);
    await c.http.put('/api/admin/settings').set(auth(c.adminToken)).send({ whatsapp_phone: 'abc' }).expect(400);
    const s = await c.http.put('/api/admin/settings').set(auth(c.adminToken)).send({ whatsapp_phone: '77011234567', delivery: { enabled: true, fee: 500, free_from: 0, min_order: 0 } }).expect(200);
    expect(s.body.whatsapp_phone).toBe('77011234567');
    const o = await c.http.post('/api/orders').send({ type: 'pickup', phone: '87011234567', payment_method: 'cash', items: [{ item_id: created.body.id, qty: 1 }] }).expect(201);
    expect(o.body.whatsapp.url).toContain('wa.me/77011234567');
  });
});
