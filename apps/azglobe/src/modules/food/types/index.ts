/**
 * Food module domain types.
 *
 * These mirror the Firestore documents described in the plan. Fields that list
 * screens render are denormalised onto `Merchant` so a restaurant card costs a
 * single document read.
 */

export type Money = number; // minor-unit-free LKR, as the design shows "Rs. 450"

export type GeoPoint = {
  lat: number;
  lng: number;
  /** Geohash for range queries — see `geofire-common`. */
  geohash: string;
};

export type MerchantFeature =
  | 'dineIn'
  | 'takeaway'
  | 'homeDelivery'
  | 'cards'
  | 'wifi'
  | 'familyFriendly';

export type DayHours = { open: string; close: string; closed?: boolean };

/**
 * A restaurant's own delivery terms.
 *
 *   flat      `deliveryFee` wherever it delivers
 *   distance  free within `freeKm`; past it `deliveryFee` (a base, may be 0)
 *             plus `perKm` for every km beyond the free zone, a part-km
 *             counting as a whole one
 *
 * `maxKm` caps the delivery area in either mode (0 = no limit). Distances are
 * straight-line from the restaurant's pin to the customer's pinned address.
 */
export type DeliveryRules = {
  pricing: 'flat' | 'distance';
  freeKm: number;
  perKm: Money;
  maxKm: number;
};

export type Merchant = {
  id: string;
  module: 'food';
  /**
   * The SUPPLIER account that operates this restaurant — a `suppliers/{uid}`,
   * never a `customers/{uid}`. `firestore.rules` keys every merchant-side
   * permission on it (menu writes, order status transitions) via
   * `ownsMerchant()`, which additionally requires the uid to hold a supplier
   * profile, so pointing this at a customer uid grants nothing.
   *
   * See `@core/account` for why the two are separate accounts.
   */
  supplierId?: string;
  name: string;
  /** "Sri Lankan Authentic Food" — the line under the title. */
  tagline: string;
  cuisines: string[];
  rating: number;
  reviewCount: number;
  /** Denormalised for list cards. */
  deliveryFee: Money;
  /** Orders this big deliver free (inside the area). Null clears it. */
  freeDeliveryOver?: Money | null;
  prepTimeMin: number;
  prepTimeMax: number;
  distanceKm?: number;
  /**
   * The map pin. Absent until the supplier sets it — Figma says so explicitly
   * on Add Restaurant step 2 ("Map pin can be set after creation from
   * Restaurant Info"), and a placeholder (0,0) would put the restaurant in the
   * Gulf of Guinea and corrupt every "near you" query.
   */
  geo?: GeoPoint;
  address: string;
  phone: string;
  /**
   * How far the restaurant delivers and how it prices it — set on Restaurant
   * Info. Absent means the original behaviour: `deliveryFee` flat, any
   * distance. Measured from `geo`, so it only applies once the pin is set
   * (services/deliveryPricing.ts, mirrored by `firestore.rules`).
   */
  deliveryRules?: DeliveryRules | null;
  website?: string;
  hours: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayHours>;
  isOpen: boolean;
  features: MerchantFeature[];
  coverImage: string;
  about?: string;
  /** "Best Overall", "Fastest Delivery", "Top Rated" — shown on the Featured list. */
  badges: string[];
  /** "50% off select items", "Buy 1, get 1 free" — the ribbon on Featured cards. */
  offerLabel?: string;
  /**
   * Retired by its owner. Restaurants are never deleted (`firestore.rules`
   * refuses it — orders and reviews point at them), so archiving closes the
   * restaurant and drops it from every listing, customer and owner alike.
   */
  archived?: boolean;
};

export type OptionChoice = {
  id: string;
  label: string;
  /** Added to the base price, e.g. Large = +400, Extra egg = +100. */
  priceDelta: Money;
};

export type OptionGroup = {
  key: string;
  /** "Size", "Spice Level", "Add-ons" */
  label: string;
  type: 'single' | 'multi';
  required: boolean;
  /** Shown as "(Optional)" beside the label when false. */
  choices: OptionChoice[];
  /**
   * Which choice starts selected for a single-choice group. Required groups
   * fall back to their first choice when absent; optional groups start empty. Figma
   * (116:3078) preselects Regular and Medium — without this the app would
   * silently default to whichever choice happens to be listed first.
   */
  defaultChoiceId?: string;
};

export type MenuItem = {
  id: string;
  merchantId: string;
  merchantName: string;
  name: string;
  description: string;
  price: Money;
  category: string;
  image: string;
  rating: number;
  isBestseller: boolean;
  available: boolean;
  optionGroups: OptionGroup[];
};

