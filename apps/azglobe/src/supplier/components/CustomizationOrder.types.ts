import type { ReactNode } from 'react';
export type CustomizationOrderProps = {
  index: number; scope: string; disabled?: boolean;
  onReorder: (from: number, to: number) => void;
  children: (handle: ReactNode) => ReactNode;
};
