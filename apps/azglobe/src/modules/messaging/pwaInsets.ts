/** iOS 27 Home Screen apps blur about 20px beyond the status-bar safe area.
 * Safari's Version token is used because the iPhone OS token can be frozen.
 * Regular browser tabs and other platforms keep their existing spacing.
 */
export function statusBarBlurGap(nav: { standalone?: boolean; userAgent: string }): number {
  if (nav.standalone !== true) return 0;
  const version = /Version\/(\d+)/.exec(nav.userAgent);
  return version && Number(version[1]) >= 27 ? 20 : 0;
}
