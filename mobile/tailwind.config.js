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
        // Candlelit-wine palette — synced with the Paper design
        // brand = amber primary; 600/700/900 are the warm inks used on
        // cream cards (price, tag text, "why" copy).
        brand: {
          50: "#FFF7ED",
          100: "#FED7AA",
          200: "#E9BB82",
          300: "#E3A85F",
          400: "#DE9E47",
          500: "#DB9338",
          600: "#C2410C",
          700: "#7C2D12",
          800: "#5C3310",
          900: "#431407",
          950: "#2A1215",
        },
        // Dark plum ground + panels
        ink: {
          950: "#0F070B",
          900: "#1C1210",
          800: "#2A1E1C",
          700: "#3A2A28",
        },
        // Text on dark surfaces
        cream: {
          DEFAULT: "#FFF7ED",
          dim: "#D6D3D1",
          mute: "#A8A29E",
          faint: "#78716C",
        },
        // Text on amber / cream surfaces
        night: "#0E0808",
        // Wine-filled chips; deep tint behind dish photos
        wine: {
          DEFAULT: "#5A1A22",
          deep: "#3A1E1E",
        },
        // Active tab ink
        ember: "#94001D",
        // Ambient radial glow
        glow: "#760420",
        // Floating tab-bar pill
        shell: "#F0E6D9",
        // Hairline border on cream cards
        cardline: "#E7D5C5",
      },
      fontFamily: {
        // Use platform default sans
        sans: process.env.EXPO_OS === "ios" ? "System" : "sans-serif",
      },
    },
  },
  plugins: [],
};
