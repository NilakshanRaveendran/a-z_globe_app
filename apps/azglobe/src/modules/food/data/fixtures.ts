/**
 * Content transcribed verbatim from the Figma file.
 *
 * Two jobs:
 *  1. Drives the app before a Firebase project exists, so screens can be built
 *     and checked against Figma immediately.
 *  2. Is the input to `tools/seed.mjs`, which writes the same documents into
 *     Firestore — so the seeded app looks exactly like the design.
 *
 * Keep the copy identical to Figma (including the en dashes in "20–30 min" and
 * the emoji in the spice options). If a string differs from the design, it is a
 * bug.
 */
import type { MenuItem, Merchant, Promotion, Review } from '../types';

const HOURS_7_TO_10 = {
  mon: { open: '7:00 AM', close: '10:00 PM' },
  tue: { open: '7:00 AM', close: '10:00 PM' },
  wed: { open: '7:00 AM', close: '10:00 PM' },
  thu: { open: '7:00 AM', close: '10:00 PM' },
  fri: { open: '7:00 AM', close: '10:00 PM' },
  sat: { open: '7:00 AM', close: '10:00 PM' },
  sun: { open: '7:00 AM', close: '10:00 PM' },
} as const;

export const merchants: Merchant[] = [
  {
    id: 'mamas-kitchen',
    module: 'food',
    name: "Mama's Kitchen",
    tagline: 'Sri Lankan Authentic Food',
    cuisines: ['Sri Lankan', 'Home Food', 'Kottu', 'Rice & Curry', 'Hoppers'],
    rating: 4.8,
    reviewCount: 234,
    deliveryFee: 80,
    freeDeliveryOver: 1500,
    prepTimeMin: 20,
    prepTimeMax: 30,
    distanceKm: 1.2,
    geo: { lat: 8.5874, lng: 81.2152, geohash: 'tc9bb57' },
    address: '45 Beach Road, Trincomalee 31000',
    phone: '+94 26 222 3456',
    website: 'mamaskitchen.lk',
    hours: HOURS_7_TO_10,
    isOpen: true,
    features: ['dineIn', 'takeaway', 'homeDelivery', 'cards', 'wifi', 'familyFriendly'],
    coverImage: 'merchant-mamas-kitchen',
    about:
      "Mama's Kitchen has been serving authentic Sri Lankan home-style food since 2010. Known for their signature kottu, fresh hoppers, and coconut-based curries — all made from family recipes passed down through generations.",
    badges: ['Best Overall'],
    offerLabel: '50% off select items',
  },
  {
    id: 'yaal-angaadi',
    module: 'food',
    name: 'Yaal Angaadi',
    tagline: 'Restaurant',
    cuisines: ['Sri Lankan', 'Rice & Curry'],
    rating: 4.9,
    reviewCount: 512,
    deliveryFee: 0,
    prepTimeMin: 25,
    prepTimeMax: 35,
    distanceKm: 1.2,
    geo: { lat: 8.5791, lng: 81.2087, geohash: 'tc98zcy' },
    address: '12 Main Street, Trincomalee',
    phone: '+94 26 222 7788',
    hours: HOURS_7_TO_10,
    isOpen: true,
    features: ['dineIn', 'takeaway', 'homeDelivery', 'cards'],
    coverImage: 'merchant-trinco-blu',
    badges: ['Best Overall'],
    offerLabel: 'Buy 1, get 1 free',
  },
  {
    id: 'namma-ooru-cafe',
    module: 'food',
    name: 'Namma Ooru Cafe',
    tagline: 'Cafe',
    cuisines: ['Cafe', 'Drinks', 'Desserts'],
    rating: 4.4,
    reviewCount: 89,
    deliveryFee: 50,
    prepTimeMin: 15,
    prepTimeMax: 20,
    distanceKm: 1.8,
    geo: { lat: 8.5702, lng: 81.2331, geohash: 'tc9bb80' },
    address: '8 Dockyard Road, Trincomalee',
    phone: '+94 26 222 1199',
    hours: HOURS_7_TO_10,
    isOpen: true,
    features: ['dineIn', 'takeaway', 'homeDelivery', 'cards', 'wifi'],
    coverImage: 'merchant-namma-ooru-cafe',
    badges: ['Fastest Delivery'],
    offerLabel: '30% off select items',
  },
  {
    id: 'trinco-blu-restaurant',
    module: 'food',
    name: 'Trinco Blu Restaurant',
    tagline: 'Restaurant',
    cuisines: ['Seafood', 'Sri Lankan'],
    rating: 4.6,
    reviewCount: 156,
    deliveryFee: 100,
    prepTimeMin: 30,
    prepTimeMax: 40,
    distanceKm: 2.5,
    geo: { lat: 8.5993, lng: 81.2244, geohash: 'tc9bbm3' },
    address: 'Alles Garden, Trincomalee',
    phone: '+94 26 222 2035',
    hours: HOURS_7_TO_10,
    isOpen: false,
    features: ['dineIn', 'takeaway', 'cards', 'familyFriendly'],
    coverImage: 'merchant-trinco-blu-restaurant',
    badges: ['Top Rated'],
  },
  {
    id: 'trinco-spice-hub',
    module: 'food',
    name: 'Trinco Spice Hub',
    tagline: 'Sri Lankan Home Food',
    cuisines: ['Sri Lankan', 'Rice & Curry'],
    rating: 4.5,
    reviewCount: 74,
    deliveryFee: 70,
    prepTimeMin: 20,
    prepTimeMax: 35,
    distanceKm: 3.1,
    geo: { lat: 8.5648, lng: 81.2419, geohash: 'tc9b8xn' },
    address: '210 Inner Harbour Road, Trincomalee',
    phone: '+94 26 222 5544',
    hours: HOURS_7_TO_10,
    isOpen: true,
    features: ['takeaway', 'homeDelivery'],
    coverImage: 'merchant-mamas-kitchen-wide',
    badges: [],
  },
];

