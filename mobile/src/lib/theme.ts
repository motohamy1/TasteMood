/**
 * Raw hex values mirroring tailwind.config.js — for props that cannot take
 * classNames (placeholderTextColor, ActivityIndicator color, shadows, SVG
 * tints). Keep this in sync with the config; the derivation rules
 * (brand H69 / clay H45 / ink H28 / wine H19, C at 85% of sRGB max) live there.
 *
 * Palette: candlelit-wine (Paper design).
 */
export const COLORS = {
  /** Page ground, deepest warm near-black */
  ink950: "#100706",
  /** Dark panels / inputs / cards-on-dark */
  panel: "#1E110F",
  /** Skeleton bars / raised insets */
  raised: "#2D1D1B",
  /** Default hairline on dark surfaces */
  line: "#3D2926",
  /** Wine-filled chips + intent panel border */
  wine: "#5A1A20",
  /** Deep tint behind dish photos */
  wineDeep: "#3B1D1E",
  /** Primary amber — accents and fills that carry no text */
  amber: "#DD963A",
  /** Amber fill for text-bearing buttons/chips (night label clears Lc 75) */
  amberCta: "#F8BE7D",
  /** Amber used as text on dark ground (brand-500 only reached Lc 53) */
  accentText: "#EEC89F",
  /** Headings & text on dark */
  cream: "#FEF7EC",
  /** Secondary text on dark */
  dim: "#EAD8BF",
  /** Muted text on dark */
  mute: "#E3C69F",
  /** Decorative only — placeholders (Lc 53, do not use for real text) */
  faint: "#BBA07A",
  /** Text on amber / cream surfaces */
  night: "#150A08",
  /** Icon strokes on amber orbs */
  onAmber: "#23180F",
  /** Text on the cream (brand-50) cards */
  onCard: "#110C08",
  onCardMuted: "#7A634A",
  onCardPrice: "#A65229",
  onCardTag: "#874728",
  /** Selected-state red */
  ember: "#86232F",
  /** Floating tab-bar pill + states */
  shell: "#F0E6D9",
  shellActive: "#E3CAAB",
  shellLine: "#CEAF96",
  /** Tab-bar icon states on the shell pill */
  iconIdle: "#6C5A47",
  iconOn: "#882325",
  /** Error text */
  dangerText: "#FACCCC",
} as const;

/** Glowing amber halo behind the floating AI tab button. */
export const AI_BUTTON_GLOW =
  "0 2px 17px 2px rgba(221,150,58,0.27), 0 0 13px 1px rgba(221,150,58,0.21)";
