/* Configuração de relatório financeiro — regras puras do formulário.
 * Espelha `server/src/services/financeiro/relatorios.schemas.ts`. */
import { getHoje } from "../../lib/hoje";
import type { ClassificacaoRelatorio, ConfiguracaoRelatorioFinanceiro, RegimeRelatorioFinanceiro } from "../novo-api";

export const LIMITE_MESES = 24;

// Transferência financeira não compõe relatório (só redistribui saldo).
export const TIPOS_RELATORIO = [
  "COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO", "VENDA", "APORTE", "RETIRADA",
  "AJUSTE_ESTOQUE", "TRANSFERENCIA_ESTOQUE", "INVENTARIO_INICIAL", "BONIFICACAO", "DEVOLUCAO", "PRODUCAO",
] as const;
// Operação nasce confirmada e só pode ser cancelada — não existe "rascunho".
export const STATUS_RELATORIO: readonly (readonly [string, string])[] = [["CONFIRMADA", "Confirmada"], ["CANCELADA", "Cancelada"]];
export const CLASSIFICACOES_RELATORIO: readonly (readonly [ClassificacaoRelatorio, string])[] = [["CUSTEIO", "Custeio"], ["INVESTIMENTO", "Investimento"], ["SEM_CLASSIFICACAO", "Não classificada"]];
export const REGIMES_RELATORIO: readonly { id: RegimeRelatorioFinanceiro; rotulo: string; dica: string }[] = [
  { id: "ambos", rotulo: "Realizado + compromissos", dica: "Pagamentos e recebimentos do período e compromissos em aberto." },
  { id: "realizado", rotulo: "Só realizado", dica: "Apenas o que passou pelas contas (regime de caixa)." },
  { id: "previsto", rotulo: "Só compromissos", dica: "Apenas títulos em aberto que vencem no período." },
];
export const SEM_CENTRO = "Sem centro de custo";
export const SEM_CATEGORIA = "Sem categoria";

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
    tipos: [], status: ["CONFIRMADA"], centroCustoIds: [], categoriaIds: [], classificacoes: [],
    parceiroIds: [],
  };
}

const lista = <T,>(valor: unknown, validos?: readonly T[]) => Array.isArray(valor) ? valor.filter((item): item is T => validos ? validos.includes(item as T) : typeof item === "number") : null;

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
    centroCustoIds: lista<number>(parcial.centroCustoIds) ?? base.centroCustoIds,
    parceiroIds: lista<number>(parcial.parceiroIds) ?? base.parceiroIds,
    categoriaIds: lista<number>(parcial.categoriaIds) ?? base.categoriaIds,
    classificacoes: lista<ClassificacaoRelatorio>(parcial.classificacoes, CLASSIFICACOES_RELATORIO.map(([id]) => id)) ?? base.classificacoes,
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

type Cadastro = { id: number; nome: string };
const nomes = (ids: number[], cadastros: Cadastro[], vazio: string) => ids.map((id) => id === 0 ? vazio : cadastros.find((c) => c.id === id)?.nome ?? `#${id}`);
const ou = (itens: string[], todos: string) => itens.length ? itens.join(", ") : todos;

export function resumoConfiguracao(config: ConfiguracaoRelatorioFinanceiro, cadastros: { categorias: Cadastro[]; centrosCusto: Cadastro[]; parceiros: Cadastro[]; tipos: Record<string, string> }): [string, string][] {
  return [
    ["Período", `${dataCurta(config.dataInicio)} a ${dataCurta(config.dataFim)}`],
    ["Leitura", REGIMES_RELATORIO.find((r) => r.id === config.regime)?.rotulo ?? config.regime],
    ["Tipos", ou(config.tipos.map((tipo) => cadastros.tipos[tipo] ?? tipo), "Todos os tipos")],
    ["Situação", ou(config.status.map((status) => STATUS_RELATORIO.find(([id]) => id === status)?.[1] ?? status), "Confirmadas e canceladas")],
    ["Centros de custo", ou(nomes(config.centroCustoIds, cadastros.centrosCusto, SEM_CENTRO), "Todos os centros")],
    ["Parceiros", ou(nomes(config.parceiroIds, cadastros.parceiros, "Sem parceiro"), "Todos os parceiros")],
    ["Categorias", ou(nomes(config.categoriaIds, cadastros.categorias, SEM_CATEGORIA), "Todas as categorias")],
    ["Classificação", ou(config.classificacoes.map((c) => CLASSIFICACOES_RELATORIO.find(([id]) => id === c)?.[1] ?? c), "Custeio, investimento e não classificadas")],
  ];
}

/** Blocos que o documento terá, conforme a leitura escolhida. */
export function secoesDoRelatorio(config: Pick<ConfiguracaoRelatorioFinanceiro, "regime" | "centroCustoIds" | "parceiroIds" | "categoriaIds" | "classificacoes" | "tipos" | "status">): string[] {
  const filtrado = [config.tipos, config.status, config.centroCustoIds, config.parceiroIds, config.categoriaIds, config.classificacoes].some((itens) => itens.length > 0);
  const realizado = config.regime !== "previsto";
  const previsto = config.regime !== "realizado";
  return [
    "Compras e serviços por categoria (custeio × investimento)",
    "Compras e serviços por centro de custo",
    ...(realizado ? ["Pagamentos por categoria e por centro de custo", "Resultado do caixa por natureza"] : []),
    "Operações por tipo",
    ...(previsto ? ["Compromissos a pagar e a receber em aberto"] : []),
    ...(realizado ? [filtrado ? "Saldo das contas (sempre sem filtros)" : "Saldo das contas"] : []),
    "Itens das operações com categoria e centro de custo",
    "Rastreabilidade",
  ];
}