/** Reused across dishes — Figma shows the same three groups on the item screen. */
const KOTTU_OPTIONS = [
  {
    key: 'size',
    label: 'Size',
    type: 'single' as const,
    required: true,
    defaultChoiceId: 'regular',
    choices: [
      { id: 'regular', label: 'Regular', priceDelta: 0 },
      { id: 'large', label: 'Large', priceDelta: 400 },
    ],
  },
  {
    key: 'spice',
    label: 'Spice Level',
    type: 'single' as const,
    required: true,
    defaultChoiceId: 'medium',
    choices: [
      { id: 'mild', label: 'Mild 🌿', priceDelta: 0 },
      { id: 'medium', label: 'Medium 🌶️', priceDelta: 0 },
      { id: 'hot', label: 'Hot 🔥', priceDelta: 0 },
    ],
  },
  {
    key: 'addons',
    label: 'Add-ons',
    type: 'multi' as const,
    required: false,
    choices: [
      { id: 'extra-egg', label: 'Extra egg', priceDelta: 100 },
      { id: 'extra-gravy', label: 'Extra gravy', priceDelta: 30 },
      { id: 'extra-rice', label: 'Extra rice', priceDelta: 150 },
    ],
  },
];

const item = (
  id: string,
  merchantId: string,
  merchantName: string,
  name: string,
  price: number,
  description: string,
  category: string,
  image: string,
  rating: number,
  isBestseller = false
): MenuItem => ({
  id,
  merchantId,
  merchantName,
  name,
  description,
  price,
  category,
  image,
  rating,
  isBestseller,
  available: true,
  optionGroups: KOTTU_OPTIONS,
});

const KOTTU_DESC = 'Classic kottu with tender chicken, eggs & vegetables';
const HOPPERS_DESC = 'Steamed string hoppers with coconut sambol & dhal curry';

