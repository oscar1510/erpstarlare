import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce8ff",
          200: "#b9d1ff",
          300: "#8bb0ff",
          400: "#5c8bff",
          500: "#3a66f5",
          600: "#2a4bd1",
          700: "#233ca8",
          800: "#1f3384",
          900: "#1c2c6b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
