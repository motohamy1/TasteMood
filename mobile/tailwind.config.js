/**
 * Candlelit-wine palette.
 *
 * Every value below was derived in OKLCH and clamped to sRGB (values ship as
 * hex because these also feed React Native props via lib/theme.ts, which must
 * render identically on Android). The derivation rules are the contract:
 *
 *   brand  amber     H 69 constant, L steps of -0.05, C at 85% of sRGB max
 *   clay   burnt-or  H 45 constant — burnt orange for TEXT on cream cards
 *   ink    warm      H 28 constant, low chroma (was plum 347 / brown 29 split)
 *   wine   red       H 19 constant — wine / wine-deep / ember / glow share it
 *
 * Contrast budgets (APCA Lc, measured — see lib/theme.ts header):
 *   text on dark ground   cream 104 · cream-dim 85 · cream-mute 75 · accent 78
 *   text on cream card    oncard 102 · -tag 82 · -muted 76 · -price 75
 *   primary CTA label     night on brand-cta = 75
 *
 * amber-at-full-saturation cannot carry a dark label above Lc 56, so text
 *-bearing buttons use brand-cta (lighter) — see the note on brand.cta below.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Amber. 50-500 are the accent band; 600+ are deeper fills.
        // Do NOT use 600/700 for text on cream cards — that is what `clay` is
        // for; those steps used to be Tailwind orange-700/900/950, a different
        // hue, which is why the old ramp drifted 60deg.
        brand: {
          50: "#FEF6EE", // card surface
          100: "#FCE2C8",
          200: "#FACE9F",
          300: "#F7B971",
          400: "#F2A440",
          500: "#DD963A", // brand amber — accents/fills with no text
          600: "#B5792D",
          700: "#8E5F22",
          800: "#6E4817",
          900: "#4F320E",
          950: "#311E06",
          // Text-bearing amber only. Lighter than 400 on purpose: at 500's
          // saturation no dark label clears APCA 60, and this clears 75.
          cta: "#F8BE7D",
        },
        // Burnt orange for prices / tags / "why" copy on cream cards.
        clay: {
          100: "#FAD5C5",
          300: "#E67338",
          400: "#CA6330",
          500: "#AE5528",
          600: "#8C431E",
          700: "#703416",
        },
        // Dark plum-brown ground + panels (H 28 throughout).
        ink: {
          950: "#100706",
          900: "#1E110F",
          800: "#2D1D1B",
          700: "#3D2926",
        },
        // Text on dark surfaces. Warm off-whites, not the neutral stone grays
        // these used to be. `faint` is decorative only (placeholders).
        cream: {
          DEFAULT: "#FEF7EC",
          dim: "#EAD8BF",
          mute: "#E3C69F",
          faint: "#BBA07A",
        },
        // Text on the cream (brand-50) cards — the layer that was missing,
        // which is why dark-surface tokens were being borrowed onto light cards.
        oncard: {
          DEFAULT: "#110C08", // titles
          muted: "#7A634A", // restaurant, rating, badges
          price: "#A65229", // price + panel headings
          tag: "#874728", // taste tags, AI "why" copy
        },
        // Amber used as TEXT on dark ground (brand-500 only reached Lc 53).
        accent: "#EEC89F",
        // Text on amber / cream surfaces
        night: "#150A08",
        // Icon strokes on amber orbs (non-text; WCAG 3:1 graphic floor).
        "on-amber": "#23180F",
        // Wine-filled chips; deep tint behind dish photos (all H 19).
        wine: {
          DEFAULT: "#5A1A20",
          deep: "#3B1D1E",
        },
        // Deep red used for selected states.
        ember: "#86252F",
        // Ambient radial glow
        glow: "#6E1A24",
        // Floating tab-bar pill + its states. `shell-active` replaces the old
        // bg-ember/10, which composited to an off-palette pink (H 41).
        shell: {
          DEFAULT: "#F0E6D9",
          active: "#E3CAAB",
          line: "#CEAF96",
        },
        // Tab-bar icon states on the shell pill
        icon: {
          idle: "#6C5A47",
          on: "#882325",
        },
        // Semantic: open now / dietary. Light for dark ground, ink for cards.
        success: {
          DEFAULT: "#8BE2A3",
          ink: "#3A6345",
          bg: "#1E3023",
        },
        danger: {
          DEFAULT: "#FACCCC",
          bg: "#2E100F",
          line: "#7E2222",
        },
        // Ingredient chips on dark
        "neutral-chip": "#332921",
        // Hairline border on cream cards
        cardline: "#E7D5C4",
      },
      fontFamily: {
        // Use platform default sans
        sans: process.env.EXPO_OS === "ios" ? "System" : "sans-serif",
      },
    },
  },
  plugins: [],
};
