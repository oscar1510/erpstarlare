import { existsSync } from "fs";
import { defineConfig } from "prisma/config";

// A prisma.config.ts file disables Prisma's old implicit .env loading, so
// load it explicitly for local dev. On Vercel, env vars are already present
// in process.env (no .env file exists there), so this is a no-op.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
