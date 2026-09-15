/* Relatórios financeiros persistidos — regras puras de composição.
 *
 * O filtro atua em dois níveis, como a análise por categoria:
 *  - operação: tipo, situação e centro de custo;
 *  - fatia classificada: categoria e custeio × investimento. Uma operação com
 *    itens de categorias diferentes entra só com as fatias que batem no filtro.
 */
import { Prisma } from "@prisma/client";
import type { ConfiguracaoRelatorioFinanceiro } from "./relatorios.schemas.js";
import type { RelatorioGerencialDTO } from "../relatorio-gerencial.js";

type Classificacao = "CUSTEIO" | "INVESTIMENTO" | null;
export type FiltroRelatorio = Pick<ConfiguracaoRelatorioFinanceiro, "tipos" | "status" | "centroCustoIds" | "categoriaIds" | "classificacoes">;

export const ROTULO_TIPO: Record<string, string> = {
  COMPRA_ESTOQUE: "Compra para estoque", COMPRA_CONSUMO_DIRETO: "Compra para consumo direto",
  SERVICO: "Serviço", VENDA: "Venda", APORTE: "Aporte", RETIRADA: "Retirada",
  TRANSFERENCIA_FINANCEIRA: "Transferência", AJUSTE_ESTOQUE: "Ajuste de estoque",
  TRANSFERENCIA_ESTOQUE: "Transferência de estoque", INVENTARIO_INICIAL: "Inventário inicial",
  BONIFICACAO: "Bonificação", DEVOLUCAO: "Devolução", PRODUCAO: "Produção própria",
};
export const ROTULO_STATUS: Record<string, string> = { CONFIRMADA: "Confirmada", CANCELADA: "Cancelada" };
export const ROTULO_CLASSIFICACAO: Record<string, string> = { CUSTEIO: "Custeio", INVESTIMENTO: "Investimento", SEM_CLASSIFICACAO: "Não classificada" };
export const SEM_CATEGORIA = "Sem categoria";
export const SEM_CENTRO = "Sem centro de custo";

export function filtroVazio(filtro?: FiltroRelatorio | null) {
  return !filtro || (!filtro.tipos.length && !filtro.status.length && !filtro.centroCustoIds.length && !filtro.categoriaIds.length && !filtro.classificacoes.length);
}

/** Lançamento sem operação (transferência, pagamento avulso) não tem tipo nem
 * situação: só entra com esses filtros livres e conta como "sem centro". */
export function operacaoPassa(filtro: FiltroRelatorio | null | undefined, operacao: { tipo: string; status: string; centroCustoId: number | null } | null) {
  if (!filtro) return true;
  const centroOk = (id: number | null) => !filtro.centroCustoIds.length || filtro.centroCustoIds.includes(id ?? 0);
  if (!operacao) return !filtro.tipos.length && !filtro.status.length && centroOk(null);
  return (!filtro.tipos.length || (filtro.tipos as readonly string[]).includes(operacao.tipo))
    && (!filtro.status.length || (filtro.status as readonly string[]).includes(operacao.status))
    && centroOk(operacao.centroCustoId);
}

export function partePassa(filtro: FiltroRelatorio | null | undefined, parte: { categoriaId?: number | null; classificacao?: Classificacao }) {
  if (!filtro) return true;
  return (!filtro.categoriaIds.length || filtro.categoriaIds.includes(parte.categoriaId ?? 0))
    && (!filtro.classificacoes.length || filtro.classificacoes.includes(parte.classificacao ?? "SEM_CLASSIFICACAO"));
}

export interface CadastrosFiltro { categorias: { id: number; nome: string }[]; centrosCusto: { id: number; nome: string }[] }
export interface FiltrosDescritos { tipos: string[]; status: string[]; centrosCusto: string[]; categorias: string[]; classificacoes: string[] }

/** Congela os nomes no instante da geração: renomear ou desativar um cadastro
 * depois não altera o que o relatório emitido declara ter filtrado. */
