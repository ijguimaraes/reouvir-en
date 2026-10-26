import { loadConfig } from "./config";

export function testConfig(databaseUrl: string, overrides: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: process.env.SESSION_SECRET ?? "segredo-de-teste-com-mais-de-32-caracteres!!",
    COOKIE_SECURE: "false",
    ...overrides,
  });
}

/** MP3 sintético válido: `n` quadros MPEG1 Layer III, 128 kbps, 44,1 kHz. */
export function fakeMp3(n = 100): Buffer {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  return Buffer.concat(Array.from({ length: n }, () => frame));
}
