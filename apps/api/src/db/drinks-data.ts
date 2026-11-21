/**
 * Напитки кафе Croissant: раф, кофе, холодный кофе, чай, смузи.
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

export const CROISSANT_DRINKS: DrinkCategory[] = [
  {
    ru: 'Раф',
    kk: 'Раф',
    items: [
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
      { name: 'Испанский латте фисташка', price: 2090, image: '/menu/drinks/latte-spanish-pistachio.jpg' },
      { name: 'Фисташковый джусси кофе', price: 2090, image: '/menu/drinks/juicy-pistachio.jpg' },
      { name: 'Капучино орео', price: 1290, image: '/menu/drinks/cappuccino-oreo.jpg' },
    ],
  },
  {
    ru: 'Холодный кофе',
    kk: 'Суық кофе',
    items: [
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
      { name: 'Матча айс голубая', price: 1890, image: '/menu/drinks/matcha-ice-blue.jpg' },
      { name: 'Матча голубая', price: 1390, image: '/menu/drinks/matcha-blue.jpg' },
      { name: 'Матча айс кокос', price: 2290, image: '/menu/drinks/matcha-ice-coconut.jpg' },
    ],
  },
  {
    ru: 'Чай',
    kk: 'Шай',
    items: [
      tea('Ташкентский чай', 990, 1890, 'tea-tashkent'),
      tea('Лечебный чай', 990, 1890, 'tea-healing'),
      tea('Масала', 1190, 2390, 'tea-masala'),
      tea('Карак чай', 1190, 2390, 'tea-karak'),
      tea('Яблоко-киви чай', 990, 1890, 'tea-apple-kiwi'),
      tea('Тропический чай', 990, 1890, 'tea-tropical'),
      tea('Марокканский чай', 990, 1890, 'tea-moroccan'),
      tea('Глинтвейн', 990, 1890, 'tea-glintwein'),
    ],
  },
  {
    ru: 'Лимонады',
    kk: 'Лимонадтар',
    items: [
      tea('Клубничный мохито', 1390, 2590, 'lemonade-strawberry-mojito'),
      tea('Ягодный лимонад', 1390, 2590, 'lemonade-berry'),
      tea('Чиа маракуя', 1390, 2590, 'lemonade-chia-passion'),
    ],
  },
  {
    ru: 'Фруктовые напитки',
    kk: 'Жеміс сусындары',
    items: [small('Ягодный с мороженым', 2190, 'fruit-berry-icecream')],
  },
  {
    ru: 'Милкшейки',
    kk: 'Милкшейктер',
    items: [
      small('Милкшейк орео', 1990, 'milkshake-oreo'),
      small('Милкшейк клубничный орео', 1990, 'milkshake-strawberry-oreo'),
    ],
  },
  {
    ru: 'Смузи',
    kk: 'Смузи',
    items: [
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
];
