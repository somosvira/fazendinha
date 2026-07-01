// Orquestrador da IA do plantel de corte: busca dados reais → monta contexto →
// responde. Com OPENAI_API_KEY chama a OpenAI (modo IA); sem ela (ou em falha)
// responde por regras (modo demonstração). Nunca lança por causa de rede.
// Mirror de rebanho/ia.ts e plantio.

import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { montarContextoCorte, contextoCorteParaTexto, type LoteCorteCtx, type OperacaoCtx, type EconomiaCtx, type ContextoCorte } from "./ia.context.js";
import { responderDemo, type RespostaCorteIA } from "./ia.responder.js";
import { responderComLLM } from "./ia.llm.js";
import { agregarCustoCorte } from "./custo.js";
import { gerarInsightsCorte, type IaInsightDTO } from "./ia.insights.js";

const num = (x: any) => (x != null ? Number(x) : null);
const isoOrNull = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

async function carregarLotes(): Promise<LoteCorteCtx[]> {
  const lotes = await prisma.loteCorte.findMany({
    where: { estado: "ATIVO" },
    orderBy: { codigo: "asc" },
    include: { resumo: true },
  });
  return lotes.map((l) => ({
    codigo: l.codigo,
    nome: l.nome,
    categoria: l.categoria,
    fase: l.fase,
    raca: l.raca,
    numCabecas: l.numCabecas,
    pesoMedio: num(l.resumo?.pesoMedio),
    gmd: num(l.resumo?.gmd),
    ua: num(l.resumo?.ua),
    arrobasEstimadas: num(l.resumo?.arrobasEstimadas),
    mortalidade: num(l.resumo?.mortalidadeAcumulada),
    diasSemPesar: l.resumo?.diasSemPesar ?? null,
    proximaVacina: l.resumo?.proximaVacina ?? null,
    proximoVermifugo: l.resumo?.proximoVermifugo ?? null,
    pesoAlvoVenda: num(l.resumo?.pesoAlvoVenda),
    diasParaAlvo: l.resumo?.diasParaAlvo ?? null,
  }));
}

async function carregarOperacoes(): Promise<OperacaoCtx[]> {
  const ops = await prisma.operacaoComercial.findMany({ orderBy: { data: "desc" }, take: 8 });
  return ops.map((o) => ({
    data: isoOrNull(o.data) ?? "",
    tipo: o.tipo,
    numCabecas: o.numCabecas,
    arrobas: num(o.arrobas),
    receitaTotal: num(o.receitaTotal),
  }));
}

// Monta o contexto real do corte (mesma fonte do chat) — reusado pelos insights.
// A economia usa agregarCustoCorte (custo/@ real), com fallback null se falhar.
async function montarContextoReal(): Promise<ContextoCorte> {
  const [lotes, operacoes, custo] = await Promise.all([
    carregarLotes(),
    carregarOperacoes(),
    agregarCustoCorte().catch(() => null),
  ]);

  const economia: EconomiaCtx | null = custo
    ? {
        receita: custo.receita,
        custeioTotal: custo.custeioTotal,
        custoArroba: custo.custoArroba,
        custoPorCabeca: custo.custoPorCabeca,
        arrobasProduzidas: custo.arrobasProduzidas,
        valorBiologicoEstoque: custo.valorBiologicoEstoque,
        precoArrobaSpot: custo.precoArrobaSpot,
      }
    : null;

  return montarContextoCorte(lotes, operacoes, economia);
}

// Cards proativos ("insights da semana") do corte, a partir do contexto real.
export async function listarInsightsCorte(): Promise<IaInsightDTO[]> {
  return gerarInsightsCorte(await montarContextoReal());
}

export async function responderIA(pergunta: string): Promise<RespostaCorteIA> {
  const ctx = await montarContextoReal();

  if (env.OPENAI_API_KEY) {
    try {
      const resposta = await responderComLLM(pergunta, contextoCorteParaTexto(ctx), env.OPENAI_API_KEY, env.OPENAI_MODEL);
      return { resposta, modo: "ia" };
    } catch {
      // cai pro demo (nunca quebra por causa de rede/credencial)
    }
  }
  return responderDemo(pergunta, ctx);
}
