/**
 * Icon registry.
 *
 * Every glyph is the designer's own vector, exported from the Figma file with
 * `node tools/harvest-icons.mjs <screen> --out assets/icons/app` and rewritten so
 * its colour is `currentColor`. Do NOT swap these for an icon-font or a package
 * like lucide — they would be near-misses, and the design is the source of truth.
 *
 * To add one: harvest the screen, rename the file to its semantic name, and add
 * a line below.
 */
import ArrowLeft from '../../assets/icons/app/arrow-left.svg';
import Bell from '../../assets/icons/app/bell.svg';
import Bike from '../../assets/icons/app/bike.svg';
import Card from '../../assets/icons/app/card.svg';
import Cart from '../../assets/icons/app/cart.svg';
import Cash from '../../assets/icons/app/cash.svg';
import Check from '../../assets/icons/ui/check.svg';
// Figma 385:4299 — the 16px pin in the Add Restaurant location note.
import MapPinSm from '../../assets/icons/ui/mapPinSm.svg';
import ChevronLeft from '../../assets/icons/ui/chevronLeft.svg';
import ChevronRight from '../../assets/icons/app/chevron-right.svg';
import Clock from '../../assets/icons/app/clock.svg';
// Provider hub rows — Figma 385:5072.
import MenuManagement from '../../assets/icons/provider/menuManagement.svg';
import ActiveOrders from '../../assets/icons/provider/activeOrders.svg';
import OrderHistory from '../../assets/icons/provider/orderHistory.svg';
import Offers from '../../assets/icons/provider/offers.svg';
import Reviews from '../../assets/icons/provider/reviews.svg';
import RestaurantInfo from '../../assets/icons/provider/restaurantInfo.svg';
// Order History — Figma 346:3748 (date chip, note banner, ETA, outcome banners).
import Calendar from '../../assets/icons/provider/calendar.svg';
import Note from '../../assets/icons/provider/note.svg';
import ClockSm from '../../assets/icons/provider/clockSm.svg';
import Cross from '../../assets/icons/provider/cross.svg';
import CheckSm from '../../assets/icons/provider/checkSm.svg';
// Offers & Discounts — Figma 352:6743 and the Create Offer sheets.
import PlusCircle from '../../assets/icons/provider/plusCircle.svg';
import More from '../../assets/icons/provider/more.svg';
import PencilSm from '../../assets/icons/provider/pencilSm.svg';
import Save from '../../assets/icons/provider/save.svg';
// Provider dashboard / hub stat cards — Figma 385:3064 (box) and 385:3074 (trend).
import Box from '../../assets/icons/provider/box.svg';
import TrendingUp from '../../assets/icons/provider/trendingUp.svg';
// Restaurant Information — Figma 394:3362 ("Change Cover") and 394:2803 ("Set Pin").
import Camera from '../../assets/icons/provider/camera.svg';
import Crosshair from '../../assets/icons/provider/crosshair.svg';
// Hub "Active Orders Awaiting" alert (385:5480) and restaurant card menu (385:3361).
import Warning from '../../assets/icons/provider/warning.svg';
import MoreVertical from '../../assets/icons/provider/moreVertical.svg';
// Provider Reviews — reply link (385:6619), dish tag (385:6611), "Hide Review" (432:3465).
import Reply from '../../assets/icons/provider/reply.svg';
import DishTag from '../../assets/icons/provider/dishTag.svg';
import XCircle from '../../assets/icons/provider/xCircle.svg';
// Add New Item — the photo drop zone's glyph (463:3008).
import UploadPhoto from '../../assets/icons/provider/uploadPhoto.svg';
import Close from '../../assets/icons/app/close.svg';
import FilterOffers from '../../assets/icons/app/filter-offers.svg';
import FilterPickup from '../../assets/icons/app/filter-pickup.svg';
import ImageIcon from '../../assets/icons/app/image.svg';
import MapPin from '../../assets/icons/app/map-pin.svg';
import Minus from '../../assets/icons/app/minus.svg';
import Navigation from '../../assets/icons/app/navigation.svg';
import Pencil from '../../assets/icons/app/pencil.svg';
import Phone from '../../assets/icons/app/phone.svg';
import Plus from '../../assets/icons/app/plus.svg';
import Rupee from '../../assets/icons/app/rupee.svg';
import PlusSm from '../../assets/icons/app/plus-sm.svg';
import OrderSummary from '../../assets/icons/app/order-summary.svg';
import Utensils from '../../assets/icons/app/utensils.svg';
import Search from '../../assets/icons/app/search.svg';
import Share from '../../assets/icons/app/share.svg';
import Store from '../../assets/icons/app/store.svg';
import Trash from '../../assets/icons/app/trash.svg';
import Zap from '../../assets/icons/app/zap.svg';
// Choose building type — Figma 269:1625 (house / apartment / office / hotel);
// the house is also the "Home" glyph on Addresses (269:1496) and Profile (215:1152),
// the briefcase the "Set work" shortcut.
import House from '../../assets/icons/app/house.svg';
import Building from '../../assets/icons/app/building.svg';
import Briefcase from '../../assets/icons/app/briefcase.svg';
import Hotel from '../../assets/icons/app/hotel.svg';
// Order Placed — Figma 416:4243: the 52pt line check and "mingcute:celebrate-line".
import CheckCircle from '../../assets/icons/app/check-circle.svg';
import Celebrate from '../../assets/icons/app/celebrate.svg';

// Bottom navigation
import NavHome from '../../assets/icons/nav/home.svg';
import NavCart from '../../assets/icons/nav/cart.svg';
import NavMessages from '../../assets/icons/nav/messages.svg';
import NavProfile from '../../assets/icons/nav/profile.svg';

import Star from '../../assets/icons/ui/star.svg';

export const Icons = {
  person: NavProfile,
  home: NavHome,
  arrowLeft: ArrowLeft,
  bell: Bell,
  bike: Bike,
  card: Card,
  cart: Cart,
  cash: Cash,
  check: Check,
  mapPinSm: MapPinSm,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clock: Clock,
  menuManagement: MenuManagement,
  activeOrders: ActiveOrders,
  orderHistory: OrderHistory,
  offers: Offers,
  reviews: Reviews,
  restaurantInfo: RestaurantInfo,
  calendar: Calendar,
  note: Note,
  clockSm: ClockSm,
  cross: Cross,
  checkSm: CheckSm,
  plusCircle: PlusCircle,
  more: More,
  pencilSm: PencilSm,
  save: Save,
  box: Box,
  trendingUp: TrendingUp,
  camera: Camera,
  crosshair: Crosshair,
  warning: Warning,
  moreVertical: MoreVertical,
  reply: Reply,
  dishTag: DishTag,
  xCircle: XCircle,
  uploadPhoto: UploadPhoto,
  close: Close,
  filterOffers: FilterOffers,
  filterPickup: FilterPickup,
  image: ImageIcon,
  mapPin: MapPin,
  minus: Minus,
  navigation: Navigation,
  pencil: Pencil,
  phone: Phone,
  plus: Plus,
  plusSm: PlusSm,
  rupee: Rupee,
  orderSummary: OrderSummary,
  utensils: Utensils,
  search: Search,
  share: Share,
  star: Star,
  store: Store,
  trash: Trash,
  zap: Zap,
  house: House,
  building: Building,
  briefcase: Briefcase,
  hotel: Hotel,
  checkCircle: CheckCircle,
  celebrate: Celebrate,
} as const;

export const NavIcons = {
  Home: NavHome,
  Cart: NavCart,
  Messages: NavMessages,
  Profile: NavProfile,
} as const;

export type IconName = keyof typeof Icons;
