// Montador de contexto do plantel de corte para a IA — função PURA (sem Prisma).
// Mirror de rebanho/ia.context.ts: recebe lotes ATIVO já mapeados (Decimal→Number,
// datas→ISO) + economia já agregada, e produz um snapshot + um texto PT-BR usado
// como system prompt do LLM e como fonte do respondedor demo.

export interface LoteCorteCtx {
  codigo: string;
  nome: string;
  categoria: string;
  fase: string;
  raca: string;
  numCabecas: number;
  pesoMedio: number | null;
  gmd: number | null;
  ua: number | null;
  arrobasEstimadas: number | null;
  mortalidade: number | null;
  diasSemPesar: number | null;
  proximaVacina: string | null;
  proximoVermifugo: string | null;
  pesoAlvoVenda: number | null;
  diasParaAlvo: number | null;
}

export interface OperacaoCtx {
  data: string;
  tipo: string;
  numCabecas: number;
  arrobas: number | null;
  receitaTotal: number | null;
}

// Economia agregada (subset de CustoCorteData) — só o que a IA precisa.
export interface EconomiaCtx {
  receita: number;
  custeioTotal: number;
  custoArroba: number;
  custoPorCabeca: number | null;
  arrobasProduzidas: number;
  valorBiologicoEstoque: number;
  precoArrobaSpot: number;
}

export interface ContextoCorte {
  totais: { lotesAtivos: number; cabecas: number; uaTotal: number; arrobasEstoque: number; gmdMedio: number | null };
  porFase: { fase: string; n: number }[];
  porCategoria: { categoria: string; n: number }[];
  prontosVenda: { codigo: string; nome: string; numCabecas: number; pesoMedio: number; arrobasTotal: number; valorSpot: number }[];
  alertas: { tipo: string; codigo: string; nome: string; detalhe: string }[];
  economia: EconomiaCtx | null;
  operacoesRecentes: OperacaoCtx[];
  lotes: LoteCorteCtx[];
}

// Limiares (alinhados ao dashboard do corte).
const PESO_PRONTO_KG = 480;
const GMD_BAIXO = 0.35;
const DIAS_SEM_PESAR_MAX = 60;
const MORTALIDADE_ALTA = 8;
const RENDIMENTO_CARCACA = 0.52;
const KG_POR_ARROBA = 15;

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

// Lote está "pronto pra venda": peso ≥ alvo de pronto OU diasParaAlvo ≤ 0
// (já bateu o alvo de venda computado pelo resumo).
function prontoParaVenda(l: LoteCorteCtx): boolean {
  if (l.pesoMedio != null && l.pesoMedio >= PESO_PRONTO_KG) return true;
  if (l.diasParaAlvo != null && l.diasParaAlvo <= 0) return true;
  return false;
}

export function montarContextoCorte(
  lotes: LoteCorteCtx[],
  operacoesRecentes: OperacaoCtx[],
  economia: EconomiaCtx | null
): ContextoCorte {
  const lotesAtivos = lotes.length;
  const cabecas = lotes.reduce((s, l) => s + l.numCabecas, 0);
  const uaTotal = round1(lotes.reduce((s, l) => s + (l.ua ?? 0), 0));
  const arrobasEstoque = round1(
    lotes.reduce((s, l) => s + (l.arrobasEstimadas ?? 0) * l.numCabecas, 0)
  );
  const comGmd = lotes.filter((l) => l.gmd != null && l.gmd > 0).map((l) => l.gmd as number);
  const gmdMedio = comGmd.length ? round2(comGmd.reduce((a, b) => a + b, 0) / comGmd.length) : null;

  const porFaseMap = new Map<string, number>();
  const porCategoriaMap = new Map<string, number>();
  for (const l of lotes) {
    porFaseMap.set(l.fase, (porFaseMap.get(l.fase) ?? 0) + 1);
    porCategoriaMap.set(l.categoria, (porCategoriaMap.get(l.categoria) ?? 0) + 1);
  }
  const porFase = [...porFaseMap.entries()].map(([fase, n]) => ({ fase, n })).sort((a, b) => b.n - a.n);
  const porCategoria = [...porCategoriaMap.entries()].map(([categoria, n]) => ({ categoria, n })).sort((a, b) => b.n - a.n);

  const spot = economia?.precoArrobaSpot ?? 245;
  const prontosVenda = lotes
    .filter(prontoParaVenda)
    .map((l) => {
      const pesoMedio = l.pesoMedio ?? 0;
      const arrobasTotal = round1(((pesoMedio * RENDIMENTO_CARCACA) / KG_POR_ARROBA) * l.numCabecas);
      return {
        codigo: l.codigo,
        nome: l.nome,
        numCabecas: l.numCabecas,
        pesoMedio,
        arrobasTotal,
        valorSpot: Math.round(arrobasTotal * spot),
      };
    })
    .sort((a, b) => b.valorSpot - a.valorSpot);

  const alertas: ContextoCorte["alertas"] = [];
  for (const l of lotes) {
    if (l.gmd != null && l.gmd > 0 && l.gmd < GMD_BAIXO)
      alertas.push({ tipo: "gmd_baixo", codigo: l.codigo, nome: l.nome, detalhe: `GMD ${l.gmd} kg/dia (< ${GMD_BAIXO})` });
    if (l.diasSemPesar != null && l.diasSemPesar > DIAS_SEM_PESAR_MAX)
      alertas.push({ tipo: "pesagem_vencida", codigo: l.codigo, nome: l.nome, detalhe: `${l.diasSemPesar} dias sem pesar` });
    if (l.mortalidade != null && l.mortalidade >= MORTALIDADE_ALTA)
      alertas.push({ tipo: "mortalidade_alta", codigo: l.codigo, nome: l.nome, detalhe: `mortalidade ${l.mortalidade}%` });
  }

  return {
    totais: { lotesAtivos, cabecas, uaTotal, arrobasEstoque, gmdMedio },
    porFase,
    porCategoria,
    prontosVenda,
    alertas,
    economia,
    operacoesRecentes,
    lotes,
  };
}

