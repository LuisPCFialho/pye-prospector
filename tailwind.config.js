/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand = orange (matches planno.io accent + the rest of the app)
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea6d0e",
          700: "#c2570c",
        },
        // Dark theme surface tokens
        surface: {
          base: "#0d0e1a",     // app background
          panel: "#13131f",    // sidebar / panels
          raised: "#1a1a2e",   // modals
          input: "#1e1f30",    // inputs / chips
          border: "#2a2b3d",   // borders
        },
      },
    },
  },
  plugins: [],
};
