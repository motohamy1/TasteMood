import type { ImageProps } from "expo-image";

/** Line icons for the new food-delivery design tab bar. */
const ICON_PATHS: Record<string, string> = {
  // Home / discover — house icon
  index:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z"/><path d="M9 21V12h6v9"/></g>',
  // Personality (previously personality icon)
  personality:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.6" cy="8.4" r="3.3"/><path d="M4.3 19c1.2-3.2 3.5-4.8 6.3-4.8s5.1 1.6 6.3 4.8"/><path d="M19.4 2.9c.3 1.55 1.15 2.4 2.7 2.7-1.55.3-2.4 1.15-2.7 2.7-.3-1.55-1.15-2.4-2.7-2.7 1.55-.3 2.4-1.15 2.7-2.7z" stroke-width="1.4"/></g>',
  // Offers — tag/discount icon
  offers:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="{{c}}" stroke="none"/></g>',
  // Orders / bag icon
  orders:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></g>',
  // Favourites — heart
  favourites:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3S4.8 15.7 4.8 10.6a4.1 4.1 0 0 1 7.2-2.6 4.1 4.1 0 0 1 7.2 2.6c0 5.1-7.2 9.7-7.2 9.7z"/></g>',
  // AI — spark/star
  ai: '<path d="M12 3.6c.7 4.4 3.9 7.7 8.4 8.4-4.5.7-7.7 4-8.4 8.4-.7-4.4-3.9-7.7-8.4-8.4 4.5-.7 7.7-4 8.4-8.4z" fill="{{c}}"/>',
  // Profile
  profile:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.4" r="3.4"/><path d="M5.5 19c1.3-3.2 3.7-4.8 6.5-4.8s5.2 1.6 6.5 4.8"/></g>',
  // Back arrow
  back: '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></g>',
  // Menu / hamburger
  menu: '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></g>',
  // Filter / sliders
  filter:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" fill="{{c}}" stroke="none"/><circle cx="15" cy="12" r="2" fill="{{c}}" stroke="none"/><circle cx="9" cy="18" r="2" fill="{{c}}" stroke="none"/></g>',
  // Search
  search:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/></g>',
  // Heart filled (for save state)
  "heart-filled":
    '<path d="M12 20.3S4.8 15.7 4.8 10.6a4.1 4.1 0 0 1 7.2-2.6 4.1 4.1 0 0 1 7.2 2.6c0 5.1-7.2 9.7-7.2 9.7z" fill="{{c}}" stroke="{{c}}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  // Plus button
  plus: '<g fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></g>',
};

export function tabIcon(
  name: string,
  color: string,
  size = 24
): ImageProps["source"] {
  const inner = (ICON_PATHS[name] ?? "").replace(/\{\{c\}\}/g, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}</svg>`;
  return { uri: `data:image/svg+xml;base64,${btoa(svg)}` };
}
