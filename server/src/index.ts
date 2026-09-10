// Entrypoint Node (`@hono/node-server`) — dev local, Render, `node dist/index.js`.
// O app Hono (rotas/middlewares) vive em app.ts, compartilhado com worker.ts
// (entrypoint Cloudflare Worker), pra não duplicar o roteamento entre os dois.
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";
import { garantirDonoBootstrap } from "./services/auth/usuarios.js";
import { garantirResultadosGinecologicosSemente } from "./services/rebanho/exame-ginecologico.js";

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});

// Dicionário operacional mínimo até a reextração dos 44 resultados oficiais.
garantirResultadosGinecologicosSemente().catch((e) => console.error("[rebanho] falha ao semear resultados ginecológicos:", e));

// Cria o dono no primeiro boot (tabela Usuario vazia + AUTH_BOOTSTRAP_EMAIL).
garantirDonoBootstrap().catch((e) => console.error("[auth] falha no bootstrap do dono:", e));
