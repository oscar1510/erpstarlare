import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pure static single-page app — no server, no database.
// Vercel auto-detects Vite; `npm run build` emits to dist/.
export default defineConfig({
  plugins: [react()],
});
