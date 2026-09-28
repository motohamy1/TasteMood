import type { ImageProps } from "expo-image";

/**
 * Thin monochrome line icons for the light "market" browse UI, as tint-baked
 * SVG data URIs (same approach as tab-icons.ts so expo-image renders them on
 * Android). Kept separate from the tab icons because these are for the
 * dishes/home screen chrome, not the tab bar.
 */
const ICON_PATHS: Record<string, string> = {
  menu: '<g stroke="{{c}}" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></g>',
  search:
    '<g fill="none" stroke="{{c}}" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.7-3.7"/></g>',
  back: '<g fill="none" stroke="{{c}}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></g>',
  chevron:
    '<g fill="none" stroke="{{c}}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></g>',
  utensil:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3v6a2 2 0 0 0 4 0V3"/><path d="M8.5 11v10"/><path d="M16.5 3c-1.4.9-2 2.8-2 4.8 0 1.6.7 2.4 2 2.4"/><path d="M16.5 3v18"/></g>',
};

export function marketIcon(
  name: keyof typeof ICON_PATHS | string,
  color: string,
  size = 22
): ImageProps["source"] {
  const inner = (ICON_PATHS[name] ?? "").replace(/\{\{c\}\}/g, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}</svg>`;
  return { uri: `data:image/svg+xml;base64,${btoa(svg)}` };
}
