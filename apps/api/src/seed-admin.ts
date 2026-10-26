import { loadConfig } from "./config";
import { createPool } from "./db/pool";
import { AuthRepository } from "./modules/auth/auth.repository";
import { hashPassword } from "./modules/auth/auth.service";

const config = loadConfig();
if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) {
  console.error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env");
  process.exit(1);
}

const pool = createPool(config.DATABASE_URL);
const repo = new AuthRepository(pool);
const email = config.ADMIN_EMAIL.trim().toLowerCase();

if (await repo.findUserByEmail(email)) {
  console.log(`Administrador ${email} já existe. Nada a fazer.`);
} else {
  await repo.createUser({
    email,
    name: "Administrador",
    passwordHash: await hashPassword(config.ADMIN_PASSWORD),
    role: "admin",
  });
  console.log(`Administrador ${email} criado.`);
}
await pool.end();
