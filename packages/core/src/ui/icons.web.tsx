import type { SvgIconComponent } from '@mui/icons-material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import DeliveryDining from '@mui/icons-material/DeliveryDining';
import CreditCard from '@mui/icons-material/CreditCard';
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import Check from '@mui/icons-material/Check';
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import AccessTime from '@mui/icons-material/AccessTime';
import RestaurantMenu from '@mui/icons-material/RestaurantMenu';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import History from '@mui/icons-material/History';
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import Notes from '@mui/icons-material/Notes';
import Close from '@mui/icons-material/Close';
import AddCircleOutline from '@mui/icons-material/AddCircleOutlined';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import EditOutlined from '@mui/icons-material/EditOutlined';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import TrendingUp from '@mui/icons-material/TrendingUp';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import MyLocation from '@mui/icons-material/MyLocation';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import MoreVert from '@mui/icons-material/MoreVert';
import Percent from '@mui/icons-material/Percent';
import Upload from '@mui/icons-material/Upload';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import Remove from '@mui/icons-material/Remove';
import NearMeOutlined from '@mui/icons-material/NearMeOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import Add from '@mui/icons-material/Add';
import CurrencyRupee from '@mui/icons-material/CurrencyRupee';
import RestaurantOutlined from '@mui/icons-material/RestaurantOutlined';
import Search from '@mui/icons-material/Search';
import ShareOutlined from '@mui/icons-material/ShareOutlined';
import Star from '@mui/icons-material/Star';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import Bolt from '@mui/icons-material/Bolt';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';
import HotelOutlined from '@mui/icons-material/HotelOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutlineOutlined';
import PersonOutline from '@mui/icons-material/PersonOutlined';
import RectangleOutlined from '@mui/icons-material/RectangleOutlined';
import HighlightOff from '@mui/icons-material/HighlightOff';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined';

// Keep the native icon API while using real Material UI SVG components on web.
function glyph(Component: SvgIconComponent) {
  return function WebIcon({ width = 16, height = width, color }: {
    width?: number; height?: number; color?: string;
  }) {
    return <Component aria-hidden style={{ width, height, color, display: 'block', flexShrink: 0 }} />;
  };
}

export const Icons = {
  arrowLeft: glyph(ArrowBack), bell: glyph(NotificationsNone), bike: glyph(DeliveryDining),
  card: glyph(CreditCard), cart: glyph(ShoppingCartOutlined), cash: glyph(PaymentsOutlined),
  check: glyph(Check), mapPinSm: glyph(LocationOnOutlined), chevronLeft: glyph(ChevronLeft),
  chevronRight: glyph(ChevronRight), clock: glyph(AccessTime), menuManagement: glyph(RestaurantMenu),
  activeOrders: glyph(ReceiptLongOutlined), orderHistory: glyph(History), offers: glyph(LocalOfferOutlined),
  reviews: glyph(RateReviewOutlined), restaurantInfo: glyph(StorefrontOutlined), calendar: glyph(CalendarMonthOutlined),
  note: glyph(Notes), clockSm: glyph(AccessTime), cross: glyph(Close), checkSm: glyph(Check),
  plusCircle: glyph(AddCircleOutline), more: glyph(MoreHoriz), pencilSm: glyph(EditOutlined),
  save: glyph(SaveOutlined), close: glyph(Close), filterOffers: glyph(Percent), filterPickup: glyph(Upload),
  image: glyph(ImageOutlined), mapPin: glyph(LocationOnOutlined), minus: glyph(Remove),
  navigation: glyph(NearMeOutlined), pencil: glyph(EditOutlined), phone: glyph(PhoneOutlined),
  plus: glyph(Add), plusSm: glyph(Add), rupee: glyph(CurrencyRupee), orderSummary: glyph(ReceiptLongOutlined),
  utensils: glyph(RestaurantOutlined), search: glyph(Search), share: glyph(ShareOutlined),
  star: glyph(Star), store: glyph(StorefrontOutlined), trash: glyph(DeleteOutline), zap: glyph(Bolt),
  person: glyph(PersonOutline), home: glyph(HomeOutlined),
  camera: glyph(PhotoCameraOutlined), crosshair: glyph(MyLocation),
  box: glyph(Inventory2Outlined), trendingUp: glyph(TrendingUp),warning: glyph(WarningAmberOutlined),
  moreVertical: glyph(MoreVert),
  reply: glyph(ChatBubbleOutline), dishTag: glyph(RectangleOutlined), xCircle: glyph(HighlightOff),
  uploadPhoto: glyph(CloudUploadOutlined),
  house: glyph(HomeOutlined), building: glyph(ApartmentOutlined), briefcase: glyph(WorkOutlineOutlined),
  hotel: glyph(HotelOutlined),
  checkCircle: glyph(CheckCircleOutlineOutlined), celebrate: glyph(CelebrationOutlined),
} as const;

export const NavIcons = {
  Home: glyph(HomeOutlined), Cart: glyph(ShoppingCartOutlined),
  Messages: glyph(ChatBubbleOutline), Profile: glyph(PersonOutline),
} as const;
export type IconName = keyof typeof Icons;
