/* Configuração de relatório financeiro — regras puras do formulário.
 * Espelha `server/src/services/financeiro/relatorios.schemas.ts`. */
import { getHoje } from "../../lib/hoje";
import { SEM_VINCULO } from "../../lib/ids";
import type { ConfiguracaoRelatorioFinanceiro, RegimeRelatorioFinanceiro, SnapshotRelatorioFinanceiro } from "../novo-api";
import type { OperacaoPorTipo, ResultadoAtividade } from "../../components/relatorio-gerencial/types";

export const LIMITE_MESES = 24;

// Transferência financeira não compõe relatório (só redistribui saldo).
export const TIPOS_RELATORIO = [
  "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
  "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
] as const;
// Operação nasce confirmada e só pode ser cancelada — não existe "rascunho".
export const STATUS_RELATORIO: readonly (readonly [string, string])[] = [["CONFIRMADA", "Confirmada"], ["CANCELADA", "Cancelada"]];
export const REGIMES_RELATORIO: readonly { id: RegimeRelatorioFinanceiro; rotulo: string; dica: string }[] = [
  { id: "ambos", rotulo: "Realizado + compromissos", dica: "Pagamentos e recebimentos do período e compromissos em aberto." },
  { id: "realizado", rotulo: "Só realizado", dica: "Apenas o que passou pelas contas (regime de caixa)." },
  { id: "previsto", rotulo: "Só compromissos", dica: "Apenas títulos em aberto que vencem no período." },
];
export const SEM_CENTRO = "Sem centro de custo";
export const SEM_CATEGORIA = "Sem categoria";
export const SEM_GRUPO = "Sem grupo";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");
export const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dataCurta = (iso: string) => iso ? iso.split("-").reverse().join("/") : "—";

export function periodoMes(referencia: Date, deslocamento = 0) {
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth() + deslocamento, 1);
  const fim = new Date(referencia.getFullYear(), referencia.getMonth() + deslocamento + 1, 0);
  return { dataInicio: isoLocal(inicio), dataFim: isoLocal(fim), nome: `${MESES[inicio.getMonth()]}/${inicio.getFullYear()}` };
}

/** Padrão: mês fechado anterior, como o relatório gerencial. */
export function configuracaoPadrao(hoje: Date = getHoje()): ConfiguracaoRelatorioFinanceiro {
  const mes = periodoMes(hoje, -1);
  return {
    nome: `Relatório financeiro — ${mes.nome}`, dataInicio: mes.dataInicio, dataFim: mes.dataFim, regime: "ambos",
    tipos: [], status: ["CONFIRMADA"], centroCustoIds: [], categoriaIds: [], grupoIds: [],
    parceiroIds: [],
  };
}

const lista = <T,>(valor: unknown, validos?: readonly T[]) => Array.isArray(valor) ? valor.filter((item): item is T => validos ? validos.includes(item as T) : typeof item === "string") : null;

/** Rascunho salvo pode estar incompleto ou vir de uma versão anterior do formulário. */
export function mesclarRascunho(parcial: Partial<ConfiguracaoRelatorioFinanceiro> | null | undefined, base: ConfiguracaoRelatorioFinanceiro = configuracaoPadrao()): ConfiguracaoRelatorioFinanceiro {
  if (!parcial) return base;
  const texto = (valor: unknown, padrao: string) => typeof valor === "string" ? valor : padrao;
  return {
    nome: texto(parcial.nome, base.nome),
    dataInicio: texto(parcial.dataInicio, base.dataInicio),
    dataFim: texto(parcial.dataFim, base.dataFim),
    regime: REGIMES_RELATORIO.some((r) => r.id === parcial.regime) ? parcial.regime! : base.regime,
    tipos: lista<string>(parcial.tipos, TIPOS_RELATORIO) ?? base.tipos,
    status: lista<string>(parcial.status, STATUS_RELATORIO.map(([id]) => id)) ?? base.status,
    centroCustoIds: lista<string>(parcial.centroCustoIds) ?? base.centroCustoIds,
    parceiroIds: lista<string>(parcial.parceiroIds) ?? base.parceiroIds,
    categoriaIds: lista<string>(parcial.categoriaIds) ?? base.categoriaIds,
    grupoIds: lista<string>(parcial.grupoIds) ?? base.grupoIds,
  };
}

