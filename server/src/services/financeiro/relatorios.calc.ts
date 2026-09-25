/* Relatórios financeiros persistidos — regras puras de composição.
 *
 * O filtro atua em dois níveis, como a análise por categoria:
 *  - operação: tipo, situação e parceiro;
 *  - fatia classificada: categoria, custeio × investimento e centro de custo
 *    efetivo (o do item, senão o da operação). Uma operação com itens de
 *    categorias ou centros diferentes entra só com as fatias que batem.
 */
import { Prisma } from "@prisma/client";
import type { ConfiguracaoRelatorioFinanceiro } from "./relatorios.schemas.js";
import type { RelatorioGerencialDTO } from "../relatorio-gerencial.js";
import { SEM_VINCULO } from "../../lib/ids.js";

type Classificacao = "CUSTEIO" | "INVESTIMENTO" | null;
export type FiltroRelatorio = Pick<ConfiguracaoRelatorioFinanceiro, "tipos" | "status" | "classificacoes"> & { centroCustoIds: string[]; categoriaIds: string[]; parceiroIds?: string[] };

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
  return !filtro || (!filtro.tipos.length && !filtro.status.length && !filtro.centroCustoIds.length && !(filtro.parceiroIds?.length) && !filtro.categoriaIds.length && !filtro.classificacoes.length);
}

/** Lançamento sem operação (transferência, pagamento avulso) não tem tipo nem
 * situação: só entra com esses filtros livres. O centro é filtrado por parte
 * (`partePassa`) — o avulso rateia numa única parte "sem centro". */
export function operacaoPassa(filtro: FiltroRelatorio | null | undefined, operacao: { tipo: string; status: string; parceiroId?: string | null } | null) {
  if (!filtro) return true;
  const parceiroOk = (id: string | null | undefined) => !filtro.parceiroIds?.length || filtro.parceiroIds.includes(id ?? SEM_VINCULO);
  if (!operacao) return !filtro.tipos.length && !filtro.status.length && parceiroOk(null);
  return (!filtro.tipos.length || (filtro.tipos as readonly string[]).includes(operacao.tipo))
    && (!filtro.status.length || (filtro.status as readonly string[]).includes(operacao.status))
    && parceiroOk(operacao.parceiroId);
}

/** `centroCustoId` aqui é o efetivo da parte (item ?? operação); `SEM_VINCULO` = sem centro. */
export function partePassa(filtro: FiltroRelatorio | null | undefined, parte: { categoriaId?: string | null; classificacao?: Classificacao; centroCustoId?: string | null }) {
  if (!filtro) return true;
  return (!filtro.categoriaIds.length || filtro.categoriaIds.includes(parte.categoriaId ?? SEM_VINCULO))
    && (!filtro.classificacoes.length || filtro.classificacoes.includes(parte.classificacao ?? "SEM_CLASSIFICACAO"))
    && (!filtro.centroCustoIds.length || filtro.centroCustoIds.includes(parte.centroCustoId ?? SEM_VINCULO));
}

export interface CadastrosFiltro { categorias: { id: string; nome: string }[]; centrosCusto: { id: string; nome: string }[]; parceiros?: { id: string; nome: string }[] }
export interface FiltrosDescritos { tipos: string[]; status: string[]; centrosCusto: string[]; parceiros?: string[]; categorias: string[]; classificacoes: string[] }

/** Congela os nomes no instante da geração: renomear ou desativar um cadastro
 * depois não altera o que o relatório emitido declara ter filtrado. */
export function descreverFiltros(filtro: FiltroRelatorio, cadastros: CadastrosFiltro): FiltrosDescritos {
  const nomes =(ids: string[], lista: { id: string; nome: string }[], vazio: string) => ids.map((id) => id === SEM_VINCULO ? vazio : lista.find((item) => item.id === id)?.nome ?? "(removido)");
  return {
    tipos: filtro.tipos.map((tipo) => ROTULO_TIPO[tipo] ?? tipo),
    status: filtro.status.map((status) => ROTULO_STATUS[status] ?? status),
    centrosCusto: nomes(filtro.centroCustoIds, cadastros.centrosCusto, SEM_CENTRO),
    parceiros: nomes(filtro.parceiroIds ?? [], cadastros.parceiros ?? [], "Sem parceiro"),
    categorias: nomes(filtro.categoriaIds, cadastros.categorias, SEM_CATEGORIA),
    classificacoes: filtro.classificacoes.map((classificacao) => ROTULO_CLASSIFICACAO[classificacao]),
  };
}

