/**
 * Light "wine & blush" palette — reference design system.
 *
 * Ground:   #FBF5F7 (blush white, faint wine hue)
 * Cards:    #FFFFFF with soft rose elevation (see lib/theme CARD_SHADOW)
 * Crimson:  #C0245C — accents, badges, + buttons, prices
 * Wine:     #7E1039 — primary CTAs, search pill, AI orb (brand.cta)
 * Ink:      #2A0F1C text hierarchy on light surfaces
 *
 * Class names are stable (bg-ink-950, text-cream, bg-brand-cta, ...); only
 * the values were re-skinned from the previous dark/orange system.
 * `night` (#FFFFFF) is for text on wine/crimson fills; `cream` is now the
 * deep ink used on light surfaces.
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
        // Wine/crimson brand scale — the dominant accent family.
        brand: {
          50: "#FDF2F6",
          100: "#FBE4EC",
          200: "#F5C9D8",
          300: "#EDA3BC",
          400: "#E06E97",
          500: "#C0245C", // primary crimson
          600: "#A3164A",
          700: "#84113C",
          800: "#650D2F",
          900: "#470923",
          950: "#2B0515",
          cta: "#7E1039", // deep wine — text-bearing CTA fill
        },
        // Rose tones for tags / prices on light cards (legacy scale name).
        clay: {
          100: "#F9E7EE",
          300: "#E06E97",
          400: "#C0245C",
          500: "#A3164A",
          600: "#84113C",
          700: "#650D2F",
        },
        // Light surfaces: blush ground → white cards → raised insets → hairlines.
        ink: {
          950: "#FBF5F7", // page ground
          900: "#FFFFFF", // cards / inputs / panels
          800: "#F7EAF0", // raised surfaces / photo placeholders
          700: "#F0DEE6", // hairlines / chip borders
        },
        // Text on light surfaces. Deep wine-black hierarchy.
        cream: {
          DEFAULT: "#2A0F1C",
          dim: "#6B4453",
          mute: "#8A6676",
          faint: "#B69AA7",
        },
        // Text on white cards (legacy compat)
        oncard: {
          DEFAULT: "#2A0F1C",
          muted: "#8A6676",
          price: "#B01A50",
          tag: "#A3164A",
        },
        // Crimson used as TEXT on light surfaces
        accent: "#B01A50",
        // Text on wine / crimson fills
        night: "#FFFFFF",
        // Icon strokes on wine orbs
        "on-amber": "#FFFFFF",
        // Blush tint chips
        wine: {
          DEFAULT: "#F9E7EE",
          deep: "#F3D3E0",
        },
        // Selected active state
        ember: "#A3164A",
        // Ambient radial glow color
        glow: "#EE9DBD",
        // Bottom tab-bar
        shell: {
          DEFAULT: "#FFFFFF",
          active: "#FDF2F6",
          line: "#F3E2E9",
        },
        // Tab-bar icon states
        icon: {
          idle: "#96697E",
          on: "#C0245C",
        },
        // Semantic: open / dietary
        success: {
          DEFAULT: "#147A46",
          ink: "#17663B",
          bg: "#E6F6EC",
        },
        danger: {
          DEFAULT: "#B02B4B",
          bg: "#FBE9EE",
          line: "#F2CBD6",
        },
        // Inset chips on white cards
        "neutral-chip": "#F7EAF0",
        // Hairline border on cards
        cardline: "#F0DEE6",
      },
      fontFamily: {
        sans: process.env.EXPO_OS === "ios" ? "System" : "sans-serif",
      },
    },
  },
  plugins: [],
};