const mesesEntre = (inicio: string, fim: string) => {
  const [ai, mi] = inicio.split("-").map(Number);
  const [af, mf] = fim.split("-").map(Number);
  return (af - ai) * 12 + (mf - mi) + 1;
};

export function erroPeriodo(config: Pick<ConfiguracaoRelatorioFinanceiro, "dataInicio" | "dataFim">): string | null {
  if (!config.dataInicio || !config.dataFim) return "Informe as datas inicial e final.";
  if (config.dataInicio > config.dataFim) return "A data final não pode ser anterior à inicial.";
  if (mesesEntre(config.dataInicio, config.dataFim) > LIMITE_MESES) return `O período máximo é de ${LIMITE_MESES} meses.`;
  return null;
}

export const podeGerar = (config: ConfiguracaoRelatorioFinanceiro) => !!config.nome.trim() && !erroPeriodo(config);

export const alternar = <T,>(itens: T[], valor: T) => itens.includes(valor) ? itens.filter((item) => item !== valor) : [...itens, valor];

type Cadastro = { id: string; nome: string };
const nomes = (ids: string[], cadastros: Cadastro[], vazio: string) => ids.map((id) => id === SEM_VINCULO ? vazio : cadastros.find((c) => c.id === id)?.nome ?? "(removido)");
const ou = (itens: string[], todos: string) => itens.length ? itens.join(", ") : todos;

export function resumoConfiguracao(config: ConfiguracaoRelatorioFinanceiro, cadastros: { categorias: Cadastro[]; centrosCusto: Cadastro[]; parceiros: Cadastro[]; grupos: Cadastro[]; tipos: Record<string, string> }): [string, string][] {
  return [
    ["Período", `${dataCurta(config.dataInicio)} a ${dataCurta(config.dataFim)}`],
    ["Leitura", REGIMES_RELATORIO.find((r) => r.id === config.regime)?.rotulo ?? config.regime],
    ["Tipos", ou(config.tipos.map((tipo) => cadastros.tipos[tipo] ?? tipo), "Todos os tipos")],
    ["Situação", ou(config.status.map((status) => STATUS_RELATORIO.find(([id]) => id === status)?.[1] ?? status), "Confirmadas e canceladas")],
    ["Centros de custo", ou(nomes(config.centroCustoIds, cadastros.centrosCusto, SEM_CENTRO), "Todos os centros")],
    ["Parceiros", ou(nomes(config.parceiroIds, cadastros.parceiros, "Sem parceiro"), "Todos os parceiros")],
    ["Categorias", ou(nomes(config.categoriaIds, cadastros.categorias, SEM_CATEGORIA), "Todas as categorias")],
    ["Grupos de categorias", ou(nomes(config.grupoIds, cadastros.grupos, SEM_GRUPO), "Todos os grupos")],
  ];
}

/** Blocos que o documento terá, conforme a leitura escolhida. */
export function secoesDoRelatorio(config: Pick<ConfiguracaoRelatorioFinanceiro, "regime" | "centroCustoIds" | "parceiroIds" | "categoriaIds" | "grupoIds" | "tipos" | "status">): string[] {
  const filtrado = [config.tipos, config.status, config.centroCustoIds, config.parceiroIds, config.categoriaIds, config.grupoIds].some((itens) => itens.length > 0);
  const realizado = config.regime !== "previsto";
  const previsto = config.regime !== "realizado";
  return [
    "Compras e serviços por grupo de categorias e por categoria",
    "Compras e serviços por centro de custo",
    ...(realizado ? ["Pagamentos por categoria e por centro de custo", "Resultado do caixa por natureza"] : []),
    "Operações por tipo",
    ...(previsto ? ["Compromissos a pagar e a receber em aberto"] : []),
    ...(realizado ? [filtrado ? "Saldo das contas (sempre sem filtros)" : "Saldo das contas"] : []),
    "Itens das operações com categoria e centro de custo",
    "Rastreabilidade",
  ];
}

