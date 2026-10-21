export interface WaOrder {
  number: number;
  type: 'dine_in' | 'delivery' | 'pickup';
  tableNumber?: number | null;
  customerName: string;
  phone: string;
  address?: { street?: string; house?: string; apt?: string; landmark?: string } | null;
  comment: string;
  paymentMethod: 'cash' | 'card_terminal' | 'kaspi' | 'online';
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  scheduledFor?: string | null;
  items: { name: string; qty: number; unitPrice: number; modifiers: { name: string }[]; comment: string }[];
}

const T = {
  ru: {
    order: 'Заказ',
    dine_in: 'В зале',
    delivery: 'Доставка',
    pickup: 'Самовывоз',
    table: 'Стол',
    name: 'Имя',
    phone: 'Телефон',
    address: 'Адрес',
    landmark: 'Ориентир',
    comment: 'Комментарий',
    pay: 'Оплата',
    cash: 'Наличными',
    card_terminal: 'Картой на месте',
    kaspi: 'Kaspi',
    online: 'Онлайн',
    paid: 'оплачено',
    unpaid: 'не оплачено',
    pending: 'ожидает оплаты',
    failed: 'ошибка оплаты',
    delivery_fee: 'Доставка',
    total: 'Итого',
    time: 'Ко времени',
  },
  kk: {
    order: 'Тапсырыс',
    dine_in: 'Залда',
    delivery: 'Жеткізу',
    pickup: 'Өзі алып кету',
    table: 'Үстел',
    name: 'Аты',
    phone: 'Телефон',
    address: 'Мекенжай',
    landmark: 'Бағдар',
    comment: 'Пікір',
    pay: 'Төлем',
    cash: 'Қолма-қол',
    card_terminal: 'Картамен (орнында)',
    kaspi: 'Kaspi',
    online: 'Онлайн',
    paid: 'төленді',
    unpaid: 'төленбеді',
    pending: 'төлем күтілуде',
    failed: 'төлем қатесі',
    delivery_fee: 'Жеткізу',
    total: 'Барлығы',
    time: 'Уақыты',
  },
} as const;

export const fmt = (n: number) => `${n.toLocaleString('ru-RU').replace(/ /g, ' ')} ₸`;

/** Текст сообщения для WhatsApp. */
export function buildWhatsAppText(o: WaOrder, lang: 'ru' | 'kk' = 'ru'): string {
  const t = T[lang];
  const lines: string[] = [];
  lines.push(`☕ *${t.order} №${o.number}* — ${t[o.type]}${o.type === 'dine_in' && o.tableNumber ? ` (${t.table} ${o.tableNumber})` : ''}`);
  lines.push('');
  for (const it of o.items) {
    const mods = it.modifiers.length ? ` (${it.modifiers.map((m) => m.name).join(', ')})` : '';
    lines.push(`• ${it.name}${mods} × ${it.qty} = ${fmt(it.unitPrice * it.qty)}`);
    if (it.comment) lines.push(`   ↳ ${it.comment}`);
  }
  lines.push('');
  if (o.deliveryFee > 0) lines.push(`${t.delivery_fee}: ${fmt(o.deliveryFee)}`);
  lines.push(`*${t.total}: ${fmt(o.total)}*`);
  lines.push(`${t.pay}: ${t[o.paymentMethod]} (${t[o.paymentStatus as 'paid' | 'unpaid' | 'pending' | 'failed'] ?? o.paymentStatus})`);
  if (o.customerName) lines.push(`${t.name}: ${o.customerName}`);
  if (o.phone) lines.push(`${t.phone}: ${o.phone}`);
  if (o.type === 'delivery' && o.address) {
    const a = o.address;
    const addr = [a.street, a.house && `д. ${a.house}`, a.apt && `кв. ${a.apt}`].filter(Boolean).join(', ');
    lines.push(`${t.address}: ${addr}`);
    if (a.landmark) lines.push(`${t.landmark}: ${a.landmark}`);
  }
  if (o.scheduledFor) lines.push(`${t.time}: ${o.scheduledFor}`);
  if (o.comment) lines.push(`${t.comment}: ${o.comment}`);
  return lines.join('\n');
}

export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
