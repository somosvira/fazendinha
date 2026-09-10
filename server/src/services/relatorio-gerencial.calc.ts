/* Relatório financeiro gerencial — cálculo puro.
 *
 * Recebe linhas de `Lancamento` já convertidas (Decimal → number) e devolve os
 * agregados de cada seção. Regras do domínio (regime de caixa):
 *   - realizado  = LIQUIDADO, não estornado, dataLiquidacao dentro do período;
 *   - previsto   = ABERTO, não estornado (compromissos), por dataVencimento;
 *   - transferências ("(Sem centro de custo)") movem saldo de conta mas não
 *     entram em entradas/saídas/resultado — mesma regra do Dashboard;
 *   - estornos e LIQUIDADO_PARCIAL nunca entram em totais; aparecem só em
 *     "operações por tipo" para auditoria.
 * Somas acumulam em centavos inteiros para não acumular erro de ponto flutuante.
 */

export type Natureza = "CREDITO" | "DEBITO";
export type Situacao = "ABERTO" | "LIQUIDADO" | "LIQUIDADO_PARCIAL";
export type Atividade = "leite" | "cafe" | "outros";
export type TipoOperacao = "receita" | "custeio" | "investimento" | "transferencia" | "compromisso" | "parcial" | "estorno";

export const CENTRO_TRANSFERENCIA = "(Sem centro de custo)";

export interface LinhaLancamento {
  id: string;
  natureza: Natureza;
  valor: number;
  situacao: Situacao;
  estornado: boolean;
  dataLiquidacao: string | null;
  dataVencimento: string;
  descricao: string | null;
  numeroDocumento: string | null;
  categoria: { nome: string; classificacao: "CUSTEIO" | "INVESTIMENTO" | null; grupo: string };
  centroCusto: { nome: string; ehInvestimento: boolean };
  contaBancariaId: string | null;
  fornecedor: string | null;
  temNotaFiscal: boolean;
}

const cents = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;
const pct = (parte: number, total: number) => (total === 0 ? 0 : Math.round((parte / total) * 10000) / 100);

export function atividadeDe(centroNome: string): Atividade {
  if (centroNome.includes("Leiteira")) return "leite";
  if (centroNome.includes("Café") || centroNome.includes("Plantio")) return "cafe";
  return "outros";
}

export function classificarLinha(l: LinhaLancamento): TipoOperacao {
  if (l.estornado) return "estorno";
  if (l.situacao === "LIQUIDADO_PARCIAL") return "parcial";
  if (l.situacao === "ABERTO") return "compromisso";
  if (l.centroCusto.nome === CENTRO_TRANSFERENCIA) return "transferencia";
  if (l.natureza === "CREDITO") return "receita";
  const investimento = l.centroCusto.ehInvestimento
    || /investimento/i.test(l.centroCusto.nome)
    || l.categoria.classificacao === "INVESTIMENTO";
  return investimento ? "investimento" : "custeio";
}

const ehLiquidadoValido = (l: LinhaLancamento) =>
  !l.estornado && l.situacao === "LIQUIDADO" && l.dataLiquidacao != null;
const noPeriodo = (data: string | null, inicio: string, fim: string) => data != null && data >= inicio && data <= fim;

