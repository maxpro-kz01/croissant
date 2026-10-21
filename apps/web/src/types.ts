export type Lang = 'ru' | 'kk';
export type OrderType = 'dine_in' | 'delivery' | 'pickup';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'done' | 'cancelled';
export type PaymentMethod = 'cash' | 'card_terminal' | 'kaspi' | 'online';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed';

export interface Modifier {
  id: number;
  name_ru: string;
  name_kk: string;
  price_delta: number;
}
export interface ModifierGroup {
  id: number;
  name_ru: string;
  name_kk: string;
  required: boolean;
  multi: boolean;
  modifiers: Modifier[];
}
export interface MenuItem {
  id: number;
  category_id: number;
  name_ru: string;
  name_kk: string;
  desc_ru: string;
  desc_kk: string;
  price: number;
  weight: string;
  image_url: string;
  available: boolean;
  popular: boolean;
  sort: number;
  groups: ModifierGroup[];
}
export interface Category {
  id: number;
  name_ru: string;
  name_kk: string;
  sort: number;
  active: boolean;
  items: MenuItem[];
}
export interface Banner {
  id: number;
  title_ru: string;
  title_kk: string;
  text_ru: string;
  text_kk: string;
  image_url: string;
  active: boolean;
  sort: number;
}
export interface PublicSettings {
  brand: { name: string; instagram: string; address: string; phone: string };
  hours: { enabled: boolean; open: string; close: string; tz: string };
  delivery: { enabled: boolean; fee: number; free_from: number; min_order: number };
  pickup_enabled: boolean;
  payments: Record<PaymentMethod, boolean>;
  whatsapp_phone: string;
}
export interface MenuResponse {
  categories: Category[];
  banners: Banner[];
  settings: PublicSettings;
  is_open: boolean;
}

export interface CartLine {
  key: string;
  item_id: number;
  name_ru: string;
  name_kk: string;
  unit_price: number;
  qty: number;
  modifier_ids: number[];
  modifier_names_ru: string[];
  modifier_names_kk: string[];
  comment: string;
}

export interface PlacedOrder {
  public_id: string;
  number: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  delivery_fee: number;
  payment_url: string | null;
  whatsapp: { text: string; url: string };
}

export interface OrderStatusView {
  public_id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total: number;
  table_number: number | null;
  items: { name: string; qty: number }[];
}

/** Заказ в админке */
export interface AdminOrder {
  id: number;
  public_id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  table_id: number | null;
  table_number: number | null;
  customer_name: string;
  phone: string;
  address: { street?: string; house?: string; apt?: string; landmark?: string } | null;
  comment: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  items: { id: number; name: string; qty: number; unit_price: number; modifiers: { name: string }[]; comment: string }[];
}