export type SelectedOption = {
  groupKey: string;
  groupLabel: string;
  choiceId: string;
  label: string;
  priceDelta: Money;
};

export type CartLine = {
  /** Stable id derived from item + chosen options, so identical picks stack. */
  lineId: string;
  menuItemId: string;
  merchantId: string;
  /** The restaurant's name, so a cart holding several can be grouped by it. */
  merchantName?: string;
  name: string;
  image: string;
  qty: number;
  /** Base price plus the sum of selected option deltas. */
  unitPrice: Money;
  selectedOptions: SelectedOption[];
};

export type AddressLabel = 'Home' | 'Work' | 'Other';
export type BuildingType = 'house' | 'apartment' | 'office' | 'hotel' | 'other';
export type DropoffOption = 'door' | 'lobby' | 'gate';

/**
 * A customer's delivery address — `customers/{uid}/addresses/{id}`, created in
 * the app, and snapshotted onto every order so the restaurant knows where the
 * food goes (it cannot read the customer's address book).
 *
 * `line1`/`city` are what the person typed and are the source of truth. Figma's
 * address flow assumes a places-search API; that needs billing, which the Spark
 * plan does not have, so the street address is entered directly and the map pin
 * is optional, taken from the device when the person is at the address.
 */
export type Address = {
  id: string;
  label: AddressLabel;
  line1: string;
  city: string;
  /** Absent until pinned — a placeholder coordinate would corrupt "near you". */
  geo?: GeoPoint;
  buildingType: BuildingType;
  apt?: string;
  buildingName?: string;
  landmark?: string;
  dropoffOption: DropoffOption;
  instructions?: string;
  photos?: string[];
};

export type DeliveryMode = 'priority' | 'standard' | 'scheduled';

/**
 * The merchant lifecycle from Figma's OrderCard set (335:5771). The customer
 * tracker (91:3780) collapses these to three nodes — see `trackerStage`.
 */
export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type OrderPricing = {
  subtotal: Money;
  deliveryFee: Money;
  priorityFee: Money;
  promoDiscount: Money;
  total: Money;
  currency: 'LKR';
};

export type Order = {
  id: string;
  module: 'food';
  /** Human reference shown on the track card, e.g. "AZG-7821". */
  ref: string;
  userId: string;
  /**
   * The customer's name, snapshotted onto the order the way `merchantName` is.
   *
   * The restaurant has to address the person somehow, and it CANNOT look them
   * up: `firestore.rules` lets a customer read only their own profile, so a
   * supplier querying `customers/{uid}` is refused by design. Without this the
   * provider order card fell back to the order reference and showed it twice.
   */
  userName: string;
  merchantId: string;
  merchantName: string;
  items: Array<Omit<CartLine, 'lineId'> & { lineTotal: Money }>;
  orderType: 'delivery' | 'pickup';
  address: Address | null;
  dropoffOption: DropoffOption;
  /** Restaurant → address, straight-line km, when the restaurant prices or limits by distance. */
  deliveryDistanceKm?: number;
  noteToRestaurant?: string;
  requestUtensils: boolean;
  deliveryMode: DeliveryMode;
  scheduledFor?: number;
  pricing: OrderPricing;
  promoCode?: string;
  paymentMethod: string;
  status: OrderStatus;
  /**
   * One entry per step. `by` is set on a cancellation so both sides can say
   * who called it off — the customer (only while 'new') or the restaurant.
   */
  timeline: Array<{ status: OrderStatus; at: number; by?: 'customer' | 'restaurant' }>;
  etaFrom: number;
  etaTo: number;
  createdAt: number;
  /**
   * The customer's phone, snapshotted at checkout so the restaurant can call
   * about the order — it cannot read `customers/{uid}`. Absent when the
   * account has no number; never written as undefined.
   */
  userPhone?: string;
  /** Why the restaurant turned the order down — one of CANCEL_REASONS. */
  cancelReason?: string;
};

/** Statuses after which nothing more happens to an order. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * The furthest point of the normal lifecycle the order reached. For a
 * cancelled or refunded order that is where it stopped (read from the
 * timeline); for anything else it is the status itself.
 */
export function lastReachedStatus(order: { status: OrderStatus; timeline?: Order['timeline'] }): OrderStatus {
  if (order.status !== 'cancelled' && order.status !== 'refunded') return order.status;
  const steps = (order.timeline ?? []).map((t) => t.status);
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s !== 'cancelled' && s !== 'refunded') return s;
  }
  return 'new';
}

