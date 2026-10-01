import type { AddressLabel } from '../types';

/**
 * The saved addresses shown in the Addresses sheet (Figma 269:1496), transcribed
 * from the design. In a Firebase build these come from
 * `users/{uid}/addresses` — this list is the fixture and the seed.
 */
export type SavedAddress = {
  id: string;
  label: AddressLabel;
  /** Row heading — "Home", "241 Maradana Rd", "Cake o clock". */
  title: string;
  /** Second line — the full street address. */
  subtitle: string;
};

export const savedAddresses: SavedAddress[] = [
  {
    id: 'home',
    label: 'Home',
    title: 'Home',
    subtitle: 'Metro Voyage - Jaffna, 574 Hospital Rd, Jaffna',
  },
  {
    id: 'maradana',
    label: 'Other',
    title: '241 Maradana Rd',
    subtitle: 'Colombo',
  },
  {
    id: 'cake-o-clock',
    label: 'Other',
    title: 'Cake o clock',
    subtitle: '35HV+PQM, Wakwella Rd, Hapugala',
  },
  {
    id: 'g-block-canteen',
    label: 'Other',
    title: 'G- block canteen',
    subtitle: 'Peradeniya-Badulla-Chenkaladi Hwy, Badulla',
  },
];
