// Entrypoint Node (`@hono/node-server`) — dev local, Render, `node dist/index.js`.
// O app Hono (rotas/middlewares) vive em app.ts, compartilhado com worker.ts
// (entrypoint Cloudflare Worker), pra não duplicar o roteamento entre os dois.
//
// Os bootstraps idempotentes (dono, resultados ginecológicos, backfill de
// propriedade) não disparam mais sozinhos aqui — viraram scripts manuais em
// server/src/scripts/, rodados depois do deploy (Node ou Worker, mesmo
// comando pros dois). Não existe "boot" de processo dentro de um Cloudflare
// Worker pra disparar isso sozinho, então o mesmo tratamento vale pros dois
// runtimes em vez de só funcionar num deles.
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});
