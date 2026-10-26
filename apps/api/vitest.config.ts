import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Os testes de integração compartilham um único banco: sem paralelismo entre arquivos.
    fileParallelism: false,
    env: { SESSION_SECRET: "segredo-de-teste-com-mais-de-32-caracteres!!" },
  },
});
