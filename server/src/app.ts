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
import { authPublicoRouter, authPrivadoRouter } from "./routes/auth.js";
import { usuariosRouter } from "./routes/usuarios.js";
import { canalRecuperacaoConfigurado } from "./services/auth/email.js";
import { propriedadeRouter } from "./routes/propriedade.js";
import { rebanhoRouter as pecuariaRebanhoRouter } from "./routes/pecuaria/rebanho.js";
import { estoqueRouter } from "./routes/estoque.js";
import { estoqueCentrosRouter } from "./routes/estoque-centros.js";
import { relatorioGerencialRouter } from "./routes/relatorio-gerencial.js";
import { relatoriosFinanceirosRouter } from "./routes/relatorios-financeiros.js";
import { plantioTalhoesRouter } from "./routes/plantio/talhoes.js";
import { plantioDashboardRouter } from "./routes/plantio/dashboard.js";
import { plantioCadastrosRouter } from "./routes/plantio/cadastros.js";
import { plantioEventosRouter } from "./routes/plantio/eventos.js";
import { plantioCustoRouter } from "./routes/plantio/custo.js";
import { plantioColheitaRouter } from "./routes/plantio/colheita.js";
import { plantioPlanejamentoRouter } from "./routes/plantio/planejamento.js";
import { plantioIaRouter } from "./routes/plantio/ia.js";
import { cultivoSafrasRouter } from "./routes/cultivo/safras.js";
import { cultivoAreasRouter } from "./routes/cultivo/areas.js";
import { cultivoCustosRouter } from "./routes/cultivo/custos.js";
import { cultivoProducaoRouter } from "./routes/cultivo/producao.js";
import { cultivoSilosRouter } from "./routes/cultivo/silos.js";
import { cultivoDashboardRouter } from "./routes/cultivo/dashboard.js";
import { pontoRouter } from "./routes/ponto/index.js";
import { pontoDashboardRouter } from "./routes/ponto/dashboard.js";
import { buscaRouter } from "./routes/busca.js";
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
if (env.NODE_ENV === "production" && !env.SHARED_ACCESS_TOKEN) {
  console.warn("[auth] SHARED_ACCESS_TOKEN vazio em produção — API está aberta a qualquer requisição. Setar antes do teste com dono.");
}
if (env.NODE_ENV === "production" && !canalRecuperacaoConfigurado()) {
  console.warn("[auth] recuperação de senha sem canal configurado — defina APP_BASE_URL, AUTH_EMAIL_PROVIDER, AUTH_EMAIL_FROM e RESEND_API_KEY.");
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
// Isentos de sessão (montados ANTES do gate): health, whatsapp (valida por HMAC
// próprio) e as rotas públicas de auth (login/convite/reset).
app.route("/api", healthRouter);
app.route("/api", whatsappRouter);
app.route("/api", authPublicoRouter);

app.use("/api/*", authMiddleware);

// Autorização por domínio: o frontend também esconde os módulos, mas este gate
// impede acesso por URL/cURL. Agricultura reúne os módulos Plantio e Cultivo.
app.use("/api/pecuaria/rebanho/*", exigeArea("pecuaria"));
app.use("/api/plantio/*", exigeArea("agricultura"));
app.use("/api/cultivo/*", exigeArea("agricultura"));
app.use("/api/ponto/*", exigeArea("equipe"));
for (const path of [
  "/api/financeiro", "/api/financeiro/*", "/api/categorias", "/api/categorias/*",
]) app.use(path, exigeArea("financeiro"));
app.use("/api/estoque/*", exigeQualquerArea(["pecuaria", "agricultura", "financeiro"]));

// Protegidos (exigem sessão resolvida pelo authMiddleware):
app.route("/api", authPrivadoRouter);
app.route("/api", usuariosRouter);
app.route("/api", propriedadeRouter);
app.route("/api", categoriasRouter);
app.route("/api", financeiroRouter);
app.route("/api/pecuaria/rebanho", pecuariaRebanhoRouter);
app.route("/api", estoqueRouter);
app.route("/api", estoqueCentrosRouter);
app.route("/api", relatorioGerencialRouter);
app.route("/api", relatoriosFinanceirosRouter);
app.route("/api", plantioTalhoesRouter);
app.route("/api", plantioDashboardRouter);
app.route("/api", plantioCadastrosRouter);
app.route("/api", plantioEventosRouter);
app.route("/api", plantioCustoRouter);
app.route("/api", plantioColheitaRouter);
app.route("/api", plantioPlanejamentoRouter);
app.route("/api", plantioIaRouter);
app.route("/api", cultivoSafrasRouter);
app.route("/api", cultivoAreasRouter);
app.route("/api", cultivoCustosRouter);
app.route("/api", cultivoProducaoRouter);
app.route("/api", cultivoSilosRouter);
app.route("/api", cultivoDashboardRouter);
app.route("/api", pontoRouter);
app.route("/api", pontoDashboardRouter);
app.route("/api", buscaRouter);
