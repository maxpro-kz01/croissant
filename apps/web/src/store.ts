import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine, Lang, OrderType } from './types';

interface AppState {
  lang: Lang;
  mode: OrderType;
  tableCode: string | null;
  tableNumber: number | null;
  cart: CartLine[];
  setLang: (l: Lang) => void;
  setMode: (m: OrderType) => void;
  setTable: (code: string | null, number: number | null) => void;
  addLine: (line: Omit<CartLine, 'key'>) => void;
  changeQty: (key: string, delta: number) => void;
  clearCart: () => void;
}

const lineKey = (l: Omit<CartLine, 'key'>) =>
  `${l.item_id}|${[...l.modifier_ids].sort((a, b) => a - b).join(',')}|${l.comment.trim().toLowerCase()}`;

function detectLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('kk') ? 'kk' : 'ru';
  } catch {
    return 'ru';
  }
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      lang: detectLang(),
      mode: 'pickup',
      tableCode: null,
      tableNumber: null,
      cart: [],
      setLang: (lang) => set({ lang }),
      setMode: (mode) => set({ mode }),
      setTable: (tableCode, tableNumber) =>
        set(tableCode ? { tableCode, tableNumber, mode: 'dine_in' } : { tableCode: null, tableNumber: null, mode: 'pickup' }),
      addLine: (line) =>
        set((s) => {
          const key = lineKey(line);
          const found = s.cart.find((c) => c.key === key);
          if (found) return { cart: s.cart.map((c) => (c.key === key ? { ...c, qty: Math.min(50, c.qty + line.qty) } : c)) };
          return { cart: [...s.cart, { ...line, key }] };
        }),
      changeQty: (key, delta) =>
        set((s) => ({
          cart: s.cart.flatMap((c) => {
            if (c.key !== key) return [c];
            const qty = c.qty + delta;
            return qty <= 0 ? [] : [{ ...c, qty: Math.min(50, qty) }];
          }),
        })),
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'croissant-app',
      partialize: (s) => ({ lang: s.lang, mode: s.mode, tableCode: s.tableCode, tableNumber: s.tableNumber, cart: s.cart }),
    },
  ),
);

export const cartCount = (cart: CartLine[]) => cart.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = (cart: CartLine[]) => cart.reduce((n, l) => n + l.qty * l.unit_price, 0);
