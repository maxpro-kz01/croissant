/**
 * Напитки кафе Croissant: раф, кофе, холодный кофе, матча, чай, лимонады, смузи, фреши, милкшейки.
 * Добавляются в уже существующее меню при старте (syncDrinks), ничего не затирая.
 */
export type DrinkOption = { ru: string; kk: string; delta: number };
export type Drink = {
  name: string;
  price: number;
  image: string;
  weight?: string;
  desc?: string;
  /** Обязательная группа выбора (объём, вкус): первый вариант выбран по умолчанию. */
  group?: { ru: string; kk: string; options: DrinkOption[] };
};
export type DrinkCategory = { ru: string; kk: string; items: Drink[] };

const teaSize = (litre: number): DrinkOption[] => [
  { ru: '0,4 л', kk: '0,4 л', delta: 0 },
  { ru: '1 л', kk: '1 л', delta: litre },
];

const tea = (name: string, small: number, big: number, image: string): Drink => ({
  name,
  price: small,
  image: `/menu/drinks/${image}.jpg`,
  group: { ru: 'Объём', kk: 'Көлемі', options: teaSize(big - small) },
});

/** Напиток одного объёма 0,4 л (без выбора). */
const small = (name: string, price: number, image: string): Drink => ({
  name,
  price,
  weight: '0,4 л',
  image: `/menu/drinks/${image}.jpg`,
});

/** Горячий напиток с выбором объёма 300 / 400 мл. */
const cup = (name: string, p300: number, p400: number, image: string): Drink => ({
  name,
  price: p300,
  image: `/menu/drinks/${image}.jpg`,
  group: {
    ru: 'Объём',
    kk: 'Көлемі',
    options: [
      { ru: '300 мл', kk: '300 мл', delta: 0 },
      { ru: '400 мл', kk: '400 мл', delta: p400 - p300 },
    ],
  },
});

/** Напиток одного объёма с произвольной подписью объёма. */
const one = (name: string, price: number, weight: string, image: string): Drink => ({
  name,
  price,
  weight,
  image: `/menu/drinks/${image}.jpg`,
});

