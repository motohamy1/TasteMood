import type { ImageProps } from "expo-image";

/** Line icons lifted from the design, as tint-baked SVG data URIs. */
const ICON_PATHS: Record<string, string> = {
  ai: '<path d="M12 3.6c.7 4.4 3.9 7.7 8.4 8.4-4.5.7-7.7 4-8.4 8.4-.7-4.4-3.9-7.7-8.4-8.4 4.5-.7 7.7-4 8.4-8.4z" fill="{{c}}"/>',
  index:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 15.5a7.8 7.8 0 0 1 15.6 0"/><path d="M3 15.5h18"/><path d="M12 7.7V6.2"/><circle cx="12" cy="5.1" r="1"/><path d="M5.5 19.2h13"/></g>',
  favourites:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3S4.8 15.7 4.8 10.6a4.1 4.1 0 0 1 7.2-2.6 4.1 4.1 0 0 1 7.2 2.6c0 5.1-7.2 9.7-7.2 9.7z"/></g>',
  personality:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.6" cy="8.4" r="3.3"/><path d="M4.3 19c1.2-3.2 3.5-4.8 6.3-4.8s5.1 1.6 6.3 4.8"/><path d="M19.4 2.9c.3 1.55 1.15 2.4 2.7 2.7-1.55.3-2.4 1.15-2.7 2.7-.3-1.55-1.15-2.4-2.7-2.7 1.55-.3 2.4-1.15 2.7-2.7z" stroke-width="1.4"/></g>',
  profile:
    '<g fill="none" stroke="{{c}}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.4" r="3.4"/><path d="M5.5 19c1.3-3.2 3.7-4.8 6.5-4.8s5.2 1.6 6.5 4.8"/></g>',
  send:
    '<g fill="none" stroke="{{c}}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3.5 10.4 14.1"/><path d="M21 3.5 14.2 21l-3.8-6.9L3.5 10.3z"/></g>',
};

export function tabIcon(
  name: string,
  color: string,
  size = 24
): ImageProps["source"] {
  const inner = (ICON_PATHS[name] ?? "").replace(/\{\{c\}\}/g, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${inner}</svg>`;
  // expo-image requires base64 data URIs to render SVG (URI-encoded ones
  // silently fail on Android).
  return { uri: `data:image/svg+xml;base64,${btoa(svg)}` };
}
