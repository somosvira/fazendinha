// Cloudflare Pages — modo avançado (_worker.js).
// CF Pages NÃO faz proxy pra origem externa via _redirects; então o proxy do
// /api/* pro backend (Render) é feito aqui. O resto vira asset estático (com o
// SPA fallback do _redirects aplicado pelo binding ASSETS).
const API_ORIGIN = "https://rionovo-api.onrender.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      // Repassa método, headers (inclui Authorization: Bearer) e body ao Render.
      return fetch(new Request(API_ORIGIN + url.pathname + url.search, request));
    }
    // Estáticos + SPA fallback (via _redirects).
    return env.ASSETS.fetch(request);
  },
};