export function descreverFiltros(filtro: FiltroRelatorio, cadastros: CadastrosFiltro): FiltrosDescritos {
  const nomes = (ids: number[], lista: { id: number; nome: string }[], vazio: string) => ids.map((id) => id === 0 ? vazio : lista.find((item) => item.id === id)?.nome ?? `#${id}`);
  return {
    tipos: filtro.tipos.map((tipo) => ROTULO_TIPO[tipo] ?? tipo),
    status: filtro.status.map((status) => ROTULO_STATUS[status] ?? status),
    centrosCusto: nomes(filtro.centroCustoIds, cadastros.centrosCusto, SEM_CENTRO),
    categorias: nomes(filtro.categoriaIds, cadastros.categorias, SEM_CATEGORIA),
    classificacoes: filtro.classificacoes.map((classificacao) => ROTULO_CLASSIFICACAO[classificacao]),
  };
}

type Valor = Prisma.Decimal | string | number;
export interface OperacaoComposicao {
  id: number; data: Date; tipo: string; status: string; descricao: string | null; valorTotal: Valor;
  centroCustoId: number | null; centroCusto: { nome: string } | null; parceiro: { nome: string } | null;
  categoriaId: number | null; categoriaNome: string | null; classificacao: Classificacao;
  itens: { id: number; descricao: string; quantidade: Valor; unidade: string; valorTotal: Valor; categoriaId: number | null; categoriaNome: string | null; classificacao: Classificacao }[];
}
export interface LinhaComposicao {
  operacaoId: number; data: string; tipo: string; status: string; descricao: string | null; item: string | null;
  quantidade: string | null; unidade: string | null; parceiro: string | null;
  categoriaId: number | null; categoria: string; centroCusto: string; classificacao: Classificacao; valor: string;
}
export interface TotalGrupo { nome: string; total: string; pct: number }
export interface TotalCategoria extends TotalGrupo { custeio: string; investimento: string; semClassificacao: string }
export interface Composicao {
  linhas: LinhaComposicao[];
  totalLinhas: number;
  truncado: boolean;
  porTipo: { tipo: string; rotulo: string; operacoes: number; total: string }[];
  despesas: { total: string; custeio: string; investimento: string; semClassificacao: string; porCategoria: TotalCategoria[]; porCentro: TotalGrupo[] };
}

// Mesma base de "Compras e serviços" da análise por categoria.
export const TIPOS_DESPESA: readonly string[] = ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO"];
export const LIMITE_LINHAS_COMPOSICAO = 3000;

const zero = () => new Prisma.Decimal(0);
const pct = (parte: Prisma.Decimal, total: Prisma.Decimal) => total.isZero() ? 0 : parte.div(total).mul(10000).round().div(100).toNumber();

/** Itens das operações pela data da operação (competência). Operação sem itens
 * vira uma linha única com a própria classificação. */
