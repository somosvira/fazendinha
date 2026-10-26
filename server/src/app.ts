import { gerencialRouter } from "./routes/gerencial.js";
// Construção do app Hono — roteamento, CORS e os gates de auth/área. Runtime-
// agnóstico de propósito: tanto index.ts (entrypoint Node, `@hono/node-server`)
// quanto worker.ts (entrypoint Cloudflare Worker) importam o mesmo `app` daqui.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { resetPrismaPorRequisicao } from "./db.js";
import { authMiddleware } from "./middleware/auth.js";
import { exigeArea, exigeQualquerArea } from "./middleware/permissao.js";
import { categoriasRouter } from "./routes/categorias.js";
import { financeiroRouter } from "./routes/financeiro.js";
import { healthRouter } from "./routes/health.js";
import { authPrivadoRouter } from "./routes/auth.js";
import { usuariosRouter } from "./routes/usuarios.js";
import { propriedadeRouter } from "./routes/propriedade.js";
import { rebanhoRouter as pecuariaRebanhoRouter } from "./routes/pecuaria/rebanho.js";
import { estoqueRouter } from "./routes/estoque.js";
import { relatorioGerencialRouter } from "./routes/relatorio-gerencial.js";
import { relatoriosFinanceirosRouter } from "./routes/relatorios-financeiros.js";
import { buscaRouter } from "./routes/busca.js";
import { assistenteRouter } from "./routes/assistente.js";
import { whatsappRouter } from "./routes/whatsapp.js";
import { ASSISTENTE_ATIVO, rotaDoAssistente } from "./featureFlags.js";

export const app = new Hono();

// Precisa ser o PRIMEIRO middleware, antes até das rotas isentas de auth
// (health, whatsapp): garante um PrismaClient novo por requisição dentro do
// Worker, antes de qualquer query rodar (ver comentário em db.ts). Fora do
// Worker é um no-op.
app.use("*", async (c, next) => {
  resetPrismaPorRequisicao();
  await next();
});

app.use("*", logger());

const corsOrigins = env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
if (env.NODE_ENV === "production" && (!corsOrigins || corsOrigins.length === 0)) {
  console.warn("[cors] CORS_ORIGIN vazio em produção — API está permissiva a qualquer origem. Setar antes do teste com dono.");
}
app.use(
  "/api/*",
  cors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : "*",
  })
);
// Suspensão temporária e reversível do assistente. As rotas continuam montadas
// abaixo, mas nenhum canal aceita chamadas enquanto a chave estiver desligada.
app.use("/api/*", async (c, next) => {
  if (!ASSISTENTE_ATIVO && rotaDoAssistente(new URL(c.req.url).pathname)) {
    return c.json({ error: "Assistente temporariamente indisponível", code: "FEATURE_DISABLED" }, 503);
  }
  await next();
});
// Isentos de sessão: health e WhatsApp, que tem validação HMAC própria.
app.route("/api", healthRouter);
app.route("/api", whatsappRouter);

app.use("/api/*", authMiddleware);

// Autorização por domínio: o frontend também esconde os módulos, mas este gate
app.use("/api/pecuaria/rebanho/*", exigeArea("pecuaria"));
for (const path of [
  "/api/financeiro", "/api/financeiro/*", "/api/categorias", "/api/categorias/*",
]) app.use(path, exigeArea("financeiro"));
app.use("/api/estoque/*", exigeQualquerArea(["pecuaria", "financeiro"]));

// Protegidos (exigem sessão resolvida pelo authMiddleware):
app.route("/api", authPrivadoRouter);
app.route("/api", usuariosRouter);
app.route("/api", propriedadeRouter);
app.route("/api", categoriasRouter);
app.route("/api", financeiroRouter);
app.route("/api", gerencialRouter);
app.route("/api/pecuaria/rebanho", pecuariaRebanhoRouter);
app.route("/api", estoqueRouter);
app.route("/api", relatorioGerencialRouter);
app.route("/api", relatoriosFinanceirosRouter);
app.route("/api", buscaRouter);
app.route("/api", assistenteRouter);