/**
 * How far the three-node customer tracker is filled — Figma Status Loader
 * (91:3780) has six variants, which map onto the lifecycle as:
 *
 *   new                          nothing lit
 *   accepted                     Restaurant
 *   preparing · ready_for_pickup Restaurant + first bar
 *   picked_up                    Restaurant + Picked up + second bar
 *   delivered                    everything
 *
 * A cancelled or refunded order stops where it was and turns brand red.
 */
export function trackerProgress(order: {
  status: OrderStatus;
  timeline?: Order['timeline'];
  orderType?: Order['orderType'];
}): {
  nodes: 0 | 1 | 2 | 3;
  bars: 0 | 1 | 2;
  tone: 'success' | 'danger';
} {
  const tone = order.status === 'cancelled' || order.status === 'refunded' ? 'danger' : 'success';
  const reached = lastReachedStatus(order);
  // Takeaway: Restaurant → Ready → Collected. Ready lights as soon as the
  // kitchen marks it, since that's the moment the customer should set off.
  if (order.orderType === 'pickup') {
    switch (reached) {
      case 'new':
        return { nodes: tone === 'danger' ? 1 : 0, bars: 0, tone };
      case 'accepted':
        return { nodes: 1, bars: 0, tone };
      case 'preparing':
        return { nodes: 1, bars: 1, tone };
      case 'ready_for_pickup':
        return { nodes: 2, bars: 2, tone };
      default:
        return { nodes: 3, bars: 2, tone };
    }
  }
  switch (reached) {
    case 'new':
      // A cancelled-while-new order still shows where it stopped: at the restaurant.
      return { nodes: tone === 'danger' ? 1 : 0, bars: 0, tone };
    case 'accepted':
      return { nodes: 1, bars: 0, tone };
    case 'preparing':
    case 'ready_for_pickup':
      return { nodes: 1, bars: 1, tone };
    case 'picked_up':
      return { nodes: 2, bars: 2, tone };
    default:
      return { nodes: 3, bars: 2, tone };
  }
}

export type Review = {
  id: string;
  merchantId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  /** The dish chip shown above the review body. */
  dishTag?: string;
  helpfulCount: number;
  createdAt: number;
  /** The restaurant's public response — written by its owner (385:5924). */
  reply?: { text: string; createdAt: number };
  /** Owner-side archive. Only filters the owner's Reviews screen; customers still see it. */
  hiddenByMerchant?: boolean;
  /** The delivered order this review is about — `firestore.rules` requires it on create. */
  orderId?: string;
};

/**
 * `promotions/{id}` — both kinds of discount live here.
 *
 * - A **promo code** (`code` set) is typed into the cart; its document id IS the
 *   code, so the cart and the rules can look it up directly.
 * - An **offer** is what a restaurant creates on Offers & Discounts (Figma
 *   352:6743). It has no code: while it is `active` and unexpired the cart applies
 *   it automatically to that restaurant's orders.
 *
 * An order carries at most one of them, as `promoCode` = the document id.
 */
export type Promotion = {
  id: string;
  code?: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrder?: Money;
  merchantId?: string;
  validUntil: number;
  /** Offers: switched on/off from the offer list. Missing means active (codes). */
  active?: boolean;
  /** Offers: 'items' limits the discount to `itemIds`. */
  appliesTo?: 'all' | 'items';
  itemIds?: string[];
  usageLimit?: number;
  /** Orders accepted with this promotion — counted by the restaurant on accept. */
  usedCount?: number;
  /** Offers: how the card looks — Figma "Customize Look" (370:3714). */
  look?: OfferLook;
  createdAt?: number;
};

export type OfferLook = {
  /** Kicker above the headline, e.g. "LIMITED TIME OFFER". */
  label: string;
  /** Key into OFFER_BACKGROUNDS. */
  background: string;
  /** Key into OFFER_ILLUSTRATIONS. */
  illustration: string;
};

/**
 * Collapses the 8 order statuses onto the 3-node customer tracker: the index
 * of the last node reached, or -1 before the restaurant has accepted. A
 * cancelled or refunded order stops at the last node it actually reached
 * (pass its timeline) instead of lighting "Delivered".
 */
export function trackerStage(status: OrderStatus, timeline?: Order['timeline']): -1 | 0 | 1 | 2 {
  return (trackerProgress({ status, timeline }).nodes - 1) as -1 | 0 | 1 | 2;
}
