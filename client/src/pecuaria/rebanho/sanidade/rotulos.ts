import type { AplicacaoSanitaria } from "./api";
import { formatarDataBR } from "../lib/rotulos";
import { UNIDADES, UNIDADES_ORDENADAS } from "../../../lib/unidades";

export const unidadeSanitaria = (valor: string | null | undefined) => {
  const unidade = UNIDADES_ORDENADAS.find((u) => u === valor?.toUpperCase());
  return unidade ? UNIDADES[unidade].rotulo : valor ?? "";
};

export const dataSanitaria = (valor: string | null | undefined) => valor ? formatarDataBR(valor) : "Não informado";
export const dataAplicacaoSanitaria = (a: Pick<AplicacaoSanitaria, "aplicadaEm" | "data">) => a.aplicadaEm ? dataHoraSanitaria(a.aplicadaEm) : `${dataSanitaria(a.data)} · horário não informado`;

export function dataHoraSanitaria(valor: string | null | undefined): string {
  if (!valor) return "Não informado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Não informado";
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.split("-").reverse().join("/");
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(data)
    + " às " + new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(data);
}

export const nomeAnimalSanitario = (animal: { brinco: string; nome: string | null }) => `${animal.brinco}${animal.nome ? ` · ${animal.nome}` : ""}`;
export function resultadoExameSanitario(exame: { formatoSnapshot: { tipoResultado: string; unidade?: string | null }; resultadoNumero: string | number | null; resultadoTexto: string | null; resultadoOpcao: string | null }): string {
  const formato = exame.formatoSnapshot;
  const valor = formato.tipoResultado === "NUMERO" ? exame.resultadoNumero : formato.tipoResultado === "OPCAO" ? exame.resultadoOpcao : exame.resultadoTexto;
  if (valor == null || valor === "") return "Aguardando resultado";
  if (formato.tipoResultado !== "NUMERO") return String(valor);
  const numero = Number(valor);
  return `${Number.isFinite(numero) ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 20 }).format(numero) : valor}${formato.unidade ? ` ${formato.unidade}` : ""}`;
}
export const tipoSanitario = (a: AplicacaoSanitaria) => a.tipoAplicacaoNomeSnapshot || (a.finalidade ? { TRATAMENTO: "Tratamento", VACINA: "Vacina", VERMIFUGO: "Vermífugo" }[a.finalidade] : "Aplicação");
export const origemSanitaria = (origem: string) => ({ INCLUSO_SERVICO: "Incluído em Serviço", BAIXA_ESTOQUE: "Estoque", COMPRA_CONSUMO_DIRETO: "Compra direta", SEM_ORIGEM_JUSTIFICADA: "Origem não localizada" }[origem] ?? "Não informado");
export const estadoSanitario = (estado: string) => ({ VALIDO: "Válida", ANULADO: "Anulada", INFORMADO: "Prazo informado", NAO_INFORMADO: "Não informado", NAO_APLICAVEL: "Não se aplica — confirmado", ATIVA: "Ativa", ENCERRADA: "Encerrada", EM_ANDAMENTO: "Em andamento", CANCELADO: "Cancelado", CONCLUIDO: "Concluído" }[estado] ?? estado);
