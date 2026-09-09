import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env.js";
import { authMiddleware } from "./middleware/auth.js";
import { exigeArea } from "./middleware/permissao.js";
import { categoriasRouter } from "./routes/categorias.js";
import { financeiroRouter } from "./routes/financeiro.js";
import { healthRouter } from "./routes/health.js";
import { authPublicoRouter, authPrivadoRouter } from "./routes/auth.js";
import { usuariosRouter } from "./routes/usuarios.js";
import { garantirDonoBootstrap } from "./services/auth/usuarios.js";
import { animaisRouter } from "./routes/rebanho/animais.js";
import { filtrosRouter } from "./routes/rebanho/filtros.js";
import { eventosRouter } from "./routes/rebanho/eventos.js";
import { sanidadeRouter } from "./routes/rebanho/sanidade.js";
import { examesQuartoRouter } from "./routes/rebanho/exames-quarto.js";
import { vacinaRouter } from "./routes/rebanho/vacina.js";
import { iatfRouter } from "./routes/rebanho/iatf.js";
import { iatfLoteRouter } from "./routes/rebanho/iatf-lote.js";
import { aptidaoRouter } from "./routes/rebanho/aptidao.js";
import { nutricaoRouter } from "./routes/rebanho/nutricao.js";
import { propriedadeRouter } from "./routes/propriedade.js";
import { garantirFundacaoPropriedade } from "./services/propriedade.js";
import { garantirResultadosGinecologicosSemente } from "./services/rebanho/exame-ginecologico.js";
import { rebanhoDashboardRouter } from "./routes/rebanho/dashboard.js";
import { rebanhoWorklistsRouter } from "./routes/rebanho/worklists.js";
import { rebanhoHojeRouter } from "./routes/rebanho/hoje.js";
import { iaRouter } from "./routes/rebanho/ia.js";
import { configRouter } from "./routes/rebanho/config.js";
import { parametrosRouter } from "./routes/rebanho/parametros.js";
import { producaoRouter } from "./routes/rebanho/producao.js";
import { analiseLeiteRouter } from "./routes/rebanho/analise-leite.js";
import { tanqueRouter } from "./routes/rebanho/tanque.js";
import { agendaRouter } from "./routes/rebanho/agenda.js";
import { protocoloSanitarioRouter } from "./routes/rebanho/protocolo-sanitario.js";
import { reprodutoresRouter } from "./routes/rebanho/reprodutores.js";
import { geneticaRouter } from "./routes/rebanho/genetica.js";
import { semenRouter } from "./routes/rebanho/semen.js";
import { fivRouter } from "./routes/rebanho/fiv.js";
import { poolDoadoraRouter } from "./routes/rebanho/pool-doadora.js";
import { acasalamentoRouter } from "./routes/rebanho/acasalamento.js";
import { medidasAcasalamentoRouter } from "./routes/rebanho/medidas-acasalamento.js";
import { planosAcasalamentoRouter } from "./routes/rebanho/planos-acasalamento.js";
import { composicaoProdutoRouter } from "./routes/rebanho/composicao-produto.js";
import { lotesRouter } from "./routes/rebanho/lotes.js";
import { cadastrosRouter } from "./routes/rebanho/cadastros.js";
import { principioAtivoRouter } from "./routes/rebanho/principio-ativo.js";
import { estoqueRouter } from "./routes/rebanho/estoque.js";
import { custoProducaoRouter } from "./routes/rebanho/custo-producao.js";
import { custoSanidadeRouter } from "./routes/rebanho/custo-sanidade.js";
import { financeiroRefRouter } from "./routes/rebanho/financeiro-ref.js";
import { indicadoresEmbrapaRouter } from "./routes/rebanho/indicadores-embrapa.js";
import { carteiraRouter } from "./routes/rebanho/carteira.js";
import { chuvaRouter } from "./routes/rebanho/chuva.js";
import { sugestoesRouter } from "./routes/rebanho/sugestoes.js";
import { relatorioReproducaoRouter } from "./routes/rebanho/relatorio-reproducao.js";
import { relatoriosRouter } from "./routes/rebanho/relatorios.js";
import { relatorioGerencialRouter } from "./routes/relatorio-gerencial.js";
import { formulariosRouter } from "./routes/rebanho/formularios.js";
import { plantioTalhoesRouter } from "./routes/plantio/talhoes.js";
import { plantioDashboardRouter } from "./routes/plantio/dashboard.js";
import { plantioCadastrosRouter } from "./routes/plantio/cadastros.js";
import { plantioEventosRouter } from "./routes/plantio/eventos.js";
import { plantioCustoRouter } from "./routes/plantio/custo.js";
import { plantioEstoqueRouter } from "./routes/plantio/estoque.js";
import { plantioColheitaRouter } from "./routes/plantio/colheita.js";
import { plantioPlanejamentoRouter } from "./routes/plantio/planejamento.js";
import { plantioIaRouter } from "./routes/plantio/ia.js";
import { corteLotesRouter } from "./routes/corte/lotes.js";
import { corteDashboardRouter } from "./routes/corte/dashboard.js";
import { corteEventosRouter } from "./routes/corte/eventos.js";
import { corteCustoRouter } from "./routes/corte/custo.js";
import { corteIaRouter } from "./routes/corte/ia.js";
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

const app = new Hono();

app.use("*", logger());

