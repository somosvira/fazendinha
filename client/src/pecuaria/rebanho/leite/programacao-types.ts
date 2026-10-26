export type TipoProgramacao =
  | "DIARIA"
  | "SEMANAL"
  | "DIAS_ESCOLHIDOS"
  | "META_LITROS";
export interface ProgramacaoDTO {
  id: string;
  propriedadeId: number;
  vigenteDesde: string;
  tipo: TipoProgramacao;
  diaSemana: number | null;
  diasSemana: number[];
  produtoId: string | null;
  metaLitros: string | null;
  versao: number;
  criadoPorId: number | null;
  criadoEm: string;
}
export interface ConsultaProgramacaoDTO {
  propriedadeId: number;
  dataReferencia: string;
  versaoAtual: number;
  vigente: ProgramacaoDTO | null;
  historico: ProgramacaoDTO[];
  previsoes: { data: string; programacaoId: string; tipo: TipoProgramacao }[];
  meta: {
    estado: "ATINGIDA" | "ABAIXO_DA_META" | "NAO_AFERIVEL";
    saldoLitros: string | null;
    metaLitros: string;
    motivo: string | null;
  } | null;
}
export const diasSemana = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
export function nomeProgramacao(p: ProgramacaoDTO) {
  return p.tipo === "DIARIA"
    ? "Diária"
    : p.tipo === "SEMANAL"
      ? `Semanal · ${diasSemana[p.diaSemana ?? 0]}`
      : p.tipo === "DIAS_ESCOLHIDOS"
        ? p.diasSemana.map((d) => diasSemana[d]).join(", ")
        : `Meta de ${Number(p.metaLitros).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L`;
}
