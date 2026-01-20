// Unified icon exports for the extension
// To change icons, only modify this file

import mainIconUrl from './main-icon.png?url';

export const icons = {
  main: mainIconUrl,
} as const;

export type IconName = keyof typeof icons;
