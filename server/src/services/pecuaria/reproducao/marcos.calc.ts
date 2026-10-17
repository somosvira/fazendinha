import { primeiraLiberacaoValidaIndicador,type DadosAcompanhamentoIndicadores } from "./acompanhamento-indicadores.calc.js";
type Marco={id:"PARTO"|"FIM_PEV"|"LIBERACAO"|"PRIMEIRO_SERVICO"|"DG_POSITIVO";rotulo:string;data:string|null;estado:"REALIZADO"|"PREVISTO"|"PENDENTE"|"DESCONHECIDO"};
/** O círculo resume marcos do ciclo factual atual; o positivo conserva esse ciclo. */
export function construirMarcosReprodutivos(dados:DadosAcompanhamentoIndicadores,animalId:string,estado:string,corte:string){
 const ciclo=dados.ciclos.filter(c=>c.animalId===animalId&&c.inicio<=corte).sort((a,b)=>b.inicio.localeCompare(a.inicio))[0];
 const liberacao=ciclo?primeiraLiberacaoValidaIndicador(ciclo,corte).primeira:null;
 const servicos=ciclo?.servicos.filter(s=>s.valido&&s.data<=corte).sort((a,b)=>a.data.localeCompare(b.data)||(a.ordem??0)-(b.ordem??0))??[];
 const gestacoes=dados.gestacoes.filter(g=>g.animalId===animalId&&g.valida&&g.primeiroDgPositivo&&g.primeiroDgPositivo.data<=corte&&(!ciclo||g.primeiroDgPositivo.data>=ciclo.inicio)).sort((a,b)=>a.primeiroDgPositivo!.data.localeCompare(b.primeiroDgPositivo!.data));
 const marco=(id:Marco["id"],rotulo:string,data:string|null,previsto=false):Marco=>({id,rotulo,data,estado:data?data>corte||previsto?"PREVISTO":"REALIZADO":"DESCONHECIDO"});
 const marcos:Marco[]=[marco("PARTO","Parto",ciclo?.partoEm??null),marco("FIM_PEV","Fim do PEV",ciclo?.fimPev??null),marco("LIBERACAO","Liberação",liberacao?.data??null),marco("PRIMEIRO_SERVICO","Primeiro serviço",servicos[0]?.data??null),marco("DG_POSITIVO","Primeiro DG positivo",gestacoes[0]?.primeiroDgPositivo?.data??null)];
 const eventos:Array<{id:string;data:string|null;titulo:string;detalhe?:string;pendente?:boolean}>=[];
 if(ciclo){eventos.push({id:ciclo.id,data:ciclo.inicio,titulo:ciclo.partoId?"Parto iniciou o ciclo":"Situação inicial do ciclo",detalhe:ciclo.partoId?"Início factual após parto":"Início informado no histórico"});
  if(ciclo.fimPev)eventos.push({id:`pev:${ciclo.id}`,data:ciclo.fimPev,titulo:"Fim do PEV",detalhe:"Data calculada pela política congelada do ciclo",pendente:ciclo.fimPev>corte});
  if(liberacao)eventos.push({id:`liberacao:${ciclo.id}`,data:liberacao.data,titulo:"Primeira liberação válida",detalhe:"Elegibilidade conferida no histórico dessa data"});
  for(const [i,s] of servicos.entries())eventos.push({id:s.id,data:s.data,titulo:`Serviço ${s.tipo}`,detalhe:`Tentativa ${i+1} do ciclo`});
  for(const r of ciclo.restricoes.filter(r=>r.inicio<=corte))eventos.push({id:r.id,data:r.inicio,titulo:`Restrição · ${r.efeito==="ALERTA"?"alerta":"bloqueio"}`,detalhe:r.fim?`Até ${r.fim}`:"Sem encerramento informado"});
 }
 for(const g of gestacoes){eventos.push({id:g.primeiroDgPositivo!.id,data:g.primeiroDgPositivo!.data,titulo:"DG positivo",detalhe:"Confirmação de gestação registrada"});if(g.encerramento&&g.encerramento.data<=corte)eventos.push({id:`fim:${g.id}`,data:g.encerramento.data,titulo:g.encerramento.tipo==="PERDA"?"Perda gestacional":g.encerramento.tipo==="PARTO"?"Gestação encerrada por parto":"Encerramento a esclarecer",detalhe:g.encerramento.explicacao??"Explicação histórica não informada"});}
 const pendencias:string[]=[];
 if(!ciclo)pendencias.push("Não há início de ciclo comprovado.");
 if(!liberacao)pendencias.push("Primeira liberação válida ainda não comprovada.");
 if(ciclo?.restricoes.some(r=>r.inicio<=corte&&(!r.fim||r.fim>corte)))pendencias.push("Há restrição vigente; confira o manejo antes de uma intervenção.");
 const intervalo=(a:string|null|undefined,b:string|null|undefined)=>a&&b&&b>=a?(new Date(b).getTime()-new Date(a).getTime())/86400000:null;
 return {estado,marcos,eventos:eventos.sort((a,b)=>(a.data??"").localeCompare(b.data??"")||a.id.localeCompare(b.id)),pendencias,intervalos:[{rotulo:"Liberação até primeiro serviço (dias corridos)",dias:intervalo(liberacao?.data,servicos[0]?.data)},{rotulo:"Parto até primeiro serviço",dias:intervalo(ciclo?.partoEm,servicos[0]?.data)},{rotulo:"Fim do PEV até primeiro serviço",dias:intervalo(ciclo?.fimPev,servicos[0]?.data)}]};
}
