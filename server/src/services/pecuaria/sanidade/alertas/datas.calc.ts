import { idadeEmMeses } from "../../rebanho/categoria.calc.js";
export const diaCivil = (data: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
export const dataCivil = (data: string) => new Date(`${data}T00:00:00.000Z`);
export const somarDias = (data: Date, dias: number) => new Date(data.getTime() + dias * 86400000);
/** Primeira data que satisfaz meses completos, inclusive 31/01→01/03 e 29/02→01/03. */
export function alcanceIdade(nascimento: Date, meses: number): Date | null {
  if (!Number.isFinite(nascimento.getTime()) || !Number.isInteger(meses) || meses < 1) return null;
  let candidato = new Date(Date.UTC(nascimento.getUTCFullYear(), nascimento.getUTCMonth() + meses, nascimento.getUTCDate()));
  while (idadeEmMeses(nascimento, candidato) < meses) candidato = somarDias(candidato, 1);
  while (idadeEmMeses(nascimento, somarDias(candidato, -1)) >= meses) candidato = somarDias(candidato, -1);
  return candidato;
}
export function avaliarPrazo(input: { data: Date | null; hoje: Date; adocao: Date; antecedenciaDias: number; prazoDias: number }) {
  if (!input.data) return { situacao: "DADOS_INSUFICIENTES", visivel: true, prazo: null };
  if (input.data < input.adocao) return { situacao: "CONFERENCIA_INICIAL", visivel: true, prazo: null };
  if (input.hoje < somarDias(input.data, -input.antecedenciaDias)) return { situacao: "ACOMPANHAMENTO", visivel: false, prazo: somarDias(input.data, input.prazoDias) };
  return { situacao: input.hoje < input.data ? "PROXIMO" : "PENDENTE", visivel: true, prazo: somarDias(input.data, input.prazoDias) };
}

/** Projeção civil do prazo persistido, sem reescrever a decisão ou a evidência original. */
export function situacaoTemporal(input:{situacao:string;dataReferencia:Date|null;dataAtencao?:Date|null;prazo:Date|null},hoje:Date):string {
 const operacional=input.situacao==="ADIADO"?(input.dataAtencao??input.prazo):(input.dataAtencao??input.dataReferencia);
 if(["PROXIMO","PENDENTE","ADIADO"].includes(input.situacao)&&operacional&&operacional<=hoje)return input.prazo&&input.prazo<hoje?"ATRASADO":"PENDENTE";
 return input.situacao;
}
