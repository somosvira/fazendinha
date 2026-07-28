import { Hono } from "hono";
import { resolverEscopoLeitura } from "../../services/propriedade.js";
import { obterRelatorioReproducao } from "../../services/rebanho/relatorio-reproducao.js";

const isoData = (v: string | undefined): string | undefined =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;

export const relatorioReproducaoRouter = new Hono().get("/rebanho/reproducao/relatorio", async (c) => {
  try {
    const de = isoData(c.req.query("de"));
    const ate = isoData(c.req.query("ate"));
    return c.json(await obterRelatorioReproducao(await resolverEscopoLeitura(c), { de, ate }));
  } catch (e) {
    console.error("[relatorio-reproducao]", e);
    return c.json({ error: "Erro inesperado ao processar. Tente novamente." }, 500);
  }
});
