/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Veganologie forest-green brand palette
        forest: {
          50: "#eef4f0",
          100: "#d6e5db",
          200: "#aecbba",
          300: "#7fac92",
          400: "#4f8869",
          500: "#2f6b4c",
          600: "#1f5a3c",
          700: "#14442e",
          800: "#0e3323",
          900: "#0a2419",
        },
        cream: "#f7f6f2",
        gold: "#b08d57",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
