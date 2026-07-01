// Respondedor demo por regras — função PURA (sem Prisma, sem rede).
// Espelha rebanho/ia.responder.ts. Usado quando não há OPENAI_API_KEY:
// responde perguntas comuns da lavoura a partir do contexto REAL (números dos
// resumos, custo e estoque). Roteamento por palavra-chave (normalizada).

import type { ContextoPlantio } from "./ia.context.js";

export interface RespostaIA { resposta: string; lista?: string[]; rodape?: string; modo: "ia" | "demo"; }

// minúsculas + remove acentos
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const apelido = (codigo: string, nome: string | null) => (nome ? `${nome} (${codigo})` : codigo);
const tem = (p: string, ...termos: string[]) => termos.some((t) => p.includes(t));
const fmtBR = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function responderDemo(pergunta: string, ctx: ContextoPlantio): RespostaIA {
  const p = norm(pergunta);
  const rodape = "Resposta gerada localmente a partir dos dados da lavoura.";

  // Ferrugem / fitossanidade
  if (tem(p, "ferrugem", "fungic", "doenca", "doença")) {
    if (!ctx.alertaFerrugem.length) return { resposta: "Nenhum talhão com ferrugem ≥ 5% agora.", modo: "demo", rodape };
    const subindo = ctx.alertaFerrugem.filter((a) => a.tendencia === "subindo").length;
    return {
      resposta: `Hoje há <b>${ctx.alertaFerrugem.length} talhão(ões) com ferrugem ≥ 5%</b>${subindo ? ` — ${subindo} com tendência de subida` : ""}.`,
      lista: ctx.alertaFerrugem.map((a) => `${apelido(a.codigo, a.nome)} — ${a.ferrugem}%${a.tendencia ? `, ${a.tendencia}` : ""}`),
      rodape,
      modo: "demo",
    };
  }

  // Broca
  if (tem(p, "broca")) {
    if (!ctx.alertaBroca.length) return { resposta: "Nenhum talhão com broca ≥ 3% agora.", modo: "demo", rodape };
    return {
      resposta: `<b>${ctx.alertaBroca.length} talhão(ões) com broca ≥ 3%</b>.`,
      lista: ctx.alertaBroca.map((a) => `${apelido(a.codigo, a.nome)} — ${a.broca}%`),
      rodape,
      modo: "demo",
    };
  }

  // Colheita / maturação
  if (tem(p, "colheita", "colher", "cereja", "maturac", "derrica", "derriça")) {
    if (!ctx.prontosColher.length) return { resposta: "Nenhum talhão pronto pra colher (cereja ≥ 60%) fora dos que já estão em colheita.", modo: "demo", rodape };
    return {
      resposta: `Você tem <b>${ctx.prontosColher.length} talhão(ões) prontos pra entrar</b> (cereja ≥ 60%). Já foram beneficiadas ${ctx.colheita.sacasBeneficiadas} sc em ${ctx.colheita.passadas} passada(s) este ano.`,
      lista: ctx.prontosColher.map((a) => `${apelido(a.codigo, a.nome)} — ${a.maturacaoCereja}% cereja`),
      rodape,
      modo: "demo",
    };
  }

  // Custo
  if (tem(p, "custo", "saca", "preco", "preço", "break")) {
    const cs = ctx.custo.custoSaca != null ? `R$ ${fmtBR(ctx.custo.custoSaca)}/saca` : "—";
    const ch = ctx.custo.custoHa != null ? `R$ ${fmtBR(ctx.custo.custoHa)}/ha` : "—";
    return {
      resposta: `Custo de custeio nos últimos ${ctx.custo.periodoMeses} meses: <b>${cs}</b> (${ch}). Investimento de formação no período: R$ ${fmtBR(ctx.custo.investimentoTotal)}.`,
      lista: ctx.custo.breakdown.length ? ctx.custo.breakdown.slice(0, 4).map((b) => `${b.categoria} — R$ ${fmtBR(b.valor)} (${b.pct}%)`) : undefined,
      rodape: ctx.custo.sacasPeriodo > 0
        ? `Base: ${ctx.custo.sacasPeriodo} sc colhidas no período. Café em formação — custo/saca fecha quando a safra fechar.`
        : "Café em formação: ainda sem colheita no período, então o custo/saca não fecha.",
      modo: "demo",
    };
  }

  // Adubação / nutrição / análises
  if (tem(p, "adub", "nutric", "foliar", "solo", "analise", "análise", "potassio", "potássio", "calage")) {
    const partes: string[] = [];
    if (ctx.foliarVencida.length) partes.push(`<b>${ctx.foliarVencida.length} talhão(ões) com análise foliar vencida</b> (>120 dias)`);
    if (ctx.soloVencido.length) partes.push(`<b>${ctx.soloVencido.length} com análise de solo vencida</b> (>1 ano)`);
    if (!partes.length) return { resposta: "Nenhuma análise foliar ou de solo vencida no momento.", modo: "demo", rodape };
    return {
      resposta: `Hoje há ${partes.join(" e ")}.`,
      lista: ctx.foliarVencida.map((a) => `${apelido(a.codigo, a.nome)} — foliar: ${a.ultimaAnaliseFoliar ?? "nunca"}`),
      rodape,
      modo: "demo",
    };
  }

  // Fenologia / fases
  if (tem(p, "fase", "fenolog", "florada", "floracao", "repouso", "granac")) {
    return {
      resposta: `Fase dominante hoje: <b>${ctx.faseDominante ?? "—"}</b>. ${ctx.totais.ativos} talhões ativos em ${ctx.totais.areaHa} ha.`,
      lista: ctx.porFase.map((f) => `${f.fase} — ${f.n} talhão(ões)`),
      rodape,
      modo: "demo",
    };
  }

  // Estoque de insumos
  if (tem(p, "estoque", "insumo", "fertiliz", "defensiv")) {
    if (!ctx.estoqueBaixo.length) return { resposta: "Nenhum insumo da lavoura abaixo do estoque mínimo.", modo: "demo", rodape };
    return {
      resposta: `<b>${ctx.estoqueBaixo.length} insumo(s) abaixo do mínimo</b>.`,
      lista: ctx.estoqueBaixo.map((e) => `${e.nome} — ${e.saldo} ${e.unidade}${e.minimoEstoque != null ? ` (mín. ${e.minimoEstoque})` : ""}`),
      rodape,
      modo: "demo",
    };
  }

  // Ajuda (fallback)
  return {
    resposta:
      "Posso responder sobre a lavoura a partir dos dados reais. Pergunte sobre: " +
      "<b>fenologia, fitossanidade (ferrugem/broca), nutrição (foliar/solo), colheita, custo e estoque</b>.",
    modo: "demo",
  };
}