export const CROISSANT_DRINKS: DrinkCategory[] = [
  {
    ru: 'Раф',
    kk: 'Раф',
    items: [
      one('Раф классический', 1490, '300 мл', 'raf-classic'),
      { name: 'Раф фисташка-малина', price: 1690, image: '/menu/drinks/raf-pistachio-raspberry.jpg' },
      { name: 'Раф синнабон', price: 1690, image: '/menu/drinks/raf-cinnabon.jpg' },
      { name: 'Раф Урбеч', price: 1690, image: '/menu/drinks/raf-urbech.jpg' },
      { name: 'Раф Тары', price: 1690, image: '/menu/drinks/raf-tary.jpg' },
    ],
  },
  {
    ru: 'Кофе',
    kk: 'Кофе',
    items: [
      one('Эспрессо', 790, '360 мл', 'espresso'),
      one('Эспрессо доппио', 890, '600 мл', 'doppio'),
      cup('Американо', 990, 1090, 'americano'),
      cup('Капучино', 1190, 1390, 'cappuccino'),
      cup('Латте', 1190, 1390, 'latte'),
      one('Флэт уайт', 1190, '200 мл', 'flat-white'),
      one('Горячий шоколад', 1290, '300 мл', 'hot-chocolate'),
      one('Какао', 1290, '300 мл', 'cocoa'),
      one('Испанский латте Рошен', 1290, '300 мл', 'latte-rochen'),
      { name: 'Испанский латте фисташка', price: 2090, image: '/menu/drinks/latte-spanish-pistachio.jpg' },
      { name: 'Фисташковый джусси кофе', price: 2090, image: '/menu/drinks/juicy-pistachio.jpg' },
      { name: 'Капучино орео', price: 1290, image: '/menu/drinks/cappuccino-oreo.jpg' },
    ],
  },
  {
    ru: 'Холодный кофе',
    kk: 'Суық кофе',
    items: [
      small('Айс американо', 1290, 'ice-americano'),
      small('Айс латте', 1490, 'ice-latte'),
      small('Айс капучино', 1490, 'ice-cappuccino'),
      small('Банановый айс латте', 1890, 'banana-ice-latte'),
      small('Гляссе', 1890, 'glace'),
      small('Фраппучино классический', 1790, 'frappuccino-classic'),
      small('Фраппучино орео', 1990, 'frappuccino-oreo'),
      {
        name: 'Холодный эспрессо',
        price: 1690,
        weight: '0,4 л',
        image: '/menu/drinks/espresso-orange.jpg',
        group: {
          ru: 'Вкус',
          kk: 'Дәмі',
          options: [
            { ru: 'Апельсин', kk: 'Апельсин', delta: 0 },
            { ru: 'Вишня', kk: 'Шие', delta: 0 },
            { ru: 'Тропик', kk: 'Тропик', delta: 0 },
          ],
        },
      },
      { name: 'Тропик бабл', price: 1890, image: '/menu/drinks/tropic-bubble.jpg' },
      { name: 'Фраппучино банан', price: 1890, weight: '0,4 л', image: '/menu/drinks/frappe-banana.jpg' },
      { name: 'Черри бабл', price: 1690, image: '/menu/drinks/cherry-bubble.jpg' },
      {
        name: 'Тоник',
        price: 2390,
        image: '/menu/drinks/tonic.jpg',
        group: {
          ru: 'Вкус',
          kk: 'Дәмі',
          options: [
            { ru: 'Классик', kk: 'Классик', delta: 0 },
            { ru: 'Маракуя', kk: 'Маракуя', delta: 0 },
            { ru: 'Гранат', kk: 'Анар', delta: 0 },
          ],
        },
      },
    ],
  },
  {
    ru: 'Матча',
    kk: 'Матча',
    items: [
      small('Матча латте', 1390, 'matcha-latte'),
      small('Айс матча', 1890, 'matcha-ice'),
      small('Матча айс клубника', 2290, 'matcha-ice-strawberry'),
      small('Матча айс манго', 2290, 'matcha-ice-mango'),
      { name: 'Матча айс голубая', price: 1890, image: '/menu/drinks/matcha-ice-blue.jpg' },
      { name: 'Матча голубая', price: 1390, image: '/menu/drinks/matcha-blue.jpg' },
      { name: 'Матча айс кокос', price: 2290, image: '/menu/drinks/matcha-ice-coconut.jpg' },
    ],
  },
  {
    ru: 'Чай',
    kk: 'Шай',
    items: [
      tea('Чёрный чай', 690, 1190, 'tea-black'),
      tea('Зелёный чай', 690, 1190, 'tea-green'),
      tea('Имбирный чай', 990, 1890, 'tea-ginger'),
      tea('Апельсиновый чай', 990, 1890, 'tea-orange'),
      tea('Фруктовый чай', 990, 1890, 'tea-fruit'),
      tea('Цитрусовый чай', 990, 1890, 'tea-citrus'),
      tea('Облепиховый чай', 1190, 1890, 'tea-seabuckthorn'),
      tea('Тары чай', 990, 1890, 'tea-tary'),
      tea('Ташкентский чай', 990, 1890, 'tea-tashkent'),
      tea('Лечебный чай', 990, 1890, 'tea-healing'),
      tea('Масала', 1190, 2390, 'tea-masala'),
      tea('Карак чай', 1190, 2390, 'tea-karak'),
      tea('Яблоко-киви чай', 990, 1890, 'tea-apple-kiwi'),
      tea('Тропический чай', 990, 1890, 'tea-tropical'),
      tea('Марокканский чай', 990, 1890, 'tea-moroccan'),
      tea('Глинтвейн', 1190, 2390, 'tea-glintwein'),
    ],
  },
  {
    ru: 'Лимонады',
    kk: 'Лимонадтар',
    items: [
      tea('Мохито', 1390, 2590, 'lemonade-mojito'),
      tea('Клубничный мохито', 1390, 2590, 'lemonade-strawberry-mojito'),
      tea('Манго-маракуйя', 1390, 2590, 'lemonade-mango-passion'),
      tea('Лимонад тропик', 1390, 2590, 'lemonade-tropic'),
      tea('Цитрусовая свежесть', 1390, 2590, 'lemonade-citrus'),
      tea('Киви-лайм', 1390, 2590, 'lemonade-kiwi-lime'),
      tea('Ягодный лимонад', 1390, 2590, 'lemonade-berry'),
      tea('Чиа маракуя', 1390, 2590, 'lemonade-chia-passion'),
    ],
  },
  {
    ru: 'Фруктовые напитки',
    kk: 'Жеміс сусындары',
    items: [
      small('Манго колада', 2190, 'fruit-mango-colada'),
      small('Ягодный с мороженым', 2190, 'fruit-berry-icecream'),
      small('Малина банан', 2190, 'fruit-raspberry-banana'),
    ],
  },
  {
    ru: 'Милкшейки',
    kk: 'Милкшейктер',
    items: [
      small('Милкшейк клубничный', 1990, 'milkshake-strawberry'),
      small('Милкшейк карамельный банан', 1990, 'milkshake-caramel-banana'),
      small('Милкшейк радуга', 1990, 'milkshake-rainbow'),
      small('Милкшейк M&Ms', 1990, 'milkshake-mms'),
      small('Милкшейк орео', 1990, 'milkshake-oreo'),
      small('Милкшейк клубничный орео', 1990, 'milkshake-strawberry-oreo'),
    ],
  },
  {
    ru: 'Смузи',
    kk: 'Смузи',
    items: [
      small('Смузи манго-ананас', 2290, 'smoothie-mango-pineapple'),
      small('Смузи сливочный апельсин', 1690, 'smoothie-cream-orange'),
      small('Смузи банан-клубника', 2290, 'smoothie-banana-strawberry'),
      { name: 'Смузи ПП', price: 2290, image: '/menu/drinks/smoothie-pp.jpg' },
      small('Смузи ягодный', 2290, 'smoothie-berry'),
      small('Смузи банан-киви', 1990, 'smoothie-banana-kiwi'),
    ],
  },
  {
    ru: 'Juicy ball',
    kk: 'Juicy ball',
    items: [
      small('Juicy ball гранат', 1890, 'juicy-pomegranate'),
      small('Juicy ball ягодный', 1890, 'juicy-berry'),
      small('Juicy ball гранат №2', 1890, 'juicy-pomegranate-2'),
      small('Juicy ball цитрус', 1890, 'juicy-citrus'),
      small('Juicy ball тропик', 1890, 'juicy-tropic'),
    ],
  },
  {
    ru: 'Фреши',
    kk: 'Фреш',
    items: [
      small('Фреш яблоко', 1690, 'fresh-apple'),
      small('Фреш яблоко-апельсин', 1890, 'fresh-apple-orange'),
      small('Фреш апельсин', 2390, 'fresh-orange'),
    ],
  },
];

/**
 * Поправки цен у уже созданных позиций (по печатному меню). Применяются, только если цена
 * всё ещё старая: правки из админки не затираются.
 */
export const DRINK_PRICE_FIXES: { name: string; from: number; to: number; bigDelta: { from: number; to: number } }[] = [
  { name: 'Глинтвейн', from: 990, to: 1190, bigDelta: { from: 900, to: 1200 } },
];
