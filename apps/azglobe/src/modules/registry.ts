import { FoodNavigator } from './food/navigation/FoodNavigator';
import { ActiveOrderSection } from './food/components/ActiveOrderSection';
import { PopularDishesSection } from './food/components/PopularDishesSection';
import { PopularNearYouSection } from './food/components/PopularNearYouSection';
import type { ModuleDescriptor } from './types';

/**
 * The A-Z Globe module registry — the single place a module is plugged into the
 * app.
 *
 * It drives three things at once:
 *   1. the "Our Services" grid on Home,
 *   2. which navigators the root stack mounts,
 *   3. which sections appear on Home below the services grid.
 *
 * To ship the next module: build `src/modules/<id>/`, export its navigator, and
 * add an entry here with `status: 'live'`. Nothing in `src/app` or `@azglobe/core`
 * changes.
 *
 * The six tiles and their order come from Figma (324:1708). The five that are
 * not built yet stay in the grid — the design shows them — but route to a
 * "coming soon" screen.
 */
export const modules: ModuleDescriptor[] = [
  {
    id: 'food',
    title: 'Order Food',
    icon: require('../../assets/images/services/order-food.png'),
    status: 'live',
    route: 'Food',
    navigator: FoodNavigator,
    sortOrder: 0,
    homeSections: [
      { key: 'food-active-order', slot: 'above-services', order: 0, Component: ActiveOrderSection },
      { key: 'food-popular-dishes', slot: 'below-services', order: 0, Component: PopularDishesSection },
      { key: 'food-popular-near-you', slot: 'below-services', order: 1, Component: PopularNearYouSection },
    ],
  },
  {
    id: 'events',
    title: 'Book an Event',
    icon: require('../../assets/images/services/book-an-event.png'),
    status: 'coming-soon',
    sortOrder: 1,
  },
  {
    id: 'home-services',
    title: 'Home Services',
    icon: require('../../assets/images/services/home-services.png'),
    status: 'coming-soon',
    sortOrder: 2,
  },
  {
    id: 'decoration',
    title: 'Decoration',
    icon: require('../../assets/images/services/decoration.png'),
    status: 'coming-soon',
    sortOrder: 3,
  },
  {
    id: 'hotels',
    title: 'Book a Hotel',
    icon: require('../../assets/images/services/book-a-hotel.png'),
    status: 'coming-soon',
    sortOrder: 4,
  },
  {
    id: 'funeral',
    title: 'Funeral Service',
    icon: require('../../assets/images/services/funeral-service.png'),
    status: 'coming-soon',
    sortOrder: 5,
  },
];

/** Modules with a navigator to mount on the root stack. */
export const liveModules = modules.filter(
  (m): m is ModuleDescriptor & { route: string; navigator: NonNullable<ModuleDescriptor['navigator']> } =>
    m.status === 'live' && Boolean(m.route) && Boolean(m.navigator)
);