const ROTULO_CLASSIFICACAO_ANTIGA: Record<string, string> = { CUSTEIO: "Custeio", INVESTIMENTO: "Investimento", SEM_CLASSIFICACAO: "Não classificada" };
const somaReais = (...valores: (string | number | undefined)[]) => valores.reduce<number>((total, valor) => total + Number(valor ?? 0), 0);

/** Relatórios emitidos antes da retirada da classificação (formato 1) separavam
 * custeio × investimento. A leitura apresenta essa separação como grupos, sem
 * recalcular nada: os totais continuam os da emissão. */
export function normalizarSnapshot(bruto: SnapshotRelatorioFinanceiro | (Record<string, unknown> & { versao: 1 })): SnapshotRelatorioFinanceiro {
  if (bruto.versao !== 1) return bruto as SnapshotRelatorioFinanceiro;
  // Formato 1 não tem mais tipo próprio: só é lido aqui.
  const antigo = bruto as any;
  const despesas = antigo.composicao.despesas;
  const total = Number(despesas.total) || 0;
  const pct = (valor: number) => total === 0 ? 0 : Math.round((valor / total) * 10000) / 100;
  const porGrupo = ([["custeio", "CUSTEIO"], ["investimento", "INVESTIMENTO"], ["semClassificacao", "SEM_CLASSIFICACAO"]] as const)
    .map(([chave, classificacao]) => ({ nome: ROTULO_CLASSIFICACAO_ANTIGA[classificacao], valor: Number(despesas[chave] ?? 0) }))
    .filter((grupo) => grupo.valor !== 0)
    .map((grupo) => ({ nome: grupo.nome, total: grupo.valor.toFixed(2), pct: pct(grupo.valor) }));
  const gerencial = antigo.gerencial;
  const operacoes: OperacaoPorTipo[] = [];
  for (const operacao of gerencial.operacoes ?? []) {
    if (operacao.tipo !== "custeio" && operacao.tipo !== "investimento") { operacoes.push(operacao); continue; }
    const despesa = operacoes.find((item) => item.tipo === "despesa");
    if (despesa) { despesa.quantidade += operacao.quantidade; despesa.valor = somaReais(despesa.valor, operacao.valor); }
    else operacoes.push({ ...operacao, tipo: "despesa" });
  }
  return {
    ...antigo,
    versao: 2,
    configuracao: { ...antigo.configuracao, grupoIds: antigo.configuracao.grupoIds ?? [] },
    filtros: { ...antigo.filtros, grupos: (antigo.filtros.classificacoes ?? []) as string[] },
    gerencial: {
      ...gerencial,
      operacoes,
      resultado: gerencial.resultado && {
        receita: gerencial.resultado.receita,
        despesa: somaReais(gerencial.resultado.custeio, gerencial.resultado.investimento),
        resultado: gerencial.resultado.resultado,
        porAtividade: gerencial.resultado.porAtividade.map((a: ResultadoAtividade & { custeio: number; investimento: number }) => ({
          atividade: a.atividade, receita: a.receita, despesa: somaReais(a.custeio, a.investimento), resultado: a.resultado,
        })),
      },
    },
    composicao: {
      ...antigo.composicao,
      linhas: antigo.composicao.linhas.map(({ classificacao, ...linha }: { classificacao: string | null }) => ({ ...linha, grupo: ROTULO_CLASSIFICACAO_ANTIGA[classificacao ?? "SEM_CLASSIFICACAO"] })),
      despesas: {
        total: despesas.total, porGrupo, porCentro: despesas.porCentro,
        porCategoria: despesas.porCategoria.map(({ nome, total: totalCategoria, pct: pctCategoria }: { nome: string; total: string; pct: number }) => ({ nome, total: totalCategoria, pct: pctCategoria })),
      },
    },
  };
}
