import { loadConfig } from "./config";
import { createPool } from "./db/pool";
import { cleanupOrphanAudios } from "./modules/audio/audio-cleanup";
import { LocalStorage } from "./storage/storage";

// Uso: pnpm cleanup:audio [--apply]   (sem --apply só mostra o que seria removido)
const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const result = await cleanupOrphanAudios(pool, new LocalStorage(config.AUDIO_DIR), { dryRun: !process.argv.includes("--apply") });
console.log(result.removed ? "Removidos:" : "Seriam removidos (use --apply):", result);
await pool.end();