export const menuItems: MenuItem[] = [
  item('mk-chicken-kottu', 'mamas-kitchen', "Mama's Kitchen", 'Chicken Kottu', 450, KOTTU_DESC, 'Popular', 'kottu', 5, true),
  item('mk-dosa', 'mamas-kitchen', "Mama's Kitchen", 'Dosa', 380, HOPPERS_DESC, 'Popular', 'dosa-platter', 4),
  item('mk-samosa', 'mamas-kitchen', "Mama's Kitchen", 'Samosa', 450, KOTTU_DESC, 'Snacks', 'samosa', 4),
  item('mk-rotty-set', 'mamas-kitchen', "Mama's Kitchen", 'Rotty Set', 380, HOPPERS_DESC, 'Rice & Curry', 'rotty-set', 4),
  item('mk-classic-kottu', 'mamas-kitchen', "Mama's Kitchen", 'Classic Kottu', 450, KOTTU_DESC, 'Popular', 'rotty-set-alt', 4),
  item('mk-lime-juice', 'mamas-kitchen', "Mama's Kitchen", 'Lime Juice', 380, HOPPERS_DESC, 'Drinks', 'pancakes', 4),
  item('mk-wood-apple', 'mamas-kitchen', "Mama's Kitchen", 'Wood Apple Juice', 380, HOPPERS_DESC, 'Drinks', 'dosa', 4),
  item('mk-pol-sambol', 'mamas-kitchen', "Mama's Kitchen", 'Pol Sambol Rice', 320, 'Steamed rice with fresh coconut sambol & papadam', 'Rice & Curry', 'pol-sambol-rice', 4),

  item('ya-samosa', 'yaal-angaadi', 'Yaal Angaadi', 'Samosa', 160, 'Crispy lentil fritters served with coconut chutney', 'Snacks', 'samosa-alt', 4),
  item('ya-kottu', 'yaal-angaadi', 'Yaal Angaadi', 'Chicken Kottu', 420, KOTTU_DESC, 'Popular', 'curry-roti', 5),

  item('tsh-rotty-set', 'trinco-spice-hub', 'Trinco Spice Hub', 'Rotty Set', 320, 'Steamed rice with fresh coconut sambol & papadam', 'Rice & Curry', 'curry-roti', 4),

  item('noc-dosa', 'namma-ooru-cafe', 'Namma Ooru Cafe', 'Dosa', 360, HOPPERS_DESC, 'Popular', 'dosa', 4),
];

export const reviews: Review[] = [
  {
    id: 'r1',
    merchantId: 'mamas-kitchen',
    userId: 'u-ravi',
    userName: 'Ravi S.',
    rating: 5,
    dishTag: 'Chicken Kottu',
    text: 'Best kottu in Trincomalee — the flavour was spot-on and portions were generous. Delivery arrived piping hot within 25 minutes.',
    helpfulCount: 12,
    createdAt: daysAgo(2),
  },
  {
    id: 'r2',
    merchantId: 'mamas-kitchen',
    userId: 'u-priya',
    userName: 'Priya M.',
    rating: 4,
    dishTag: 'String Hoppers Set',
    text: "Authentic home-style taste that's hard to find. Slightly late but absolutely worth the wait. Coconut sambol was delicious!",
    helpfulCount: 7,
    createdAt: daysAgo(7),
  },
  {
    id: 'r3',
    merchantId: 'mamas-kitchen',
    userId: 'u-suresh',
    userName: 'Suresh K.',
    rating: 5,
    dishTag: 'Pol Sambol Rice',
    text: 'Always consistent quality. My go-to restaurant for a proper Sri Lankan meal — never once disappointed me.',
    helpfulCount: 21,
    createdAt: daysAgo(14),
  },
  {
    id: 'r4',
    merchantId: 'mamas-kitchen',
    userId: 'u-jeeva',
    userName: 'Jeeva',
    rating: 5,
    dishTag: 'Pol Sambol Rice',
    text: 'Always consistent quality. My go-to restaurant for a proper Sri Lankan meal — never once disappointed me.',
    helpfulCount: 9,
    createdAt: daysAgo(15),
  },
];

/** Figma's review summary bars: 68 / 19 / 8 / 3 / 2 percent. */
export const ratingBreakdown = [
  { stars: 5, percent: 68 },
  { stars: 4, percent: 19 },
  { stars: 3, percent: 8 },
  { stars: 2, percent: 3 },
  { stars: 1, percent: 2 },
];

export const promotions: Promotion[] = [
  {
    id: 'mama20',
    code: 'MAMA20',
    type: 'percent',
    value: 20,
    merchantId: 'mamas-kitchen',
    validUntil: daysAgo(-90),
  },
];

/** Cuisine filter row on the Order Food landing page (31:11648). */
export const cuisineFilters = ['All', 'Sri Lankan', 'Cafe', 'Seafood'];

/** Category circles below the cuisine row. */
export const foodCategories = [
  { id: 'dine-out', label: 'Dine Out', tint: '#FEF3C7' },
  { id: 'rice-curry', label: 'Rice & Curry', tint: '#DCFCE7' },
  { id: 'kottu', label: 'Kottu', tint: '#FEE2E2' },
  { id: 'seafood', label: 'Seafood', tint: '#DBEAFE' },
  { id: 'drinks', label: 'Drinks', tint: '#F3E8FF' },
  { id: 'desserts', label: 'Desserts', tint: '#FCE7F3' },
];

/** Menu category chips on the restaurant page and All Menu Items. */
export const menuCategories = ['All', 'Popular', 'Rice & Curry', 'Snacks', 'Drinks'];

function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}
