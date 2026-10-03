/**
 * Light "wine & blush" palette — extracted from the reference design system.
 *
 * Ground:   blush whites (#FBF5F7 range, faint wine hue ~340)
 * Cards:    pure white surfaces with soft rose-tinted elevation
 * Accent:   crimson (#C0245C) — small accents, badges, + buttons, prices
 * CTA:      deep wine (#7E1039) — primary buttons, search pill, AI orb
 * Ink:      deep wine-black text hierarchy on the light surfaces
 *
 * Key names are stable — screens import COLORS.* by name. The values were
 * re-skinned from the previous dark/orange system to the light wine system
 * without touching any screen logic. Text-on-fill keys (`night`) flipped to
 * white because fills are now deep enough to carry white labels.
 */
export const COLORS = {
  /** Page ground — blush white */
  ink950: "#FBF5F7",
  /** Cards / panels — pure white */
  panel: "#FFFFFF",
  /** Raised insets / secondary surfaces / photo placeholders */
  raised: "#F7EAF0",
  /** Hairline borders on light surfaces */
  line: "#F0DEE6",
  /** Blush tint — chips, tags, soft fills */
  wine: "#F9E7EE",
  /** Deeper blush tint — icon tiles, active shells */
  wineDeep: "#F3D3E0",
  /** Primary crimson — accents, badges, + buttons, links, prices */
  amber: "#C0245C",
  /** Deep wine — primary CTAs, search pill, AI orb */
  amberCta: "#7E1039",
  /** Accent used as text on light surfaces */
  accentText: "#B01A50",
  /** CTA gradient stops (kept for a future LinearGradient pass) */
  ctaFrom: "#A11C50",
  ctaTo: "#6E0E31",
  /** Headings & body text on light — deep wine-black */
  cream: "#2A0F1C",
  /** Secondary text on light */
  dim: "#6B4453",
  /** Muted meta text on light */
  mute: "#8A6676",
  /** Decorative / disabled only — never body copy */
  faint: "#B69AA7",
  /** Text on wine / crimson fills */
  night: "#FFFFFF",
  /** Text on crimson accents (alias of night) */
  onAmber: "#FFFFFF",
  /** Text on white cards */
  onCard: "#2A0F1C",
  onCardMuted: "#8A6676",
  onCardPrice: "#B01A50",
  onCardTag: "#A3164A",
  /** Frosted white pill behind icons sitting on photos */
  pillOnPhoto: "rgba(255,255,255,0.94)",
  /** Placeholder text inside the deep-wine search pill */
  searchPlaceholder: "rgba(255,255,255,0.72)",
  /** Selected state */
  ember: "#A3164A",
  /** Tab bar */
  shell: "#FFFFFF",
  shellActive: "#FDF2F6",
  shellLine: "#F3E2E9",
  /** Tab icon states */
  iconIdle: "#96697E",
  iconOn: "#C0245C",
  /** Semantic — success / dietary */
  successText: "#147A46",
  successBg: "#E6F6EC",
  successLine: "#C4E8D2",
  /** Semantic — danger */
  dangerText: "#B02B4B",
  dangerBg: "#FBE9EE",
  dangerLine: "#F2CBD6",
  /** Ambient blush glow */
  glowBlush: "#EE9DBD",
} as const;

/** Rose elevation for white cards sitting on the blush ground. */
export const CARD_SHADOW = "0 4px 14px rgba(126,16,57,0.08)";

/** Glowing wine halo behind the floating AI/CTA button. */
export const AI_BUTTON_GLOW =
  "0 6px 20px 4px rgba(126,16,57,0.40), 0 0 14px 2px rgba(194,36,92,0.28)";
