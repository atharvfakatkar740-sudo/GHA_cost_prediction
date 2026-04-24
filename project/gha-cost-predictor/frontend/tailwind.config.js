/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // GitHub dark canvas palette
        gh: {
          canvas:   "#0d1117",
          surface:  "#161b22",
          surface2: "#1c2128",
          border:   "#30363d",
          border2:  "#21262d",
          text:     "#c9d1d9",
          muted:    "#8b949e",
          blue:     "#58a6ff",
          "blue-dark": "#1f6feb",
          green:    "#3fb950",
          "green-dark": "#238636",
          orange:   "#f0883e",
          red:      "#f85149",
          teal:     "#39d0d8",
          purple:   "#bc8cff",
          yellow:   "#e3b341",
        },
        // Glow colors for box-shadow via arbitrary values
        glow: {
          teal:  "rgba(57,208,216,0.18)",
          blue:  "rgba(88,166,255,0.18)",
          green: "rgba(63,185,80,0.18)",
        },
        // Keep brand alias pointing at GitHub blue for backward compatibility
        brand: {
          50:  "#ddf4ff",
          100: "#cae8ff",
          200: "#a5d6ff",
          300: "#79c0ff",
          400: "#58a6ff",
          500: "#388bfd",
          600: "#1f6feb",
          700: "#1158c7",
          800: "#0d419d",
          900: "#0a2d6e",
        },
        // Surface aliases for legacy component classes
        surface: {
          50:  "#f6f8fa",
          100: "#eaeef2",
          200: "#d0d7de",
          300: "#afb8c1",
          700: "#1c2128",
          800: "#161b22",
          900: "#0d1117",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Noto Sans",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ["SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        xl:  "0.75rem",
        "2xl": "0.875rem",
      },
      boxShadow: {
        "glow-teal":  "0 0 24px rgba(57,208,216,0.25), 0 1px 0 #30363d",
        "glow-blue":  "0 0 24px rgba(88,166,255,0.20), 0 1px 0 #30363d",
        "glow-green": "0 0 24px rgba(63,185,80,0.20), 0 1px 0 #30363d",
        "card":       "0 1px 0 #30363d, 0 4px 16px rgba(1,4,9,0.4)",
        "card-hover": "0 1px 0 #30363d, 0 8px 24px rgba(1,4,9,0.6)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
