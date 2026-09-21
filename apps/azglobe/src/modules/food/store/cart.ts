import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type { CartLine, MenuItem, Money, SelectedOption } from '../types';

const storage = createMMKV({ id: 'azglobe.food.cart' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => {
    storage.remove(name);
  },
};

/** Identical item + identical options stack onto one line. */
function lineIdFor(menuItemId: string, options: SelectedOption[]): string {
  const key = options
    .map((o) => `${o.groupKey}:${o.choiceId}`)
    .sort()
    .join('|');
  return key ? `${menuItemId}#${key}` : menuItemId;
}

export function unitPriceFor(basePrice: Money, options: SelectedOption[]): Money {
  return options.reduce((sum, o) => sum + o.priceDelta, basePrice);
}

type CartState = {
  /**
   * Figma's cart is headed "Your Cart / Mama's Kitchen" — one merchant at a
   * time. Adding from a different merchant replaces the cart.
   */
  merchantId: string | null;
  merchantName: string | null;
  lines: CartLine[];
  /**
   * A promo code the customer typed (uppercased — it is the promotion's
   * document id). The discount itself is NOT stored: `useAppliedPromotion`
   * recomputes it from the promotion and the current lines.
   */
  promoCode: string | null;

  add: (item: MenuItem, options: SelectedOption[], qty: number) => void;
  /** Quick-add from a card: takes the required options' first choice. */
  addFromMenuItem: (item: MenuItem) => void;
  setQty: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  applyPromo: (code: string) => void;
  clearPromo: () => void;

  subtotal: () => Money;
  itemCount: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      merchantId: null,
      merchantName: null,
      lines: [],
      promoCode: null,

      add: (item, options, qty) =>
        set((state) => {
          // Switching merchant starts a fresh cart, matching the single-merchant
          // cart the design shows.
          const switching = state.merchantId !== null && state.merchantId !== item.merchantId;
          const lines = switching ? [] : [...state.lines];

          const lineId = lineIdFor(item.id, options);
          const existing = lines.findIndex((l) => l.lineId === lineId);
          if (existing >= 0) {
            const prev = lines[existing]!;
            lines[existing] = { ...prev, qty: prev.qty + qty };
          } else {
            lines.push({
              lineId,
              menuItemId: item.id,
              merchantId: item.merchantId,
              name: item.name,
              image: item.image,
              qty,
              unitPrice: unitPriceFor(item.price, options),
              selectedOptions: options,
            });
          }

          return {
            lines,
            merchantId: item.merchantId,
            merchantName: item.merchantName,
            ...(switching ? { promoCode: null } : {}),
          };
        }),

      addFromMenuItem: (item) => {
        const defaults: SelectedOption[] = item.optionGroups
          .filter((g) => g.required && g.type === 'single')
          .flatMap((g) => {
            const choice = g.choices.find((c) => c.id === g.defaultChoiceId) ?? g.choices[0];
            return choice
              ? [
                  {
                    groupKey: g.key,
                    groupLabel: g.label,
                    choiceId: choice.id,
                    label: choice.label,
                    priceDelta: choice.priceDelta,
                  },
                ]
              : [];
          });
        get().add(item, defaults, 1);
      },

      setQty: (lineId, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => l.lineId !== lineId)
              : state.lines.map((l) => (l.lineId === lineId ? { ...l, qty } : l)),
        })),

      remove: (lineId) =>
        set((state) => {
          const lines = state.lines.filter((l) => l.lineId !== lineId);
          return lines.length
            ? { lines }
            : { lines, merchantId: null, merchantName: null, promoCode: null };
        }),

      clear: () =>
        set({ lines: [], merchantId: null, merchantName: null, promoCode: null }),

      applyPromo: (code) => set({ promoCode: code.trim().toUpperCase() || null }),
      clearPromo: () => set({ promoCode: null }),

      subtotal: () => get().lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
      itemCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),
    }),
    {
      name: 'cart',
      storage: createJSONStorage(() => mmkvStorage),
      // Only the data is persisted; the actions are re-created on rehydrate.
      partialize: (s) => ({
        merchantId: s.merchantId,
        merchantName: s.merchantName,
        lines: s.lines,
        promoCode: s.promoCode,
      }),
    }
  )
);
