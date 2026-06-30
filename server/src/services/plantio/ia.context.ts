// Montador de contexto da lavoura para a IA — função PURA (sem Prisma).
// Espelha rebanho/ia.context.ts: recebe talhões ATIVOS já mapeados
// (Decimal→Number, datas→ISO YYYY-MM-DD) + custo/colheita/estoque já agregados,
// e produz um snapshot compacto da lavoura + um texto PT-BR usado como system
// prompt. Toda regra temporal usa o `hoje` passado (ISO YYYY-MM-DD).

// Talhão ATIVO mapeado a partir do ResumoTalhao (Decimal→Number, Date→ISO).
export interface TalhaoCtx {
  codigo: string;
  nome: string | null;
  variedade: string | null;
  areaHa: number;
  fase: string;
  maturacaoCereja: number | null;
  produtividadeEsperada: number | null;
  ferrugem: number | null;
  broca: number | null;
  tendFerrugem: string | null;
  pH: number | null;
  v: number | null;
  potassio: number | null;
  ultimaInspecao: string | null;     // ISO YYYY-MM-DD
  ultimaAnaliseFoliar: string | null;
  ultimaAnaliseSolo: string | null;
}

// Custo do café (reuso de agregarCustoPlantio) — só os números que a IA precisa.
export interface CustoCtx {
  custoSaca: number | null;
  custoHa: number | null;
  custeioTotal: number;
  investimentoTotal: number;
  sacasPeriodo: number;
  periodoMeses: number;
  breakdown: { categoria: string; valor: number; pct: number }[];
}

// Colheita resumida — passadas registradas no ano corrente.
export interface ColheitaCtx {
  passadas: number;
  sacasBeneficiadas: number;
}

// Estoque abaixo do mínimo (insumo da lavoura).
export interface EstoqueBaixoCtx {
  nome: string;
  saldo: number;
  unidade: string;
  minimoEstoque: number | null;
}

export interface ContextoPlantio {
  totais: { ativos: number; areaHa: number; produtividadeMediaEsperada: number | null };
  porFase: { fase: string; n: number }[];
  faseDominante: string | null;
  alertaFerrugem: { codigo: string; nome: string | null; ferrugem: number; tendencia: string | null }[];
  alertaBroca: { codigo: string; nome: string | null; broca: number }[];
  prontosColher: { codigo: string; nome: string | null; maturacaoCereja: number }[];
  foliarVencida: { codigo: string; nome: string | null; ultimaAnaliseFoliar: string | null }[];
  soloVencido: { codigo: string; nome: string | null; ultimaAnaliseSolo: string | null }[];
  custo: CustoCtx;
  colheita: ColheitaCtx;
  estoqueBaixo: EstoqueBaixoCtx[];
}

// Limiares (mesmos do dashboard real do plantio).
const FERRUGEM_ALERTA = 5; // %
const BROCA_ALERTA = 3; // %
const CEREJA_PRONTA = 60; // %
const FOLIAR_VENCE_DIAS = 120;
const SOLO_VENCE_DIAS = 365;

const round1 = (x: number) => Math.round(x * 10) / 10;

// dias decorridos entre `iso` e `hoje` (ambos ISO YYYY-MM-DD); null → vencido.
function diasDesde(iso: string | null, hoje: string): number | null {
  if (!iso) return null;
  const a = new Date(`${hoje}T00:00:00Z`).getTime();
  const b = new Date(`${iso}T00:00:00Z`).getTime();
  return Math.floor((a - b) / 86_400_000);
}

export function montarContextoPlantio(
  talhoes: TalhaoCtx[],
  custo: CustoCtx,
  colheita: ColheitaCtx,
  estoqueBaixo: EstoqueBaixoCtx[],
  hoje: string,
): ContextoPlantio {
  const ativos = talhoes.length;
  const areaHa = round1(talhoes.reduce((s, t) => s + t.areaHa, 0));

  const prods = talhoes.filter((t) => t.produtividadeEsperada != null && (t.produtividadeEsperada as number) > 0).map((t) => t.produtividadeEsperada as number);
  const produtividadeMediaEsperada = prods.length ? round1(prods.reduce((s, x) => s + x, 0) / prods.length) : null;

  // Contagem por fase + fase dominante.
  const faseMap = new Map<string, number>();
  for (const t of talhoes) faseMap.set(t.fase, (faseMap.get(t.fase) ?? 0) + 1);
  const porFase = [...faseMap.entries()].map(([fase, n]) => ({ fase, n })).sort((a, b) => b.n - a.n);
  const faseDominante = porFase.length ? porFase[0].fase : null;

  const alertaFerrugem = talhoes
    .filter((t) => t.ferrugem != null && (t.ferrugem as number) >= FERRUGEM_ALERTA)
    .sort((a, b) => (b.ferrugem as number) - (a.ferrugem as number))
    .map((t) => ({ codigo: t.codigo, nome: t.nome, ferrugem: t.ferrugem as number, tendencia: t.tendFerrugem }));

  const alertaBroca = talhoes
    .filter((t) => t.broca != null && (t.broca as number) >= BROCA_ALERTA)
    .sort((a, b) => (b.broca as number) - (a.broca as number))
    .map((t) => ({ codigo: t.codigo, nome: t.nome, broca: t.broca as number }));

  const prontosColher = talhoes
    .filter((t) => t.maturacaoCereja != null && (t.maturacaoCereja as number) >= CEREJA_PRONTA && t.fase !== "COLHEITA")
    .sort((a, b) => (b.maturacaoCereja as number) - (a.maturacaoCereja as number))
    .map((t) => ({ codigo: t.codigo, nome: t.nome, maturacaoCereja: t.maturacaoCereja as number }));

  const foliarVencida = talhoes
    .filter((t) => { const d = diasDesde(t.ultimaAnaliseFoliar, hoje); return d == null || d > FOLIAR_VENCE_DIAS; })
    .map((t) => ({ codigo: t.codigo, nome: t.nome, ultimaAnaliseFoliar: t.ultimaAnaliseFoliar }));

  const soloVencido = talhoes
    .filter((t) => { const d = diasDesde(t.ultimaAnaliseSolo, hoje); return d == null || d > SOLO_VENCE_DIAS; })
    .map((t) => ({ codigo: t.codigo, nome: t.nome, ultimaAnaliseSolo: t.ultimaAnaliseSolo }));

  return {
    totais: { ativos, areaHa, produtividadeMediaEsperada },
    porFase,
    faseDominante,
    alertaFerrugem,
    alertaBroca,
    prontosColher,
    foliarVencida,
    soloVencido,
    custo,
    colheita,
    estoqueBaixo,
  };
}

