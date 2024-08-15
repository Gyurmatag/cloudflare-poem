import { Config } from "drizzle-kit"

export default {
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  driver: "d1-http"
} satisfies Config;
