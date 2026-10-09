import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure it in wrangler.cloudflare.jsonc for a direct Cloudflare deployment or set the `d1` field in .openai/hosting.json to `DB` when using Sites."
    );
  }

  return drizzle(env.DB, { schema });
}
