import { parametrosAcompanhamentoSchema, type ParametrosAcompanhamento } from "./acompanhamento.schemas.js";

export type PropostaAcompanhamento={finalidade:"DIAGNOSTICO"|"RECONFIRMACAO";ocorrencia:number;tentativaId:string|null;gestacaoId:string|null;dataReferencia:string;previstaPara:string;regraSnapshot:Record<string,unknown>};
const somar=(d:string,n:number)=>new Date(new Date(`${d}T00:00:00Z`).getTime()+n*86400000).toISOString().slice(0,10);
/** Sem datas clínicas padrão: toda previsão guarda os parâmetros escolhidos e a versão da política. */
export function proporAcompanhamentos(politica:{id:string;versao:number;parametros:ParametrosAcompanhamento},fato:{tentativaId?:string;gestacaoId?:string;tipoTentativa?:string;data:string}):PropostaAcompanhamento[]{
 const p=parametrosAcompanhamentoSchema.parse(politica.parametros);
 if(p.versao === 2) {
  if (!!fato.tentativaId === !!fato.gestacaoId) throw new Error("Acompanhamento exige uma única origem factual");
  const publico = fato.gestacaoId ? "GESTACAO" : fato.tipoTentativa;
  return p.regras.filter(r => r.publico === publico).sort((a,b) => a.ocorrencia-b.ocorrencia).map(r => ({
   finalidade:r.finalidade, ocorrencia:r.ocorrencia, tentativaId:fato.tentativaId??null, gestacaoId:fato.gestacaoId??null,
   dataReferencia:fato.data, previstaPara:somar(fato.data,r.intervalo),
   regraSnapshot:{...r,versao:2,politicaId:politica.id,politicaVersao:politica.versao,origem:"SITIO",efeito:"ALERTA",dataReferencia:fato.data},
  }));
 }
 const comum={versao:1,politicaId:politica.id,politicaVersao:politica.versao,efeito:"ALERTA",dataReferencia:fato.data};
 if(fato.tentativaId&&!fato.gestacaoId)return p.diagnostico?[{finalidade:"DIAGNOSTICO",ocorrencia:1,tentativaId:fato.tentativaId,gestacaoId:null,dataReferencia:fato.data,previstaPara:somar(fato.data,p.diagnostico.diasAposTentativa),regraSnapshot:{...comum,dias:p.diagnostico.diasAposTentativa,referencia:"TENTATIVA",tipoExameId:p.diagnostico.tipoExameId??null,tipoExameVersao:p.diagnostico.tipoExameVersao??null}}]:[];
 if(fato.gestacaoId&&!fato.tentativaId)return [...p.reconfirmacoes].sort((a,b)=>a.ocorrencia-b.ocorrencia).map(r=>({finalidade:"RECONFIRMACAO",ocorrencia:r.ocorrencia,tentativaId:null,gestacaoId:fato.gestacaoId!,dataReferencia:fato.data,previstaPara:somar(fato.data,r.diasAposPrimeiroPositivo),regraSnapshot:{...comum,dias:r.diasAposPrimeiroPositivo,referencia:"PRIMEIRO_DG_POSITIVO",ocorrencia:r.ocorrencia,tipoExameId:r.tipoExameId??null,tipoExameVersao:r.tipoExameVersao??null}}));
 throw new Error("Acompanhamento exige uma única origem factual");
}
export function identidadeDemandaAcompanhamento(d:Pick<PropostaAcompanhamento,"tentativaId"|"gestacaoId"|"finalidade"|"ocorrencia">){return `${d.tentativaId?`TENTATIVA:${d.tentativaId}`:`GESTACAO:${d.gestacaoId}`}:${d.finalidade}:${d.ocorrencia}`;}
