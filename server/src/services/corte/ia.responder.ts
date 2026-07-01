// Respondedor demo por regras — função PURA (sem Prisma, sem rede).
// Usado quando não há ANTHROPIC_API_KEY: responde perguntas comuns sobre o
// plantel de corte a partir do contexto REAL. Roteamento por palavra-chave
// (normalizada: minúsculas + sem acento). Mirror de rebanho/ia.responder.ts.

import type { ContextoCorte } from "./ia.context.js";

export interface RespostaCorteIA { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const tem = (p: string, ...termos: string[]) => termos.some((t) => p.includes(t));
const fmtR$ = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

export function responderDemo(pergunta: string, ctx: ContextoCorte): RespostaCorteIA {
  const p = norm(pergunta);
  const rodape = "Resposta gerada localmente a partir dos dados do plantel de corte.";

  // Prontos pra venda / abate / comercial
  if (tem(p, "pronto", "vender", "venda", "abate", "comercial", "frigorifico")) {
    if (!ctx.prontosVenda.length)
      return { resposta: "Nenhum lote pronto pra venda agora (peso < 480 kg e alvo não atingido).", modo: "demo", rodape };
    const valorTotal = ctx.prontosVenda.reduce((s, l) => s + l.valorSpot, 0);
    return {
      resposta: `${ctx.prontosVenda.length} lote(s) pronto(s) pra venda — ${fmtR$(valorTotal)} no spot:`,
      lista: ctx.prontosVenda.map(
        (l) => `${l.codigo} (${l.nome}) — ${l.numCabecas} cab · ${l.pesoMedio} kg · ${l.arrobasTotal} @ · ${fmtR$(l.valorSpot)}`
      ),
      rodape,
      modo: "demo",
    };
  }

  // GMD / ganho de peso / pesagem
  if (tem(p, "gmd", "ganho", "peso", "pesagem", "engord")) {
    const media = ctx.totais.gmdMedio != null ? `${ctx.totais.gmdMedio} kg/dia` : "—";
    const baixos = ctx.alertas.filter((a) => a.tipo === "gmd_baixo");
    return {
      resposta: `GMD médio dos lotes ativos: ${media}.`,
      lista: baixos.length ? baixos.map((a) => `${a.codigo} (${a.nome}) — ${a.detalhe}`) : undefined,
      rodape,
      modo: "demo",
    };
  }

  // Sanidade / vacina / vermífugo
  if (tem(p, "vacin", "aftosa", "vermif", "sanidade", "brucelose", "carrapato")) {
    const comVacina = ctx.lotes
      .filter((l) => l.proximaVacina)
      .map((l) => `${l.codigo} (${l.nome}) — próxima vacina ${l.proximaVacina}`);
    const proxima = ctx.lotes.map((l) => l.proximaVacina).filter((v): v is string => !!v).sort()[0];
    return {
      resposta: proxima
        ? `Próxima vacina agendada no plantel: ${proxima}.`
        : "Nenhuma vacina futura agendada nos lotes ativos.",
      lista: comVacina.length ? comVacina : undefined,
      rodape,
      modo: "demo",
    };
  }

  // Mortalidade
  if (tem(p, "mortalidade", "morte", "morre")) {
    const mortos = ctx.alertas.filter((a) => a.tipo === "mortalidade_alta");
    if (!mortos.length) return { resposta: "Nenhum lote com mortalidade ≥ 8% no momento.", modo: "demo", rodape };
    return {
      resposta: `${mortos.length} lote(s) com mortalidade alta (≥ 8%):`,
      lista: mortos.map((a) => `${a.codigo} (${a.nome}) — ${a.detalhe}`),
      rodape,
      modo: "demo",
    };
  }

  // Custo / economia
  if (tem(p, "custo", "economia", "receita", "margem", "lucro", "arroba")) {
    if (!ctx.economia) return { resposta: "Sem dados de custo do corte disponíveis.", modo: "demo", rodape };
    const e = ctx.economia;
    return {
      resposta:
        `Custeio do corte (suplementação + sanidade): ${fmtR$(e.custeioTotal)} · ` +
        `custo por @ ${fmtR$(e.custoArroba)}. Receita das vendas: ${fmtR$(e.receita)}.`,
      lista: [
        `@ produzidas (vendidas): ${e.arrobasProduzidas}`,
        `Custo por cabeça: ${e.custoPorCabeca != null ? fmtR$(e.custoPorCabeca) : "—"}`,
        `Estoque biológico estimado: ${fmtR$(e.valorBiologicoEstoque)} (a ${fmtR$(e.precoArrobaSpot)}/@ spot)`,
      ],
      rodape: "Sem centro de custo dedicado: números vêm das operações do módulo, não do financeiro.",
      modo: "demo",
    };
  }

  // Alertas gerais
  if (tem(p, "alerta", "problema", "atencao", "risco")) {
    if (!ctx.alertas.length) return { resposta: "Nenhum alerta no plantel agora.", modo: "demo", rodape };
    return {
      resposta: `${ctx.alertas.length} alerta(s) no plantel:`,
      lista: ctx.alertas.map((a) => `${a.codigo} (${a.nome}) — ${a.detalhe}`),
      rodape,
      modo: "demo",
    };
  }

  // Ajuda (fallback)
  return {
    resposta:
      "Posso responder sobre o plantel de corte a partir dos dados reais. Pergunte sobre: " +
      "lotes prontos pra venda, GMD/ganho de peso, sanidade (vacina/vermífugo), mortalidade ou custo/economia.",
    modo: "demo",
  };
}
