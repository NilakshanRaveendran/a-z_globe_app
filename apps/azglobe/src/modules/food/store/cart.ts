import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createStorage } from '@core/storage';
import type { CartLine, MenuItem, Money, SelectedOption } from '../types';

const storage = createStorage({ id: 'azglobe.food.cart' });

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => {
    storage.remove(name);
  },
};

/** The stepper's ceiling — quick adds must not push a line past it either. */
export const MAX_LINE_QTY = 99;

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

/**
 * How the customer gets the order: brought to them, or collected (takeaway).
 * What delivery costs is services/deliveryPricing.ts `quoteDelivery`.
 */
export type Fulfilment = 'delivery' | 'pickup';

/** One restaurant's share of the cart — what becomes one order. */
export type CartGroup = {
  merchantId: string;
  merchantName: string;
  lines: CartLine[];
  subtotal: Money;
  itemCount: number;
};

/**
 * The cart split by restaurant, in the order each was first added to. Every
 * group is placed as its own order (each restaurant prepares and is paid for
 * its own); Cart and Checkout show them together and take one payment.
 */
export function cartGroups(lines: CartLine[]): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  for (const line of lines) {
    const group = groups.get(line.merchantId) ?? {
      merchantId: line.merchantId,
      merchantName: line.merchantName ?? 'Restaurant',
      lines: [],
      subtotal: 0,
      itemCount: 0,
    };
    group.lines.push(line);
    group.subtotal += line.unitPrice * line.qty;
    group.itemCount += line.qty;
    groups.set(line.merchantId, group);
  }
  return [...groups.values()];
}

type CartState = {
  /** Dishes from any number of restaurants — see `cartGroups`. */
  lines: CartLine[];
  /** Delivery or takeaway, per restaurant. Missing means delivery. */
  fulfilment: Record<string, Fulfilment>;
  /**
   * A promo code the customer typed (uppercased — it is the promotion's
   * document id) and the restaurant in the cart it was applied to. The
   * discount itself is NOT stored: `useCartPromotions` recomputes it.
   */
  promoCode: string | null;
  promoMerchantId: string | null;

  add: (item: MenuItem, options: SelectedOption[], qty: number) => void;
  /** Quick-add from a card: takes the required options' first choice. */
  addFromMenuItem: (item: MenuItem) => void;
  setQty: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  /** Empty the cart, or just these restaurants (the ones whose orders went through). */
  clear: (merchantIds?: string[]) => void;
  setFulfilment: (merchantId: string, fulfilment: Fulfilment) => void;
  applyPromo: (code: string, merchantId: string) => void;
  clearPromo: () => void;

  subtotal: () => Money;
  itemCount: () => number;
};

/** Drops a promo code whose restaurant has left the cart. */
function withPromo(lines: CartLine[], promoMerchantId: string | null) {
  return promoMerchantId && !lines.some((l) => l.merchantId === promoMerchantId)
    ? { promoCode: null, promoMerchantId: null }
    : {};
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      fulfilment: {},
      promoCode: null,
      promoMerchantId: null,

      add: (item, options, qty) =>
        set((state) => {
          const lines = [...state.lines];
          const lineId = lineIdFor(item.id, options);
          const existing = lines.findIndex((l) => l.lineId === lineId);
          if (existing >= 0) {
            const prev = lines[existing]!;
            lines[existing] = { ...prev, qty: Math.min(MAX_LINE_QTY, prev.qty + qty) };
          } else {
            lines.push({
              lineId,
              menuItemId: item.id,
              merchantId: item.merchantId,
              merchantName: item.merchantName,
              name: item.name,
              image: item.image,
              qty: Math.min(MAX_LINE_QTY, qty),
              unitPrice: unitPriceFor(item.price, options),
              selectedOptions: options,
            });
          }
          return { lines };
        }),

      addFromMenuItem: (item) => {
        const defaults: SelectedOption[] = item.optionGroups
          .filter((g) => g.type === 'single' && (g.required || g.defaultChoiceId))
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

      setQty: (lineId, qty) => {
        // Stepping a line to zero removes it, exactly as the trash button does.
        if (qty <= 0) return get().remove(lineId);
        set((state) => ({
          lines: state.lines.map((l) =>
            l.lineId === lineId ? { ...l, qty: Math.min(MAX_LINE_QTY, qty) } : l
          ),
        }));
      },

      remove: (lineId) =>
        set((state) => {
          const lines = state.lines.filter((l) => l.lineId !== lineId);
          return { lines, ...withPromo(lines, state.promoMerchantId) };
        }),

      clear: (merchantIds) =>
        set((state) => {
          if (!merchantIds) return { lines: [], promoCode: null, promoMerchantId: null };
          const lines = state.lines.filter((l) => !merchantIds.includes(l.merchantId));
          return { lines, ...withPromo(lines, state.promoMerchantId) };
        }),

      setFulfilment: (merchantId, fulfilment) =>
        set((state) => ({ fulfilment: { ...state.fulfilment, [merchantId]: fulfilment } })),

      applyPromo: (code, merchantId) =>
        set({ promoCode: code.trim().toUpperCase() || null, promoMerchantId: merchantId }),
      clearPromo: () => set({ promoCode: null, promoMerchantId: null }),

      subtotal: () => get().lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
      itemCount: () => get().lines.reduce((sum, l) => sum + l.qty, 0),
    }),
    {
      name: 'cart',
      version: 2,
      storage: createJSONStorage(() => mmkvStorage),
      // v1 held one restaurant: its name on the cart, one fulfilment for all.
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as {
          merchantId?: string | null;
          merchantName?: string | null;
          lines?: CartLine[];
          promoCode?: string | null;
          fulfilment?: Fulfilment | Record<string, Fulfilment>;
        };
        if (version >= 2) return persisted as CartState;
        const lines = (old.lines ?? []).map((l) => ({ ...l, merchantName: l.merchantName ?? old.merchantName ?? undefined }));
        return {
          lines,
          fulfilment:
            typeof old.fulfilment === 'string' && old.merchantId ? { [old.merchantId]: old.fulfilment } : {},
          promoCode: old.promoCode ?? null,
          promoMerchantId: old.promoCode ? (old.merchantId ?? null) : null,
        } as unknown as CartState;
      },
      // Only the data is persisted; the actions are re-created on rehydrate.
      partialize: (s) => ({
        lines: s.lines,
        fulfilment: s.fulfilment,
        promoCode: s.promoCode,
        promoMerchantId: s.promoMerchantId,
      }),
    }
  )
);