const corsOrigins = env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
if (env.NODE_ENV === "production" && (!corsOrigins || corsOrigins.length === 0)) {
  console.warn("[cors] CORS_ORIGIN vazio em produção — API está permissiva a qualquer origem. Setar antes do teste com dono.");
}
if (env.NODE_ENV === "production" && !env.SHARED_ACCESS_TOKEN) {
  console.warn("[auth] SHARED_ACCESS_TOKEN vazio em produção — API está aberta a qualquer requisição. Setar antes do teste com dono.");
}
app.use(
  "/api/*",
  cors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : "*",
  })
);
// Isentos de sessão (montados ANTES do gate): health, whatsapp (valida por HMAC
// próprio) e as rotas públicas de auth (login/convite/reset).
app.route("/api", healthRouter);
app.route("/api", whatsappRouter);
app.route("/api", authPublicoRouter);

app.use("/api/*", authMiddleware);

// Autorização por domínio: o frontend também esconde os módulos, mas este gate
// impede acesso por URL/cURL. Agricultura reúne os módulos Plantio e Cultivo.
app.use("/api/rebanho/*", exigeArea("pecuaria"));
app.use("/api/plantio/*", exigeArea("agricultura"));
app.use("/api/cultivo/*", exigeArea("agricultura"));
app.use("/api/corte/*", exigeArea("pecuaria"));
app.use("/api/ponto/*", exigeArea("equipe"));
for (const path of [
  "/api/financeiro", "/api/financeiro/*", "/api/categorias", "/api/categorias/*",
]) app.use(path, exigeArea("financeiro"));

// Protegidos (exigem sessão resolvida pelo authMiddleware):
app.route("/api", authPrivadoRouter);
app.route("/api", usuariosRouter);
app.route("/api", propriedadeRouter);
app.route("/api", categoriasRouter);
app.route("/api", financeiroRouter);
app.route("/api", animaisRouter);
app.route("/api", filtrosRouter);
app.route("/api", eventosRouter);
app.route("/api", sanidadeRouter);
app.route("/api", examesQuartoRouter);
app.route("/api", vacinaRouter);
app.route("/api", iatfRouter);
app.route("/api", iatfLoteRouter);
app.route("/api", aptidaoRouter);
app.route("/api", nutricaoRouter);
app.route("/api", rebanhoDashboardRouter);
app.route("/api", rebanhoWorklistsRouter);
app.route("/api", rebanhoHojeRouter);
app.route("/api", iaRouter);
app.route("/api", configRouter);
app.route("/api", parametrosRouter);
app.route("/api", producaoRouter);
app.route("/api", analiseLeiteRouter);
app.route("/api", tanqueRouter);
app.route("/api", agendaRouter);
app.route("/api", protocoloSanitarioRouter);
app.route("/api", reprodutoresRouter);
app.route("/api", geneticaRouter);
app.route("/api", semenRouter);
app.route("/api", fivRouter);
app.route("/api", poolDoadoraRouter);
app.route("/api", acasalamentoRouter);
app.route("/api", medidasAcasalamentoRouter);
app.route("/api", planosAcasalamentoRouter);
app.route("/api", composicaoProdutoRouter);
app.route("/api", lotesRouter);
app.route("/api", cadastrosRouter);
app.route("/api", principioAtivoRouter);
app.route("/api", estoqueRouter);
app.route("/api", custoProducaoRouter);
app.route("/api", custoSanidadeRouter);
app.route("/api", financeiroRefRouter);
app.route("/api", indicadoresEmbrapaRouter);
app.route("/api", carteiraRouter);
app.route("/api", chuvaRouter);
app.route("/api", sugestoesRouter);
app.route("/api", relatorioReproducaoRouter);
app.route("/api", relatoriosRouter);
app.route("/api", relatorioGerencialRouter);
app.route("/api", formulariosRouter);
app.route("/api", plantioTalhoesRouter);
app.route("/api", plantioDashboardRouter);
app.route("/api", plantioCadastrosRouter);
app.route("/api", plantioEventosRouter);
app.route("/api", plantioCustoRouter);
app.route("/api", plantioEstoqueRouter);
app.route("/api", plantioColheitaRouter);
app.route("/api", plantioPlanejamentoRouter);
app.route("/api", plantioIaRouter);
app.route("/api", corteLotesRouter);
app.route("/api", corteDashboardRouter);
app.route("/api", corteEventosRouter);
app.route("/api", corteCustoRouter);
app.route("/api", corteIaRouter);
app.route("/api", cultivoSafrasRouter);
app.route("/api", cultivoAreasRouter);
app.route("/api", cultivoCustosRouter);
app.route("/api", cultivoProducaoRouter);
app.route("/api", cultivoSilosRouter);
app.route("/api", cultivoDashboardRouter);
app.route("/api", pontoRouter);
app.route("/api", pontoDashboardRouter);
app.route("/api", buscaRouter);

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`API Rio Novo rodando em http://localhost:${port}`);
});

// Fundação multi-propriedade: cria a principal e backfilla escopos nulos.
// Idempotente e à prova de `db push` (que não roda o seed/backfill da migration).
garantirFundacaoPropriedade().catch((e) => console.error("[propriedade] falha ao garantir fundação:", e));

// Dicionário operacional mínimo até a reextração dos 44 resultados oficiais.
garantirResultadosGinecologicosSemente().catch((e) => console.error("[rebanho] falha ao semear resultados ginecológicos:", e));

// Cria o dono no primeiro boot (tabela Usuario vazia + AUTH_BOOTSTRAP_EMAIL).
garantirDonoBootstrap().catch((e) => console.error("[auth] falha no bootstrap do dono:", e));
