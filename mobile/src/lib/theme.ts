/**
 * Raw hex values mirroring tailwind.config.js — for props that cannot take
 * classNames (placeholderTextColor, ActivityIndicator color, shadows, SVGs).
 * Palette: candlelit-wine (Paper design).
 */
export const COLORS = {
  /** Page ground, deepest plum-black */
  ink950: "#0F070B",
  /** Dark panels / inputs / cards-on-dark */
  panel: "#1C1210",
  /** Skeleton bars / raised insets */
  raised: "#2A1E1C",
  /** Default hairline on dark surfaces */
  line: "#3A2A28",
  /** Wine-filled chips + intent panel border */
  wine: "#5A1A22",
  /** Primary amber */
  amber: "#DB9338",
  /** Headings & text on dark */
  cream: "#FFF7ED",
  /** Secondary text on dark */
  mute: "#A8A29E",
  /** Text on amber surfaces */
  night: "#0E0808",
  /** Active tab icon */
  ember: "#94001D",
  /** Inactive tab icon */
  taupe: "#7A6357",
  /** Error text */
  dangerText: "#FECACA",
  /** Floating tab-bar pill */
  shell: "#F0E6D9",
} as const;

/** Glowing amber halo behind the floating AI tab button. */
export const AI_BUTTON_GLOW =
  "0 2px 17px 2px rgba(219,147,56,0.27), 0 0 13px 1px rgba(219,147,56,0.21)";
