// Entrypoint Node (`@hono/node-server`) — desenvolvimento local.
// O app Hono (rotas/middlewares) vive em app.ts, compartilhado com worker.ts
// (entrypoint Cloudflare Worker), pra não duplicar o roteamento entre os dois.
//
// Os bootstraps de dono/propriedade são scripts manuais em server/src/scripts/.
// O deploy usa worker.ts; iniciar este servidor local não executa bootstraps.
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});