const apelido = (codigo: string, nome: string | null) => (nome ? `${nome} (${codigo})` : codigo);
const fmtBR = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function contextoPlantioParaTexto(ctx: ContextoPlantio): string {
  const L: string[] = [];
  const t = ctx.totais;
  L.push("LAVOURA DE CAFÉ (números atuais):");
  L.push(`- Talhões ativos: ${t.ativos} · Área: ${t.areaHa} ha · Produtividade média esperada: ${t.produtividadeMediaEsperada != null ? `${t.produtividadeMediaEsperada} sc/ha` : "—"}`);
  L.push(`- Fase dominante: ${ctx.faseDominante ?? "—"}`);
  if (ctx.porFase.length) L.push(`- Por fase: ${ctx.porFase.map((f) => `${f.fase} ${f.n}`).join(" · ")}`);

  L.push("");
  L.push(`Ferrugem alta (≥ ${FERRUGEM_ALERTA}%):`);
  if (ctx.alertaFerrugem.length) ctx.alertaFerrugem.forEach((a) => L.push(`- ${apelido(a.codigo, a.nome)} — ${a.ferrugem}%${a.tendencia ? ` · ${a.tendencia}` : ""}`));
  else L.push("- nenhum");

  L.push("");
  L.push(`Broca alta (≥ ${BROCA_ALERTA}%):`);
  if (ctx.alertaBroca.length) ctx.alertaBroca.forEach((a) => L.push(`- ${apelido(a.codigo, a.nome)} — ${a.broca}%`));
  else L.push("- nenhum");

  L.push("");
  L.push(`Prontos pra colher (cereja ≥ ${CEREJA_PRONTA}%, fora de colheita):`);
  if (ctx.prontosColher.length) ctx.prontosColher.forEach((a) => L.push(`- ${apelido(a.codigo, a.nome)} — ${a.maturacaoCereja}% cereja`));
  else L.push("- nenhum");

  L.push("");
  L.push(`Análise foliar vencida (> ${FOLIAR_VENCE_DIAS} dias ou nunca feita):`);
  if (ctx.foliarVencida.length) ctx.foliarVencida.forEach((a) => L.push(`- ${apelido(a.codigo, a.nome)} — ${a.ultimaAnaliseFoliar ?? "nunca"}`));
  else L.push("- nenhum");

  L.push("");
  L.push(`Análise de solo vencida (> ${SOLO_VENCE_DIAS} dias ou nunca feita):`);
  if (ctx.soloVencido.length) ctx.soloVencido.forEach((a) => L.push(`- ${apelido(a.codigo, a.nome)} — ${a.ultimaAnaliseSolo ?? "nunca"}`));
  else L.push("- nenhum");

  L.push("");
  L.push("Custo do café (últimos " + ctx.custo.periodoMeses + " meses):");
  L.push(`- Custo/saca: ${ctx.custo.custoSaca != null ? `R$ ${fmtBR(ctx.custo.custoSaca)}` : "—"} · Custo/ha: ${ctx.custo.custoHa != null ? `R$ ${fmtBR(ctx.custo.custoHa)}` : "—"}`);
  L.push(`- Custeio: R$ ${fmtBR(ctx.custo.custeioTotal)} · Investimento (formação): R$ ${fmtBR(ctx.custo.investimentoTotal)} · Sacas no período: ${ctx.custo.sacasPeriodo}`);
  if (ctx.custo.breakdown.length) L.push(`- Maiores categorias: ${ctx.custo.breakdown.slice(0, 3).map((b) => `${b.categoria} ${b.pct}%`).join(" · ")}`);

  L.push("");
  L.push("Colheita do ano:");
  L.push(`- ${ctx.colheita.passadas} passada(s) registrada(s) · ${ctx.colheita.sacasBeneficiadas} sc beneficiadas`);

  L.push("");
  L.push("Estoque abaixo do mínimo:");
  if (ctx.estoqueBaixo.length) ctx.estoqueBaixo.forEach((e) => L.push(`- ${e.nome} — ${e.saldo} ${e.unidade}${e.minimoEstoque != null ? ` (mín. ${e.minimoEstoque})` : ""}`));
  else L.push("- nenhum");

  return L.join("\n");
}
