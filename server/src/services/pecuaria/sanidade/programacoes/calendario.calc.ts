/** Datas civis da programação. Limites mensais são janelas, nunca aplicação prevista no dia 1. */
export interface CalendarioProgramacao {
  id: string; meses: number[]; ano: number | null; vigenciaInicio: Date | null; vigenciaFim: Date | null;
  precisao: string; dia: number | null; recorrencia: string;
}
export interface JanelaProgramacao {
  id: string; programacaoId: string; ano: number; mes: number; precisao: "MES" | "DIA";
  dia: number | null; inicioJanela: string; fimJanela: string; periodo: string;
}
const civil = (ano: number, mes: number, dia: number) => `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
export const dataCivilProgramacao = (data: Date) => data.toISOString().slice(0, 10);
export function janelaProgramacao(p: CalendarioProgramacao, ano: number, mes: number): JanelaProgramacao | null {
  if (!Number.isInteger(ano) || ano < 1 || ano > 9999 || !Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error("Ano ou mês inválido");
  if (!p.meses.includes(mes) || (p.ano != null && p.ano !== ano)) return null;
  const ultimoDia = new Date(Date.UTC(ano < 100 ? ano + 400 : ano, mes, 0)).getUTCDate();
  if (p.precisao === "DIA" && (p.dia == null || p.dia < 1 || p.dia > ultimoDia)) return null;
  const inicio = civil(ano, mes, p.precisao === "DIA" ? p.dia! : 1);
  const fim = civil(ano, mes, p.precisao === "DIA" ? p.dia! : ultimoDia);
  const vigenciaInicio = p.vigenciaInicio && dataCivilProgramacao(p.vigenciaInicio);
  const vigenciaFim = p.vigenciaFim && dataCivilProgramacao(p.vigenciaFim);
  if ((vigenciaInicio && fim < vigenciaInicio) || (vigenciaFim && inicio > vigenciaFim)) return null;
  const periodo = p.recorrencia === "CAMPANHA_ANUAL" ? `CAMPANHA:${ano}-${String(mes).padStart(2, "0")}` : p.recorrencia === "JANELA_ELEGIBILIDADE" ? "ELEGIBILIDADE" : "UNICA";
  return { id: `${p.id}:${ano}-${String(mes).padStart(2, "0")}`, programacaoId: p.id, ano, mes, precisao: p.precisao === "DIA" ? "DIA" : "MES", dia: p.precisao === "DIA" ? p.dia : null,
    inicioJanela: vigenciaInicio && vigenciaInicio > inicio ? vigenciaInicio : inicio,
    fimJanela: vigenciaFim && vigenciaFim < fim ? vigenciaFim : fim, periodo };
}
export function chaveNecessidadeProgramacao(programacaoId: string, periodo: string, sujeitoTipo: string, sujeitoId: string) {
  return JSON.stringify([programacaoId, periodo, sujeitoTipo, sujeitoId]);
}