type Valor = Prisma.Decimal | string | number;
export interface OperacaoComposicao {
  id: string; numero: number; data: Date; tipo: string; status: string; descricao: string | null; valorTotal: Valor;
  centroCustoId: string | null; centroCusto: { nome: string } | null; parceiro: { nome: string } | null;
  categoriaId: string | null; categoriaNome: string | null; classificacao: Classificacao;
  itens: { id: string; ordem: number; descricao: string; quantidade: Valor; unidade: string; valorTotal: Valor; categoriaId: string | null; categoriaNome: string | null; classificacao: Classificacao; centroCustoId: string | null; centroCustoNome: string | null }[];
}
export interface LinhaComposicao {
  operacaoId: string; operacaoNumero: number; data: string; tipo: string; status: string; descricao: string | null; item: string | null;
  quantidade: string | null; unidade: string | null; parceiro: string | null;
  categoriaId: string | null; categoria: string; centroCustoId: string | null; centroCusto: string; classificacao: Classificacao; valor: string;
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
// O Decimal do Prisma no Worker não expõe o atalho round() do Node.
const pct = (parte: Prisma.Decimal, total: Prisma.Decimal) => total.isZero() ? 0 : parte.div(total).mul(10000).toDecimalPlaces(0).div(100).toNumber();

/** Itens das operações pela data da operação (competência). Operação sem itens
 * vira uma linha única com a própria classificação.
 *
 * `nomesCentro` é o nome VIVO de cada centro (id → nome) no instante da
 * geração — o nome do item pode ser um snapshot antigo (congelado na criação
 * do item), então agrupar só por esse nome duplicaria a linha de um centro
 * renomeado. Sem o mapa, cai no nome do snapshot (compat). */
export function comporItens(operacoes: OperacaoComposicao[], filtro?: FiltroRelatorio | null, nomesCentro?: Map<string, string>): Composicao {
  const nomeCentro = (id: string | null, snapshot: string | null | undefined) => (id ? nomesCentro?.get(id) ?? snapshot ?? SEM_CENTRO : SEM_CENTRO);
  const linhas: LinhaComposicao[] = [];
  for (const operacao of operacoes) {
    if (!operacaoPassa(filtro, operacao)) continue;
    // Centro efetivo da parte: o do item, senão o da operação.
    const centroOperacao = { centroCustoId: operacao.centroCustoId, centroCustoNome: operacao.centroCusto?.nome ?? null };
    const partes = operacao.itens.length
      ? [...operacao.itens].sort((a, b) => a.ordem - b.ordem).map((item) => ({
        ...item, ...(item.centroCustoId ? { centroCustoId: item.centroCustoId, centroCustoNome: item.centroCustoNome } : centroOperacao),
        item: item.descricao, quantidade: new Prisma.Decimal(item.quantidade).toString(), unidade: item.unidade as string | null,
      }))
      : [{ categoriaId: operacao.categoriaId, categoriaNome: operacao.categoriaNome, classificacao: operacao.classificacao, ...centroOperacao, valorTotal: operacao.valorTotal, item: null, quantidade: null, unidade: null }];
    for (const parte of partes) {
      if (!partePassa(filtro, parte)) continue;
      const centroCustoId = parte.centroCustoId ?? null;
      linhas.push({
        operacaoId: operacao.id, operacaoNumero: operacao.numero, data: operacao.data.toISOString().slice(0, 10), tipo: operacao.tipo, status: operacao.status,
        descricao: operacao.descricao, item: parte.item, quantidade: parte.quantidade, unidade: parte.unidade, parceiro: operacao.parceiro?.nome ?? null,
        categoriaId: parte.categoriaId ?? null, categoria: parte.categoriaNome ?? SEM_CATEGORIA,
        centroCustoId, centroCusto: nomeCentro(centroCustoId, parte.centroCustoNome),
        classificacao: parte.classificacao ?? null, valor: new Prisma.Decimal(parte.valorTotal).toFixed(2),
      });
    }
  }

  // Só confirmadas: a cancelada e a operação que a corrige somariam em dobro.
  const porTipo = new Map<string, { operacoes: Set<string>; total: Prisma.Decimal }>();
  for (const linha of linhas.filter((l) => l.status === "CONFIRMADA")) {
    const atual = porTipo.get(linha.tipo) ?? { operacoes: new Set<string>(), total: zero() };
    atual.operacoes.add(linha.operacaoId); atual.total = atual.total.plus(linha.valor); porTipo.set(linha.tipo, atual);
  }

  // Despesa efetiva: compras e serviços confirmados. Canceladas continuam
  // listadas nas linhas (quando escolhidas), mas não somam custo.
  const despesas = linhas.filter((linha) => TIPOS_DESPESA.includes(linha.tipo) && linha.status === "CONFIRMADA");
  const totais = { total: zero(), custeio: zero(), investimento: zero(), semClassificacao: zero() };
  const porCategoria = new Map<string, { nome: string; total: Prisma.Decimal; custeio: Prisma.Decimal; investimento: Prisma.Decimal; semClassificacao: Prisma.Decimal }>();
  // Agrupado pela chave (id), não pelo nome: um centro renomeado no meio do
  // período não pode virar duas linhas no relatório.
  const porCentro = new Map<string, { nome: string; total: Prisma.Decimal }>();
  for (const linha of despesas) {
    const chaveClassificacao = linha.classificacao === "CUSTEIO" ? "custeio" : linha.classificacao === "INVESTIMENTO" ? "investimento" : "semClassificacao";
    totais.total = totais.total.plus(linha.valor);
    totais[chaveClassificacao] = totais[chaveClassificacao].plus(linha.valor);
    const chave = `${linha.categoriaId ?? SEM_VINCULO}:${linha.categoria}`;
    const categoria = porCategoria.get(chave) ?? { nome: linha.categoria, total: zero(), custeio: zero(), investimento: zero(), semClassificacao: zero() };
    categoria.total = categoria.total.plus(linha.valor);
    categoria[chaveClassificacao] = categoria[chaveClassificacao].plus(linha.valor);
    porCategoria.set(chave, categoria);
    const centroId = linha.centroCustoId ?? SEM_VINCULO;
    const centro = porCentro.get(centroId) ?? { nome: linha.centroCusto, total: zero() };
    centro.total = centro.total.plus(linha.valor);
    porCentro.set(centroId, centro);
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
      porCentro: [...porCentro.values()].sort(desc).map((c) => ({ nome: c.nome, total: c.total.toFixed(2), pct: pct(c.total, totais.total) })),
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
