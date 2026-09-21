/**
 * Shared foundation for every A-Z Globe app.
 *
 * Nothing here knows about a specific module — no restaurants, no orders. That
 * is what lets the customer and provider apps sit on exactly the same design
 * tokens, UI kit and Firebase layer without either importing the other.
 */
export * from './theme';
export { brandMark, brandLockup } from './brand';
export * from './ui';
export { isFirebaseReady, getApp } from './firebase';
export * from './account';
