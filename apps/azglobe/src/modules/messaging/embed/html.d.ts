/** The bundled messaging page — written by `tools/build-messaging-embed.mjs`. */
declare module '*/embed/generated/html' {
  const html: string;
  export default html;
}

/** Only the embedded page mounts a DOM root itself; the app has no @types/react-dom. */
declare module 'react-dom/client' {
  export function createRoot(container: Element): { render(node: import('react').ReactNode): void };
}