const fmtR$ = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

export function contextoCorteParaTexto(ctx: ContextoCorte): string {
  const L: string[] = [];
  const t = ctx.totais;
  L.push("PLANTEL DE CORTE (números atuais):");
  L.push(
    `- Lotes ativos: ${t.lotesAtivos} · Cabeças: ${t.cabecas} · UA total: ${t.uaTotal} · ` +
      `@ em estoque: ${t.arrobasEstoque} · GMD médio: ${t.gmdMedio != null ? `${t.gmdMedio} kg/dia` : "—"}`
  );
  L.push(`- Por fase: ${ctx.porFase.map((f) => `${f.fase} ${f.n}`).join(" · ") || "—"}`);
  L.push(`- Por categoria: ${ctx.porCategoria.map((c) => `${c.categoria} ${c.n}`).join(" · ") || "—"}`);

  L.push("");
  L.push(`Lotes prontos pra venda (peso ≥ ${PESO_PRONTO_KG} kg ou alvo atingido):`);
  if (ctx.prontosVenda.length)
    ctx.prontosVenda.forEach((l) =>
      L.push(`- ${l.codigo} (${l.nome}) — ${l.numCabecas} cab · ${l.pesoMedio} kg · ${l.arrobasTotal} @ · ${fmtR$(l.valorSpot)} (spot)`)
    );
  else L.push("- nenhum");

  L.push("");
  L.push("Alertas:");
  if (ctx.alertas.length) ctx.alertas.forEach((a) => L.push(`- ${a.codigo} (${a.nome}) — ${a.detalhe}`));
  else L.push("- nenhum");

  L.push("");
  L.push("Custo / economia (dados do próprio módulo, sem ponte financeira):");
  if (ctx.economia) {
    const e = ctx.economia;
    L.push(`- Receita (vendas): ${fmtR$(e.receita)} · @ produzidas: ${e.arrobasProduzidas}`);
    L.push(`- Custeio (suplementação + sanidade): ${fmtR$(e.custeioTotal)} · custo/@: ${fmtR$(e.custoArroba)}`);
    L.push(`- Custo por cabeça: ${e.custoPorCabeca != null ? fmtR$(e.custoPorCabeca) : "—"}`);
    L.push(`- Estoque biológico estimado: ${fmtR$(e.valorBiologicoEstoque)} (a ${fmtR$(e.precoArrobaSpot)}/@ spot)`);
  } else {
    L.push("- sem dados de custo");
  }

  L.push("");
  L.push("Lotes ativos (detalhe):");
  if (ctx.lotes.length)
    ctx.lotes.forEach((l) =>
      L.push(
        `- ${l.codigo} (${l.nome}) · ${l.categoria}/${l.fase} · ${l.raca} · ${l.numCabecas} cab · ` +
          `${l.pesoMedio ?? "—"} kg · GMD ${l.gmd ?? "—"} · ${l.arrobasEstimadas ?? "—"} @/cab · ` +
          `mort ${l.mortalidade ?? "—"}% · próx. vacina ${l.proximaVacina ?? "—"}`
      )
    );
  else L.push("- nenhum");

  L.push("");
  L.push("Operações comerciais recentes:");
  if (ctx.operacoesRecentes.length)
    ctx.operacoesRecentes.forEach((o) =>
      L.push(`- ${o.data} · ${o.tipo} · ${o.numCabecas} cab · ${o.arrobas ?? "—"} @ · ${o.receitaTotal != null ? fmtR$(o.receitaTotal) : "—"}`)
    );
  else L.push("- nenhuma");

  return L.join("\n");
}
