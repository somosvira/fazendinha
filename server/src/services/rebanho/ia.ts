// Orquestrador da IA do rebanho: busca dados reais → monta contexto → responde.
// Com OPENAI_API_KEY chama OpenAI (modo IA); sem ela (ou em falha) responde por
// regras (modo demonstração). Nunca lança por causa de rede.

import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { montarContexto, contextoParaTexto, type AnimalCtx, type LoteCtx, type ContextoRebanho } from "./ia.context.js";
import { responderDemo, type RespostaIA } from "./ia.responder.js";
import { responderComLLM } from "./ia.llm.js";
import { gerarInsightsRebanho, type IaInsightDTO } from "./ia.insights.js";

const isoOrNull = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

async function carregarAnimais(propriedadeId: number | null): Promise<AnimalCtx[]> {
  const animais = await prisma.animal.findMany({ where: { status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) }, include: { resumo: true } });
  return animais.map((a) => ({
    numero: a.numero,
    nome: a.nome ?? null,
    categoria: a.categoria,
    statusReprodutivo: a.resumo?.statusReprodutivo ?? null,
    del: a.resumo?.del ?? null,
    producaoMediaDia: a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null,
    ccs: a.resumo?.ccs ?? null,
    ccsTendencia: a.resumo?.ccsTendencia ?? null,
    diasGestacao: a.resumo?.diasGestacao ?? null,
    previsaoSecagem: isoOrNull(a.resumo?.previsaoSecagem ?? null),
    iepProjetado: a.resumo?.iepProjetado ?? null,
  }));
}

async function carregarLotes(propriedadeId: number | null): Promise<LoteCtx[]> {
  const grupos = await prisma.grupo.findMany({
    where: propriedadeId != null ? { propriedadeId } : {},
    orderBy: { nome: "asc" },
    include: { dieta: true, animais: { where: { status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) }, include: { resumo: true } } },
  });
  return grupos.map((g) => {
    const prods = g.animais
      .map((a) => (a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null))
      .filter((x): x is number => x != null);
    return {
      nome: g.nome,
      dietaNome: g.dieta?.nome ?? null,
      numAnimais: g.animais.length,
      producaoMedia: prods.length ? Math.round((prods.reduce((a, b) => a + b, 0) / prods.length) * 10) / 10 : null,
    };
  });
}

// Monta o contexto real do rebanho (mesma fonte do chat) — reusado pelos insights.
async function montarContextoReal(propriedadeId: number | null): Promise<ContextoRebanho> {
  const [animais, lotes] = await Promise.all([carregarAnimais(propriedadeId), carregarLotes(propriedadeId)]);
  const hoje = new Date().toISOString().slice(0, 10);
  return montarContexto(animais, lotes, hoje);
}

// Cards proativos ("insights da semana") do rebanho, a partir do contexto real.
export async function listarInsightsRebanho(propriedadeId: number | null = null): Promise<IaInsightDTO[]> {
  return gerarInsightsRebanho(await montarContextoReal(propriedadeId));
}

export async function responderPergunta(pergunta: string, propriedadeId: number | null = null): Promise<RespostaIA> {
  const ctx = await montarContextoReal(propriedadeId);

  if (env.OPENAI_API_KEY) {
    try {
      const resposta = await responderComLLM(pergunta, contextoParaTexto(ctx), env.OPENAI_API_KEY, env.OPENAI_MODEL);
      return { resposta, modo: "ia" };
    } catch {
      // cai pro demo (nunca quebra por causa de rede/credencial)
    }
  }
  return responderDemo(pergunta, ctx);
}