export function mesesEntre(inicio: string, fim: string): string[] {
  const [ai, mi] = inicio.split("-").map(Number);
  const [af, mf] = fim.split("-").map(Number);
  const out: string[] = [];
  for (let y = ai, m = mi; y < af || (y === af && m <= mf); ) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export interface TotaisFluxo { entradas: number; saidas: number; resultado: number }
export interface MesFluxo extends TotaisFluxo { mes: string }
export interface ResultadoAtividade { atividade: Atividade; receita: number; custeio: number; investimento: number; resultado: number }
export interface ResultadoPeriodo { receita: number; custeio: number; investimento: number; resultado: number; porAtividade: ResultadoAtividade[] }
export interface CategoriaTotal { categoria: string; total: number; pct: number }
export interface GrupoTotal { grupo: string; total: number; pct: number; categorias: CategoriaTotal[] }
export interface CentroTotal { centro: string; total: number; pct: number }
export interface RealizadoAgregado {
  totais: TotaisFluxo;
  nLancamentos: number;
  meses: MesFluxo[];
  resultado: ResultadoPeriodo;
  categorias: { grupos: GrupoTotal[]; centros: CentroTotal[] };
}

const ATIVIDADES: Atividade[] = ["leite", "cafe", "outros"];

export function agregarRealizado(linhas: LinhaLancamento[], inicio: string, fim: string): RealizadoAgregado {
  const validas = linhas.filter((l) => {
    const tipo = classificarLinha(l);
    return (tipo === "receita" || tipo === "custeio" || tipo === "investimento") && noPeriodo(l.dataLiquidacao, inicio, fim);
  });

  const porMes = new Map<string, { entradas: number; saidas: number }>();
  for (const mes of mesesEntre(inicio, fim)) porMes.set(mes, { entradas: 0, saidas: 0 });
  let entradas = 0;
  let saidas = 0;
  let receita = 0;
  let custeio = 0;
  let investimento = 0;
  const porAtividade = new Map<Atividade, { receita: number; custeio: number; investimento: number }>(
    ATIVIDADES.map((a) => [a, { receita: 0, custeio: 0, investimento: 0 }]),
  );
  const grupos = new Map<string, { total: number; categorias: Map<string, number> }>();
  const centros = new Map<string, number>();

  for (const l of validas) {
    const v = cents(l.valor);
    const tipo = classificarLinha(l);
    const mes = l.dataLiquidacao!.slice(0, 7);
    const bucket = porMes.get(mes);
    const atv = porAtividade.get(atividadeDe(l.centroCusto.nome))!;
    if (tipo === "receita") {
      entradas += v; receita += v; atv.receita += v;
      if (bucket) bucket.entradas += v;
      continue;
    }
    saidas += v;
    if (bucket) bucket.saidas += v;
    if (tipo === "investimento") { investimento += v; atv.investimento += v; }
    else { custeio += v; atv.custeio += v; }
    const g = grupos.get(l.categoria.grupo) ?? { total: 0, categorias: new Map<string, number>() };
    g.total += v;
    g.categorias.set(l.categoria.nome, (g.categorias.get(l.categoria.nome) ?? 0) + v);
    grupos.set(l.categoria.grupo, g);
    centros.set(l.centroCusto.nome, (centros.get(l.centroCusto.nome) ?? 0) + v);
  }

  const desc = <T extends { total: number }>(a: T, b: T) => b.total - a.total;
  return {
    totais: { entradas: reais(entradas), saidas: reais(saidas), resultado: reais(entradas - saidas) },
    nLancamentos: validas.length,
    meses: [...porMes.entries()].map(([mes, b]) => ({ mes, entradas: reais(b.entradas), saidas: reais(b.saidas), resultado: reais(b.entradas - b.saidas) })),
    resultado: {
      receita: reais(receita),
      custeio: reais(custeio),
      investimento: reais(investimento),
      resultado: reais(receita - custeio - investimento),
      porAtividade: ATIVIDADES.map((atividade) => {
        const a = porAtividade.get(atividade)!;
        return { atividade, receita: reais(a.receita), custeio: reais(a.custeio), investimento: reais(a.investimento), resultado: reais(a.receita - a.custeio - a.investimento) };
      }),
    },
    categorias: {
      grupos: [...grupos.entries()].map(([grupo, g]) => ({
        grupo,
        total: reais(g.total),
        pct: pct(g.total, saidas),
        categorias: [...g.categorias.entries()].map(([categoria, total]) => ({ categoria, total: reais(total), pct: pct(total, saidas) })).sort(desc),
      })).sort(desc),
      centros: [...centros.entries()].map(([centro, total]) => ({ centro, total: reais(total), pct: pct(total, saidas) })).sort(desc),
    },
  };
}

export interface ItemCompromisso {
  id: string;
  descricao: string | null;
  fornecedor: string | null;
  categoria: string;
  valor: number;
  dataVencimento: string;
  diasAtraso: number;
  vencido: boolean;
}
export interface BlocoCompromisso { total: number; vencido: number; aVencer: number; quantidade: number; itens: ItemCompromisso[] }
export interface PrevistoAgregado { hoje: string; aPagar: BlocoCompromisso; aReceber: BlocoCompromisso }

const MS_DIA = 86_400_000;
const diffDias = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / MS_DIA);
export const LIMITE_ITENS_COMPROMISSO = 200;

export function agregarPrevisto(linhas: LinhaLancamento[], hoje: string): PrevistoAgregado {
  const bloco = (natureza: Natureza): BlocoCompromisso => {
    const itens = linhas
      .filter((l) => classificarLinha(l) === "compromisso" && l.natureza === natureza)
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento) || a.id.localeCompare(b.id))
      .map((l): ItemCompromisso => {
        const diasAtraso = diffDias(l.dataVencimento, hoje);
        return { id: l.id, descricao: l.descricao, fornecedor: l.fornecedor, categoria: l.categoria.nome, valor: l.valor, dataVencimento: l.dataVencimento, diasAtraso, vencido: diasAtraso > 0 };
      });
    let vencido = 0;
    let aVencer = 0;
    for (const i of itens) (i.vencido ? (vencido += cents(i.valor)) : (aVencer += cents(i.valor)));
    return { total: reais(vencido + aVencer), vencido: reais(vencido), aVencer: reais(aVencer), quantidade: itens.length, itens: itens.slice(0, LIMITE_ITENS_COMPROMISSO) };
  };
  return { hoje, aPagar: bloco("DEBITO"), aReceber: bloco("CREDITO") };
}

