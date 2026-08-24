// Prisma CLI (migrate/generate/studio) does not auto-load `.env.local` the way
// Next.js does — it only auto-loads `.env`. Load it explicitly here so
// `prisma migrate dev` etc. see the same DATABASE_URL as `next dev`.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// `quiet: true` is required: without it dotenv v17 prints an "injected env" notice to
// **stdout**, which gets mixed into the SQL that `prisma migrate dev` /
// `migrate diff --script` write to the same stdout — producing a migration.sql whose
// first line is not SQL and breaking `prisma migrate deploy` in production.
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
