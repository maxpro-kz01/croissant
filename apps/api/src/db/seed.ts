import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { migrate } from './migrate.js';
import { createPool, type Db } from './pool.js';
import { randomId } from '../utils/http.js';

/** Создаёт первого администратора, если пользователей ещё нет. */
export async function seedAdmin(db: Db) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return false;
  const hash = await bcrypt.hash(env.adminPassword, 10);
  await db.query(`INSERT INTO users(username, password_hash, role) VALUES ($1, $2, 'admin')`, [env.adminUsername, hash]);
  return true;
}

type Mod = [string, string, number];
type Group = { ru: string; kk: string; required?: boolean; multi?: boolean; mods: Mod[] };
type Item = { ru: string; kk: string; dru: string; dkk: string; price: number; weight?: string; popular?: boolean; groups?: Group[] };

const SIZE: Group = { ru: 'Размер', kk: 'Көлемі', required: true, mods: [['250 мл', '250 мл', 0], ['350 мл', '350 мл', 300], ['450 мл', '450 мл', 600]] };
const MILK: Group = {
  ru: 'Молоко',
  kk: 'Сүт',
  mods: [['Обычное', 'Кәдімгі', 0], ['Овсяное', 'Сұлы', 350], ['Миндальное', 'Бадам', 400], ['Безлактозное', 'Лактозасыз', 300]],
};
const SYRUP: Group = {
  ru: 'Сироп',
  kk: 'Сироп',
  multi: true,
  mods: [['Ваниль', 'Ваниль', 200], ['Карамель', 'Карамель', 200], ['Лесной орех', 'Орман жаңғағы', 200]],
};

/** ДЕМО-меню. Реальные позиции и цены вносятся в админке. */
const MENU: { ru: string; kk: string; items: Item[] }[] = [
  {
    ru: 'Кофе',
    kk: 'Кофе',
    items: [
      { ru: 'Капучино', kk: 'Капучино', dru: 'Эспрессо, молоко и плотная молочная пена', dkk: 'Эспрессо, сүт және тығыз көбік', price: 1500, popular: true, groups: [SIZE, MILK, SYRUP] },
      { ru: 'Латте', kk: 'Латте', dru: 'Нежный кофе с большим количеством молока', dkk: 'Сүті мол жұмсақ кофе', price: 1600, popular: true, groups: [SIZE, MILK, SYRUP] },
      { ru: 'Американо', kk: 'Американо', dru: 'Эспрессо с горячей водой', dkk: 'Ыстық суы бар эспрессо', price: 1200, groups: [SIZE] },
      { ru: 'Флэт уайт', kk: 'Флэт уайт', dru: 'Двойной эспрессо и бархатное молоко', dkk: 'Қос эспрессо және барқыт сүт', price: 1700, groups: [MILK] },
      { ru: 'Раф', kk: 'Раф', dru: 'Сливочный кофе с ванильным сахаром', dkk: 'Ванильді қантты кілегейлі кофе', price: 1900, groups: [SIZE] },
    ],
  },
  {
    ru: 'Десерты',
    kk: 'Тәттілер',
    items: [
      { ru: 'Чизкейк Нью-Йорк', kk: 'Нью-Йорк чизкейк', dru: 'Классический чизкейк с ягодным соусом', dkk: 'Жидек тұздығы бар классикалық чизкейк', price: 2300, weight: '130 г', popular: true },
      { ru: 'Медовик', kk: 'Бал торты', dru: 'Нежные коржи и сметанный крем', dkk: 'Жұмсақ қабаттар және қаймақ кремі', price: 1900, weight: '140 г' },
      { ru: 'Тирамису', kk: 'Тирамису', dru: 'Маскарпоне, савоярди и кофе', dkk: 'Маскарпоне, савоярди және кофе', price: 2400, weight: '130 г' },
      { ru: 'Эклер ванильный', kk: 'Ванильді эклер', dru: 'Заварное тесто и ванильный крем', dkk: 'Ванильді кремі бар эклер', price: 1100, weight: '80 г' },
    ],
  },
  {
    ru: 'Выпечка',
    kk: 'Тоқаш',
    items: [
      { ru: 'Круассан классический', kk: 'Классикалық круассан', dru: 'Хрустящий, на французском масле', dkk: 'Француз майындағы қытырлақ круассан', price: 1100, weight: '70 г', popular: true },
      { ru: 'Круассан с миндалём', kk: 'Бадамды круассан', dru: 'Миндальный крем и лепестки миндаля', dkk: 'Бадам кремі және бадам жапырақшалары', price: 1600, weight: '110 г' },
      { ru: 'Круассан с шоколадом', kk: 'Шоколадты круассан', dru: 'С тёмным бельгийским шоколадом', dkk: 'Бельгиялық қара шоколадты', price: 1500, weight: '100 г' },
      { ru: 'Синнабон', kk: 'Синнабон', dru: 'Булочка с корицей и сливочным кремом', dkk: 'Даршын мен кілегей кремді тоқаш', price: 1400, weight: '120 г' },
    ],
  },
  {
    ru: 'Завтраки',
    kk: 'Таңғы ас',
    items: [
      { ru: 'Сырники со сметаной', kk: 'Қаймақты сырник', dru: 'Три сырника, сметана, ягодный джем', dkk: 'Үш сырник, қаймақ, жидек джемі', price: 2400, weight: '220 г' },
      { ru: 'Яйцо бенедикт', kk: 'Бенедикт жұмыртқасы', dru: 'Пашот, бриошь, голландский соус', dkk: 'Пашот, бриошь, голланд тұздығы', price: 2900, weight: '240 г' },
    ],
  },
  {
    ru: 'Напитки',
    kk: 'Сусындар',
    items: [
      { ru: 'Лимонад домашний', kk: 'Үй лимонады', dru: 'Лимон, мята, газированная вода', dkk: 'Лимон, жалбыз, газдалған су', price: 1500, groups: [SIZE] },
      { ru: 'Чай чёрный', kk: 'Қара шай', dru: 'Чайник на двоих', dkk: 'Екі адамға шәйнек', price: 1300 },
      { ru: 'Горячий шоколад', kk: 'Ыстық шоколад', dru: 'Густой, на настоящем шоколаде', dkk: 'Шынайы шоколадтағы қою сусын', price: 1700 },
    ],
  },
];