export function comporItens(operacoes: OperacaoComposicao[], filtro?: FiltroRelatorio | null): Composicao {
  const linhas: LinhaComposicao[] = [];
  for (const operacao of operacoes) {
    if (!operacaoPassa(filtro, operacao)) continue;
    const partes = operacao.itens.length
      ? [...operacao.itens].sort((a, b) => a.id - b.id).map((item) => ({ ...item, item: item.descricao, quantidade: new Prisma.Decimal(item.quantidade).toString(), unidade: item.unidade as string | null }))
      : [{ categoriaId: operacao.categoriaId, categoriaNome: operacao.categoriaNome, classificacao: operacao.classificacao, valorTotal: operacao.valorTotal, item: null, quantidade: null, unidade: null }];
    for (const parte of partes) {
      if (!partePassa(filtro, parte)) continue;
      linhas.push({
        operacaoId: operacao.id, data: operacao.data.toISOString().slice(0, 10), tipo: operacao.tipo, status: operacao.status,
        descricao: operacao.descricao, item: parte.item, quantidade: parte.quantidade, unidade: parte.unidade, parceiro: operacao.parceiro?.nome ?? null,
        categoriaId: parte.categoriaId ?? null, categoria: parte.categoriaNome ?? SEM_CATEGORIA, centroCusto: operacao.centroCusto?.nome ?? SEM_CENTRO,
        classificacao: parte.classificacao ?? null, valor: new Prisma.Decimal(parte.valorTotal).toFixed(2),
      });
    }
  }

  const porTipo = new Map<string, { operacoes: Set<number>; total: Prisma.Decimal }>();
  for (const linha of linhas) {
    const atual = porTipo.get(linha.tipo) ?? { operacoes: new Set<number>(), total: zero() };
    atual.operacoes.add(linha.operacaoId); atual.total = atual.total.plus(linha.valor); porTipo.set(linha.tipo, atual);
  }

  // Despesa efetiva: compras e serviços confirmados. Canceladas continuam
  // listadas nas linhas (quando escolhidas), mas não somam custo.
  const despesas = linhas.filter((linha) => TIPOS_DESPESA.includes(linha.tipo) && linha.status === "CONFIRMADA");
  const totais = { total: zero(), custeio: zero(), investimento: zero(), semClassificacao: zero() };
  const porCategoria = new Map<string, { nome: string; total: Prisma.Decimal; custeio: Prisma.Decimal; investimento: Prisma.Decimal; semClassificacao: Prisma.Decimal }>();
  const porCentro = new Map<string, Prisma.Decimal>();
  for (const linha of despesas) {
    const chaveClassificacao = linha.classificacao === "CUSTEIO" ? "custeio" : linha.classificacao === "INVESTIMENTO" ? "investimento" : "semClassificacao";
    totais.total = totais.total.plus(linha.valor);
    totais[chaveClassificacao] = totais[chaveClassificacao].plus(linha.valor);
    const chave = `${linha.categoriaId ?? 0}:${linha.categoria}`;
    const categoria = porCategoria.get(chave) ?? { nome: linha.categoria, total: zero(), custeio: zero(), investimento: zero(), semClassificacao: zero() };
    categoria.total = categoria.total.plus(linha.valor);
    categoria[chaveClassificacao] = categoria[chaveClassificacao].plus(linha.valor);
    porCategoria.set(chave, categoria);
    porCentro.set(linha.centroCusto, (porCentro.get(linha.centroCusto) ?? zero()).plus(linha.valor));
  }
  const desc = (a: { total: Prisma.Decimal; nome: string }, b: { total: Prisma.Decimal; nome: string }) => b.total.comparedTo(a.total) || a.nome.localeCompare(b.nome, "pt-BR");

  return {
    linhas: linhas.slice(0, LIMITE_LINHAS_COMPOSICAO),
    totalLinhas: linhas.length,
    truncado: linhas.length > LIMITE_LINHAS_COMPOSICAO,
    porTipo: [...porTipo.entries()]
      .map(([tipo, valor]) => ({ tipo, rotulo: ROTULO_TIPO[tipo] ?? tipo, operacoes: valor.operacoes.size, total: valor.total }))
      .sort((a, b) => b.total.comparedTo(a.total) || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
      .map((item) => ({ ...item, total: item.total.toFixed(2) })),
    despesas: {
      total: totais.total.toFixed(2), custeio: totais.custeio.toFixed(2), investimento: totais.investimento.toFixed(2), semClassificacao: totais.semClassificacao.toFixed(2),
      porCategoria: [...porCategoria.values()].sort(desc).map((c) => ({ nome: c.nome, total: c.total.toFixed(2), pct: pct(c.total, totais.total), custeio: c.custeio.toFixed(2), investimento: c.investimento.toFixed(2), semClassificacao: c.semClassificacao.toFixed(2) })),
      porCentro: [...porCentro.entries()].map(([nome, total]) => ({ nome, total })).sort(desc).map((c) => ({ nome: c.nome, total: c.total.toFixed(2), pct: pct(c.total, totais.total) })),
    },
  };
}

/** Tudo o que o relatório emitido declarou — nunca recalculado depois. */
export interface SnapshotRelatorio {
  versao: 1;
  nome: string;
  geradoEm: string;
  autor: string;
  propriedade: { id: number; nome: string } | null;
  configuracao: ConfiguracaoRelatorioFinanceiro;
  filtros: FiltrosDescritos;
  gerencial: RelatorioGerencialDTO;
  composicao: Composicao;
}
