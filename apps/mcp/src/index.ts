import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAdminSession } from "./session";
import { registerTools } from "./tools";

const { REOUVIR_URL, REOUVIR_EMAIL, REOUVIR_PASSWORD } = process.env;
if (!REOUVIR_URL || !REOUVIR_EMAIL || !REOUVIR_PASSWORD) {
  // stdout é o canal do protocolo; mensagens vão para stderr.
  console.error("Defina REOUVIR_URL (ex.: https://host.ts.net/api), REOUVIR_EMAIL e REOUVIR_PASSWORD");
  process.exit(1);
}

const api = createAdminSession({ baseUrl: REOUVIR_URL, email: REOUVIR_EMAIL, password: REOUVIR_PASSWORD });
await api.login();

const server = new McpServer({ name: "reouvir", version: "0.1.0" });
registerTools(server, api);
await server.connect(new StdioServerTransport());
