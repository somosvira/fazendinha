// Respondedor demo por regras — função PURA (sem Prisma, sem rede).
// Usado quando não há OPENAI_API_KEY: responde perguntas comuns a partir do
// contexto real do rebanho. Roteamento por palavra-chave (normalizada).

import type { ContextoRebanho } from "./ia.context.js";

export interface RespostaIA { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }

// minúsculas + remove acentos
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const apelido = (numero: string, nome: string | null) => `${nome ?? "Sem nome"} #${numero}`;
const tem = (p: string, ...termos: string[]) => termos.some((t) => p.includes(t));

export function responderDemo(pergunta: string, ctx: ContextoRebanho): RespostaIA {
  const p = norm(pergunta);
  const rodape = "Resposta gerada localmente a partir dos dados do rebanho.";

  // CCS / mastite
  if (tem(p, "ccs", "celula", "mastite")) {
    if (!ctx.ccsAlto.length) return { resposta: "Nenhuma vaca com CCS ≥ 400 mil agora.", modo: "demo", rodape };
    return {
      resposta: `${ctx.ccsAlto.length} vaca(s) com CCS ≥ 400 mil:`,
      lista: ctx.ccsAlto.map((a) => `${apelido(a.numero, a.nome)} — ${a.ccs} mil · ${a.tendencia ?? "tendência —"}`),
      rodape,
      modo: "demo",
    };
  }

  // Prenhez / concepção
  if (tem(p, "prenhez", "concep", "caiu", "prenhe", "gestante")) {
    const pct = ctx.prenhezPct != null ? `${ctx.prenhezPct}%` : "—";
    const resposta = `Prenhez atual: ${pct} (${ctx.totais.gestantes} gestante(s) confirmada(s)).`;
    const lista = ctx.partosPrevistos.length
      ? ctx.partosPrevistos.map((a) => `${apelido(a.numero, a.nome)} — ${a.diasGestacao ?? "—"} dias de gestação`)
      : undefined;
    return { resposta, lista, rodape, modo: "demo" };
  }

  // Secagem
  if (tem(p, "secar", "secagem")) {
    if (!ctx.aSecar.length) return { resposta: "Nenhuma vaca a secar nos próximos 30 dias.", modo: "demo", rodape };
    return {
      resposta: `${ctx.aSecar.length} vaca(s) a secar nos próximos 30 dias:`,
      lista: ctx.aSecar.map((a) => `${apelido(a.numero, a.nome)} — secar até ${a.previsaoSecagem}`),
      rodape,
      modo: "demo",
    };
  }

  // Produção / lotes
  if (tem(p, "producao", "leite", "litro", "lote")) {
    const media = ctx.producaoMediaRebanho != null ? `${ctx.producaoMediaRebanho} L/dia` : "—";
    return {
      resposta: `Produção média do rebanho: ${media}.`,
      lista: ctx.lotes.length
        ? ctx.lotes.map((l) => `${l.nome}: ${l.producaoMedia ?? "—"} L/d · ${l.numAnimais} animais · dieta ${l.dietaNome ?? "sem dieta"}`)
        : undefined,
      rodape,
      modo: "demo",
    };
  }

  // Vazias atrasadas / PEV
  if (tem(p, "vazia", "pev", "atrasad")) {
    if (!ctx.vaziasAtrasadas.length) return { resposta: "Nenhuma vaca vazia atrasada (DEL > 90).", modo: "demo", rodape };
    return {
      resposta: `${ctx.vaziasAtrasadas.length} vaca(s) vazia(s) atrasada(s) (DEL > 90):`,
      lista: ctx.vaziasAtrasadas.map((a) => `${apelido(a.numero, a.nome)} — ${a.del ?? "—"} DEL`),
      rodape,
      modo: "demo",
    };
  }

  // Ajuda (fallback)
  return {
    resposta:
      "Posso responder sobre o rebanho a partir dos dados reais. Pergunte sobre: " +
      "CCS (células somáticas), prenhez, secagem, produção (leite/lotes) ou vacas vazias atrasadas.",
    modo: "demo",
  };
}
