import type { ComponentType } from 'react';
import type { ImageSourcePropType } from 'react-native';

/**
 * A-Z Globe is a multi-service app: Food today, then Cabs, Funeral Services,
 * Cleaning, Vehicle Rental, Events, Goods Transport, Hotels and more.
 *
 * A module is self-contained — its screens, components, services and types all
 * live under `src/modules/<id>/`. The shell knows nothing about restaurants or
 * rides; it only knows this descriptor. Adding a module means adding a folder
 * and one entry in `registry.ts`.
 */
export type ModuleId =
  | 'food'
  | 'events'
  | 'home-services'
  | 'decoration'
  | 'hotels'
  | 'funeral'
  | 'cabs'
  | 'vehicle-rental'
  | 'goods-transport'
  | 'cleaning';

export type ModuleStatus = 'live' | 'coming-soon';

export type ModuleDescriptor = {
  id: ModuleId;
  /** Label shown on the Home "Our Services" tile — must match Figma exactly. */
  title: string;
  /** Tile artwork exported from Figma. */
  icon: ImageSourcePropType;
  status: ModuleStatus;
  /**
   * Root route this module owns inside the app stack. Only set for live modules;
   * the shell registers the navigator under this name.
   */
  route?: string;
  /** The module's own navigator. Lazy so a module is only loaded when entered. */
  navigator?: ComponentType<object>;
  /**
   * Order in the Home services grid. Figma (324:1708) shows, in order:
   * Order Food, Book an Event, Home Services, Decoration, Book a Hotel,
   * Funeral Service.
   */
  sortOrder: number;
  /**
   * Sections this module contributes to the Home screen, below "Our Services".
   * Home renders whatever the registry gives it, so it never imports a module's
   * domain code directly — Food supplies "Popular Dishes" and "Popular Near You".
   */
  homeSections?: HomeSection[];
};

export type HomeSection = {
  key: string;
  /**
   * Where on Home the section sits. Figma puts the live-order card above the
   * services grid (324:2157) and the browse sections below it (324:1708).
   */
  slot: 'above-services' | 'below-services';
  /** Lower renders first within a slot. */
  order: number;
  Component: ComponentType<object>;
};
