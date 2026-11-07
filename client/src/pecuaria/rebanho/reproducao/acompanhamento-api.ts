import { reqV4 } from "./api";
export type RegraAcompanhamentoV2 = {
 finalidade: "DIAGNOSTICO" | "RECONFIRMACAO"; ocorrencia: number;
 publico: "IA" | "TE" | "COBERTURA" | "GESTACAO"; referencia: "IA" | "TE" | "COBERTURA" | "PRIMEIRO_DG_POSITIVO";
 intervalo: number; unidade: "DIAS"; antecedencia: number; tolerancia: number;
 resolucao: "DIAGNOSTICO_CONCLUSIVO" | "RECONFIRMACAO_CONCLUSIVA"; tipoExameId?: string; tipoExameVersao?: number;
};
export type ConfiguracaoAcompanhamentoV2 = { versao: 2; efeito: "ALERTA"; regras: RegraAcompanhamentoV2[] };
export type ConfiguracaoAcompanhamentoV1 = { versao: 1; efeito: "ALERTA"; diagnostico: { diasAposTentativa: number; tipoExameId?: string; tipoExameVersao?: number } | null; reconfirmacoes: Array<{ ocorrencia:number; diasAposPrimeiroPositivo:number; tipoExameId?:string; tipoExameVersao?:number }> };
export type PoliticaAcompanhamento = { id:string; versao:number; vigenteDesde:string; parametros:ConfiguracaoAcompanhamentoV1 | ConfiguracaoAcompanhamentoV2 };
export type DemandaRevisavel = {id:string;animalId:string;finalidade:string;previstaPara:string|null;origemAdocao:string;versao:number};
export type PreviaRevisao = {revisao:string;propostas:Array<{demandaId:string;animalId:string;versao:number;previstaAnterior:string|null;proposta:{previstaPara:string}|null;impedimento:string|null}>};
export const listarPoliticasAcompanhamento=(id:number)=>reqV4<PoliticaAcompanhamento[]>("/reproducao/acompanhamento/politicas",undefined,"GET",id);
export function validarConfiguracaoAcompanhamento(v:ConfiguracaoAcompanhamentoV2|null): string|null {
 if(!v?.regras.length)return "Configure ao menos um acompanhamento.";
 if(v.regras.some(r=>[r.intervalo,r.antecedencia,r.tolerancia].some(n=>!Number.isInteger(n)||n<0||n>1000)))return "Informe intervalo, antecedência e tolerância em dias inteiros entre 0 e 1000.";
 if(new Set(v.regras.map(r=>`${r.publico}:${r.finalidade}:${r.ocorrencia}`)).size!==v.regras.length)return "Não repita o público e a ocorrência do acompanhamento.";
 return null;
}

export type DemandaAcompanhamento = { id: string; tarefaId?: string | null; finalidade: "DIAGNOSTICO" | "RECONFIRMACAO" | "SEXAGEM"; ocorrencia: number; tentativaId: string | null; gestacaoId: string | null; previstaPara: string | null; estado: string; motivoEncerramento: string | null; regraSnapshot: { politicaVersao?: number; tipoExameId?: string | null; tipoExameVersao?: number | null }; exameResolucaoId: string | null; pendencias?: string[] };
export type ResumoAcompanhamentos = { total: number; pendentes: number; resolvidas: number; encerradas: number; semData: number };
export type PaginaAcompanhamentos = { itens: DemandaAcompanhamento[]; total: number; pagina: number; porPagina: number; resumo: ResumoAcompanhamentos };
export function listarDemandasAcompanhamento(propriedadeId: number, animalId: string, pagina = 1, estado = "", finalidade = "", porPagina = 10) {
  const q = new URLSearchParams({ animalId, pagina: String(pagina), porPagina: String(porPagina) });
  if (estado) q.set("estado", estado);
  if (finalidade) q.set("finalidade", finalidade);
  return reqV4<PaginaAcompanhamentos>(`/reproducao/acompanhamento?${q}`, undefined, "GET", propriedadeId);
}
