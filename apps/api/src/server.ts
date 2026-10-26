import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createPool } from "./db/pool";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const app = await buildApp({ config, pool });

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
