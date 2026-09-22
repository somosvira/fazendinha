// Entrypoint Cloudflare Worker (referenciado por `main` no wrangler.jsonc).
// Mesmo `app` do index.ts (Node) — o Hono já implementa a Fetch API, então
// exportar ele direto é o padrão oficial do Hono pra Workers. Quem decide
// que só `/api/*` chega até aqui (o resto vira asset estático ou SPA
// fallback) é o `assets.run_worker_first`/`not_found_handling` do
// wrangler.jsonc, não este arquivo.
import "./lib/dom-parser-polyfill.js";

export { app as default } from "./app.js";
