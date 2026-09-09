// Cloudflare Pages — modo avançado (_worker.js).
// CF Pages NÃO faz proxy pra origem externa via _redirects; então o proxy do
// /api/* pro backend (Render) é feito aqui. O resto vira asset estático (com o
// SPA fallback do _redirects aplicado pelo binding ASSETS).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const apiOrigin = env.API_ORIGIN?.replace(/\/$/, "");
      if (!apiOrigin) {
        return Response.json(
          { error: "API_ORIGIN não configurada no Cloudflare Pages" },
          { status: 503 },
        );
      }
      // Repassa método, headers (inclui Authorization: Bearer) e body ao Render.
      return fetch(new Request(apiOrigin + url.pathname + url.search, request));
    }
    // Estáticos + SPA fallback (via _redirects).
    return env.ASSETS.fetch(request);
  },
};
