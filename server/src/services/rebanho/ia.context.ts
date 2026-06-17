// Montador de contexto do rebanho para a IA — função PURA (sem Prisma).
// Recebe animais ATIVOS já mapeados (Decimal→Number, datas→ISO YYYY-MM-DD) e os
// lotes, e produz um snapshot do rebanho + um texto PT-BR usado como system prompt.

export interface AnimalCtx {
  numero: string; nome: string | null; categoria: string;
  statusReprodutivo: string | null; del: number | null;
  producaoMediaDia: number | null; ccs: number | null; ccsTendencia: string | null;
  diasGestacao: number | null; previsaoSecagem: string | null; iepProjetado: number | null;
}
export interface LoteCtx { nome: string; dietaNome: string | null; numAnimais: number; producaoMedia: number | null; }
export interface ContextoRebanho {
  totais: { ativos: number; emLactacao: number; secas: number; gestantes: number; vazias: number };
  producaoMediaRebanho: number | null;
  prenhezPct: number | null;
  ccsAlto: { numero: string; nome: string | null; ccs: number; tendencia: string | null }[];
  vaziasAtrasadas: { numero: string; nome: string | null; del: number | null }[];
  aSecar: { numero: string; nome: string | null; previsaoSecagem: string; diasGestacao: number | null }[];
  partosPrevistos: { numero: string; nome: string | null; diasGestacao: number | null }[];
  lotes: LoteCtx[];
}

const CCS_ALTO = 400;
const VAZIA_ATRASADA_DEL = 90;
const A_SECAR_JANELA_DIAS = 30;
const PARTO_PROXIMO_DIAS_GESTACAO = 253;

const ELEGIVEIS_PRENHEZ = new Set(["PRENHE", "VAZIA", "INSEMINADA", "PEV"]);

const round1 = (x: number) => Math.round(x * 10) / 10;

// "hoje" (ISO YYYY-MM-DD) + dias → ISO YYYY-MM-DD
function somarDias(isoHoje: string, dias: number): string {
  const d = new Date(`${isoHoje}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function montarContexto(animais: AnimalCtx[], lotes: LoteCtx[], hoje: string): ContextoRebanho {
  const ativos = animais.length;
  const emLactacao = animais.filter((a) => a.del != null).length;
  const secas = animais.filter((a) => a.del == null && a.statusReprodutivo != null && a.statusReprodutivo !== "").length;
  const gestantes = animais.filter((a) => a.statusReprodutivo === "PRENHE").length;
  const vazias = animais.filter((a) => a.statusReprodutivo === "VAZIA").length;

  const prods = animais.filter((a) => a.del != null && a.producaoMediaDia != null).map((a) => a.producaoMediaDia as number);
  const producaoMediaRebanho = prods.length ? round1(prods.reduce((s, x) => s + x, 0) / prods.length) : null;

  const elegiveis = animais.filter((a) => a.statusReprodutivo != null && ELEGIVEIS_PRENHEZ.has(a.statusReprodutivo)).length;
  const prenhezPct = elegiveis ? Math.round((100 * gestantes) / elegiveis) : null;

  const ccsAlto = animais
    .filter((a) => a.ccs != null && a.ccs >= CCS_ALTO)
    .sort((x, y) => (y.ccs as number) - (x.ccs as number))
    .map((a) => ({ numero: a.numero, nome: a.nome, ccs: a.ccs as number, tendencia: a.ccsTendencia }));

  const vaziasAtrasadas = animais
    .filter((a) => a.statusReprodutivo === "VAZIA" && a.del != null && a.del > VAZIA_ATRASADA_DEL)
    .map((a) => ({ numero: a.numero, nome: a.nome, del: a.del }));

  const limiteSecagem = somarDias(hoje, A_SECAR_JANELA_DIAS);
  const aSecar = animais
    .filter((a) => a.statusReprodutivo === "PRENHE" && a.previsaoSecagem != null && a.previsaoSecagem <= limiteSecagem)
    .sort((x, y) => (x.previsaoSecagem as string).localeCompare(y.previsaoSecagem as string))
    .map((a) => ({ numero: a.numero, nome: a.nome, previsaoSecagem: a.previsaoSecagem as string, diasGestacao: a.diasGestacao }));

  const partosPrevistos = animais
    .filter((a) => a.statusReprodutivo === "PRENHE" && a.diasGestacao != null && a.diasGestacao >= PARTO_PROXIMO_DIAS_GESTACAO)
    .sort((x, y) => (y.diasGestacao as number) - (x.diasGestacao as number))
    .map((a) => ({ numero: a.numero, nome: a.nome, diasGestacao: a.diasGestacao }));

  return {
    totais: { ativos, emLactacao, secas, gestantes, vazias },
    producaoMediaRebanho,
    prenhezPct,
    ccsAlto,
    vaziasAtrasadas,
    aSecar,
    partosPrevistos,
    lotes,
  };
}

const apelido = (numero: string, nome: string | null) => `${nome ?? "Sem nome"} #${numero}`;

export function contextoParaTexto(ctx: ContextoRebanho): string {
  const L: string[] = [];
  const t = ctx.totais;
  L.push("REBANHO (números atuais):");
  L.push(`- Ativos: ${t.ativos} · Em lactação: ${t.emLactacao} · Secas: ${t.secas} · Gestantes: ${t.gestantes} · Vazias: ${t.vazias}`);
  L.push(`- Produção média do rebanho: ${ctx.producaoMediaRebanho != null ? `${ctx.producaoMediaRebanho} L/dia` : "—"}`);
  L.push(`- Prenhez: ${ctx.prenhezPct != null ? `${ctx.prenhezPct}%` : "—"}`);

  L.push("");
  L.push(`CCS alto (≥ ${CCS_ALTO} mil):`);
  if (ctx.ccsAlto.length) ctx.ccsAlto.forEach((a) => L.push(`- ${apelido(a.numero, a.nome)} — ${a.ccs} mil${a.tendencia ? ` · ${a.tendencia}` : ""}`));
  else L.push("- nenhum");

  L.push("");
  L.push("Vazias atrasadas (PEV):");
  if (ctx.vaziasAtrasadas.length) ctx.vaziasAtrasadas.forEach((a) => L.push(`- ${apelido(a.numero, a.nome)} — ${a.del ?? "—"} DEL`));
  else L.push("- nenhuma");

  L.push("");
  L.push("A secar (próximos 30 dias, inclui atrasadas):");
  if (ctx.aSecar.length) ctx.aSecar.forEach((a) => L.push(`- ${apelido(a.numero, a.nome)} — secar até ${a.previsaoSecagem}`));
  else L.push("- nenhuma");

  L.push("");
  L.push("Partos previstos:");
  if (ctx.partosPrevistos.length) ctx.partosPrevistos.forEach((a) => L.push(`- ${apelido(a.numero, a.nome)} — ${a.diasGestacao ?? "—"} dias de gestação`));
  else L.push("- nenhum");

  L.push("");
  L.push("Lotes:");
  if (ctx.lotes.length) ctx.lotes.forEach((l) => L.push(`- ${l.nome}: ${l.producaoMedia ?? "—"} L/d · ${l.numAnimais} animais · dieta ${l.dietaNome ?? "sem dieta"}`));
  else L.push("- nenhum");

  return L.join("\n");
}