export interface ContaEntrada { id: string; nome: string; banco: string | null; saldoInicial: number }
export interface MovimentoAnterior { contaBancariaId: string | null; natureza: Natureza; total: number }
export interface SaldoConta { id: string; nome: string; banco: string | null; saldoInicial: number; entradas: number; saidas: number; saldoFinal: number }
export interface SaldoContasAgregado { contas: SaldoConta[]; total: { saldoInicial: number; entradas: number; saidas: number; saldoFinal: number } }

/** Saldo por conta: saldo de abertura + movimentos liquidados antes do período
 *  (`anteriores`, já somados pelo banco) + movimentos liquidados no período.
 *  Inclui transferências — elas movem dinheiro de verdade entre contas. */
export function agregarSaldoContas(
  contas: ContaEntrada[],
  anteriores: MovimentoAnterior[],
  linhas: LinhaLancamento[],
  inicio: string,
  fim: string,
): SaldoContasAgregado {
  const acc = new Map<string, { inicial: number; entradas: number; saidas: number }>();
  for (const c of contas) acc.set(c.id, { inicial: cents(c.saldoInicial), entradas: 0, saidas: 0 });
  for (const m of anteriores) {
    if (m.contaBancariaId == null) continue;
    const a = acc.get(m.contaBancariaId);
    if (a) a.inicial += m.natureza === "CREDITO" ? cents(m.total) : -cents(m.total);
  }
  for (const l of linhas) {
    if (l.contaBancariaId == null || !ehLiquidadoValido(l) || !noPeriodo(l.dataLiquidacao, inicio, fim)) continue;
    const a = acc.get(l.contaBancariaId);
    if (!a) continue;
    if (l.natureza === "CREDITO") a.entradas += cents(l.valor);
    else a.saidas += cents(l.valor);
  }
  const out = contas.map((c): SaldoConta => {
    const a = acc.get(c.id)!;
    return { id: c.id, nome: c.nome, banco: c.banco, saldoInicial: reais(a.inicial), entradas: reais(a.entradas), saidas: reais(a.saidas), saldoFinal: reais(a.inicial + a.entradas - a.saidas) };
  });
  const soma = (k: keyof Omit<SaldoConta, "id" | "nome" | "banco">) => reais(out.reduce((s, c) => s + cents(c[k]), 0));
  return { contas: out, total: { saldoInicial: soma("saldoInicial"), entradas: soma("entradas"), saidas: soma("saidas"), saldoFinal: soma("saldoFinal") } };
}

export interface OperacaoPorTipo { tipo: TipoOperacao; quantidade: number; valor: number; entraNoTotal: boolean }

const ORDEM_TIPOS: TipoOperacao[] = ["receita", "custeio", "investimento", "transferencia", "compromisso", "parcial", "estorno"];
const ENTRA_NO_TOTAL = new Set<TipoOperacao>(["receita", "custeio", "investimento"]);

export function agregarOperacoesPorTipo(linhas: LinhaLancamento[]): OperacaoPorTipo[] {
  const acc = new Map<TipoOperacao, { quantidade: number; valor: number }>(ORDEM_TIPOS.map((t) => [t, { quantidade: 0, valor: 0 }]));
  for (const l of linhas) {
    const a = acc.get(classificarLinha(l))!;
    a.quantidade += 1;
    a.valor += cents(l.valor);
  }
  return ORDEM_TIPOS.map((tipo) => {
    const a = acc.get(tipo)!;
    return { tipo, quantidade: a.quantidade, valor: reais(a.valor), entraNoTotal: ENTRA_NO_TOTAL.has(tipo) };
  });
}

export interface Rastreabilidade {
  totalLancamentos: number;
  estornados: number;
  comDocumento: number;
  semDocumento: number;
  comNotaFiscal: number;
  semNotaFiscal: number;
  semCentroCusto: number;
  mesesFechados: string[];
  mesesAbertos: string[];
}

export function agregarRastreabilidade(
  linhas: LinhaLancamento[],
  fechamentos: { ano: number; mes: number }[],
  inicio: string,
  fim: string,
): Rastreabilidade {
  const ativas = linhas.filter((l) => !l.estornado);
  const fechados = new Set(fechamentos.map((f) => `${f.ano}-${String(f.mes).padStart(2, "0")}`));
  const meses = mesesEntre(inicio, fim);
  const comDocumento = ativas.filter((l) => !!l.numeroDocumento?.trim()).length;
  const comNotaFiscal = ativas.filter((l) => l.temNotaFiscal).length;
  return {
    totalLancamentos: ativas.length,
    estornados: linhas.length - ativas.length,
    comDocumento,
    semDocumento: ativas.length - comDocumento,
    comNotaFiscal,
    semNotaFiscal: ativas.length - comNotaFiscal,
    semCentroCusto: ativas.filter((l) => l.centroCusto.nome === CENTRO_TRANSFERENCIA).length,
    mesesFechados: meses.filter((m) => fechados.has(m)),
    mesesAbertos: meses.filter((m) => !fechados.has(m)),
  };
}