export async function seedDemo(db: Db) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM categories');
  if (rows[0].n > 0) return false;
  let cs = 0;
  for (const cat of MENU) {
    const c = (await db.query('INSERT INTO categories(name_ru,name_kk,sort) VALUES ($1,$2,$3) RETURNING id', [cat.ru, cat.kk, cs++])).rows[0];
    let is = 0;
    for (const it of cat.items) {
      const row = (
        await db.query(
          `INSERT INTO menu_items(category_id,name_ru,name_kk,desc_ru,desc_kk,price,weight,popular,sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [c.id, it.ru, it.kk, it.dru, it.dkk, it.price, it.weight ?? '', it.popular ?? false, is++],
        )
      ).rows[0];
      let gs = 0;
      for (const g of it.groups ?? []) {
        const gr = (
          await db.query(
            `INSERT INTO modifier_groups(item_id,name_ru,name_kk,required,multi,sort) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [row.id, g.ru, g.kk, g.required ?? false, g.multi ?? false, gs++],
          )
        ).rows[0];
        let ms = 0;
        for (const [ru, kk, delta] of g.mods) {
          await db.query(`INSERT INTO modifiers(group_id,name_ru,name_kk,price_delta,sort) VALUES ($1,$2,$3,$4,$5)`, [gr.id, ru, kk, delta, ms++]);
        }
      }
    }
  }
  for (let n = 1; n <= 10; n++) {
    await db.query('INSERT INTO tables(number,label,code) VALUES ($1,$2,$3)', [n, '', randomId(8)]);
  }
  await db.query(
    `INSERT INTO banners(title_ru,title_kk,text_ru,text_kk,sort) VALUES
     ('Свежие круассаны каждое утро','Таңертең жаңа круассандар','Выпекаем с 8:00, пока ещё тёплые','Сағат 8:00-ден бастап ыстық күйінде',0),
     ('Кофе + десерт','Кофе + тәтті','Любой десерт и кофе — выгоднее вместе','Кез келген тәтті мен кофе — бірге тиімдірек',1)`,
  );
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const db = createPool();
  migrate(db)
    .then(async () => {
      const a = await seedAdmin(db);
      const d = await seedDemo(db);
      console.log(`Admin ${a ? 'created' : 'already exists'}; demo menu ${d ? 'created' : 'skipped (menu not empty)'}`);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
