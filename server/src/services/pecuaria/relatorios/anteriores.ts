import {prisma} from '../../../db.js';
import {RebanhoError} from '../rebanho/regras.js';
import {consultarIndicadoresReprodutivos} from '../reproducao/indicadores.js';
import type {SnapshotIndicadoresReprodutivos} from '../reproducao/indicadores.calc.js';
import {emitirRelatorioPartos} from '../reproducao/relatorio-partos.js';
import {consultarOrdenhasPeriodo} from '../leite/consultas-ordenhas.js';
import {paginarRelatorio,type ConsultaRelatorio,type ResultadoRelatorio,type LinhaRelatorio} from './tipos.js';
type FonteAcompanhamento='iep'|'perdas'|'espera'|'concepcoes';
type AcompanhamentoIndicadores=NonNullable<SnapshotIndicadoresReprodutivos['acompanhamento']>;
type MedidaRelatorio={nome:string;valor:number|null;unidade?:string};
type LeituraAcompanhamento={linhas:LinhaRelatorio[];resumo:MedidaRelatorio[];avisos:string[]};
const fontes=new Set(['partos','tentativas','indicadores','ordenhas','iep','perdas','espera','concepcoes']);
/** Adapter de leitura: mantém a granularidade e as provas dos motores originais. */
export async function consultarRelatoriosAnteriores(q:ConsultaRelatorio):Promise<ResultadoRelatorio|null>{
 if(!fontes.has(q.fonte))return null;
 if(q.fonte==='partos'){
  const s=await emitirRelatorioPartos({propriedadeId:q.propriedadeId,inicio:q.inicio,fim:q.fim});
  return paginarRelatorio(s.partos.filter(p=>!q.animalId||p.matriz.id===q.animalId).map(p=>({id:p.id,animalId:p.matriz.id,matriz:`${p.matriz.brinco}${p.matriz.nome?` · ${p.matriz.nome}`:''}`,sitio:q.propriedadeId,data:p.data,desfecho:p.desfecho,tipo:p.tipo,crias:p.crias.length,vivas:p.crias.filter(c=>c.viva).length,semVida:p.crias.filter(c=>!c.viva).length,induzido:p.induzido,dificuldade:p.dificuldade,assistencia:p.assistenciaDescricao,placenta:p.retencaoPlacenta,colostro:p.crias.reduce((n,c)=>n+c.colostro.length,0),responsavel:p.responsavel,observacao:p.observacao,versao:p.versao,lancador:p.lancador?.nome??null})),q);
 }
 if(q.fonte==='tentativas'){
  // O sítio pertence ao fato. Inclui a identidade mesmo quando a matriz já saiu.
  const itens=await prisma.tentativaReprodutiva.findMany({where:{propriedadeId:q.propriedadeId,data:{gte:new Date(q.inicio),lte:new Date(q.fim)},...(q.animalId?{animalId:q.animalId}:{}),...(q.tiposTentativa?{tipo:{in:q.tiposTentativa}}:{})},select:{id:true,animalId:true,data:true,tipo:true,status:true,ciclo:true,ordem:true,origem:true,responsavel:true,observacao:true,Animal_TentativaReprodutiva_animalIdToAnimal:{select:{brinco:true,nome:true}}},orderBy:[{data:'desc'},{criadoEm:'desc'},{id:'asc'}],take:10001});
  if(itens.length>10000)throw new RebanhoError('VALIDACAO','Refine o período: limite de dez mil fatos; nenhum resultado foi truncado');
  return paginarRelatorio(itens.map(t=>({id:t.id,animalId:t.animalId,animal:`${t.Animal_TentativaReprodutiva_animalIdToAnimal.brinco}${t.Animal_TentativaReprodutiva_animalIdToAnimal.nome?` · ${t.Animal_TentativaReprodutiva_animalIdToAnimal.nome}`:''}`,data:t.data.toISOString().slice(0,10),tipo:t.tipo,situacao:t.status,ciclo:t.ciclo,ordem:t.ordem,origem:t.origem,responsavel:t.responsavel,observacao:t.observacao})),q);
 }
 if(q.fonte==='ordenhas'){
  const r=await consultarOrdenhasPeriodo(q.propriedadeId,{inicio:q.inicio,fim:q.fim,pagina:q.pagina,porPagina:q.porPagina});
  return {linhas:r.itens.map(p=>{const litros=(natureza:string)=>p.porNatureza.find(n=>n.natureza===natureza)?.litros??null;return {id:p.id,data:p.dataOperacional,turno:p.nome,situacao:p.situacao,fonte:p.fonteProducao,comercial:litros('COMERCIAL'),naocomercial:litros('NAO_COMERCIAL'),colostro:litros('COLOSTRO'),aclassificar:litros('A_CLASSIFICAR'),total:p.litros};}),total:r.total,pagina:r.pagina,porPagina:r.porPagina,paginado:true,consultadoEm:new Date().toISOString()};
 }
 const s=await consultarIndicadoresReprodutivos({propriedadeId:q.propriedadeId,inicio:q.inicio,fim:q.fim,corte:q.corte??q.fim,deslocamentoTeDias:q.deslocamentoTeDias??7,...(q.loteId?{loteId:q.loteId}:{}),...(q.tiposTentativa?{tiposTentativa:q.tiposTentativa}:{}),...(q.papeis?{papeis:q.papeis}:{}),...(q.concepcaoEstimada!==undefined?{concepcaoEstimada:q.concepcaoEstimada}:{}),...(q.janelaPerdaDias!==undefined?{janelaPerdaDias:q.janelaPerdaDias}:{}),...(q.iepModo?{iepModo:q.iepModo}:{})});
 if(q.fonte==='indicadores')return paginarRelatorio(s.periodos.map(p=>({id:p.id,inicio:p.inicio,fim:p.fim,servico:p.taxas.servico,concepcao:p.taxas.concepcao,prenhez:p.taxas.prenhez,elegiveis:p.contagens.elegiveis,servidas:p.contagens.matrizesServidas,tentativas:p.contagens.tentativas,positivas:p.contagens.positivas,negativas:p.contagens.negativas,abertas:p.contagens.abertas,denominador:p.contagens.denominadorConcepcao,pendencias:p.pendencias.join('; ')||null})),q);
 const leitura=prepararAcompanhamento(q.fonte as FonteAcompanhamento,s.acompanhamento);
 return {...paginarRelatorio(leitura.linhas.filter(l=>!q.animalId||l.animalId===q.animalId),q,leitura.avisos),resumo:leitura.resumo,resumoEscopo:'POPULACAO'};
}
const data=(v:string|null|undefined)=>v?v.slice(0,10):null;
const juntar=(v:string[])=>v.length?v.join('; '):null;
const rotulo=(v:string)=>v;
function prepararAcompanhamento(fonte:FonteAcompanhamento,d:AcompanhamentoIndicadores|undefined):LeituraAcompanhamento{
 if(!d||d.versao!==2)throw new Error('Esta resposta não contém o acompanhamento necessário. Atualize a consulta ou confira a versão do servidor.');
 const nomes=new Map(d.identificacoes?.map(a=>[a.id,`${a.brinco??'Sem brinco'}${a.nome?` · ${a.nome}`:''}`]));
 const animal=(id:string)=>({animal:nomes.get(id)??'Animal sem identificação preservada',animalId:id});
 const medida=(nome:string,valor:number|null,unidade?:string):MedidaRelatorio=>({nome,valor,unidade});
 const avisos:string[]=[];
 const exclusoes=d.exclusoesEscopo?.length??0;
 if(exclusoes)avisos.push(`${exclusoes} referências excluídas do acompanhamento por escopo histórico não comprovado.`);
 if(fonte==='iep')return {avisos,linhas:d.iep.pares.map(p=>({id:p.atualId,...animal(p.animalId),partoAnterior:data(p.anteriorEm),partoAtual:data(p.atualEm),intervalo:p.dias,abortos:p.abortosIntermediarios.length,anteriorId:p.anteriorId,atualId:p.atualId,abortosDetalhes:juntar(p.abortosIntermediarios.map(a=>`${data(a.data)}: ${a.id}`))})),resumo:[medida('Intervalo médio',d.iep.mediaDias,'dias'),medida('Pares de partos',d.iep.pares.length),medida('Sem parto anterior',d.iep.semAnterior.length),medida('Pendências',d.iep.pendencias.length)]};
 if(fonte==='espera')return {avisos,linhas:d.espera.coorte.map(c=>({id:c.cicloId,...animal(c.animalId),inicioCiclo:data(c.inicio),liberacao:data(c.primeiraLiberacao?.data),servico:data(c.primeiroServico?.data),tipoServico:c.primeiroServico?rotulo(c.primeiroServico.tipo):null,diasLiberacaoServico:c.diasLiberacaoServico,diasPartoServico:c.diasPartoServico,diasFimPevServico:c.diasFimPevServico,esperaObservada:c.diasEsperaObservada,esperaAte:data(c.esperaObservadaAte),repeticoes:c.repeticoes,saida:data(c.saidaEm),cicloId:c.cicloId,servicoId:c.primeiroServico?.id??null,restricoes:juntar(c.restricoesIntermediarias.map(r=>`${r.id}: ${data(r.inicio)} a ${data(r.fim)??'Em aberto'} (${rotulo(r.efeito)})`)),antecipacoes:juntar(c.antecipacoes.map(a=>`${a.referencia}: ${a.dias} dias; ${data(a.desde)} → ${data(a.servicoEm)}`)),pendencias:juntar(c.pendencias)})),resumo:[medida('Ciclos no período',d.espera.resumoCoorte.ciclos),medida('Com primeiro serviço',d.espera.resumoCoorte.comServico),medida('Sem primeiro serviço',d.espera.resumoCoorte.semServico),medida('Liberação → serviço',d.espera.resumoCoorte.mediaDiasLiberacaoServico,'dias')]};
 if(fonte==='perdas')return {avisos,linhas:d.perdas.coorte.map(g=>({id:g.gestacaoId,...animal(g.animalId),primeiroDg:data(g.primeiroDgPositivo?.data),situacao:rotulo(g.estado),fimJanela:data(g.fimJanela),desfecho:g.encerramento?rotulo(g.encerramento.tipo==='PERDA'?(g.encerramento.subtipo??g.encerramento.tipo):g.encerramento.tipo):null,dataDesfecho:data(g.encerramento?.data),explicacao:g.encerramento?.explicacao??null,gestacaoId:g.gestacaoId,dgId:g.primeiroDgPositivo?.id??null,desfechoId:g.encerramento?.fatoId??null,evidencias:juntar(g.evidenciaIds),lacunas:juntar(g.lacunas),pendencias:juntar(g.motivos)})),resumo:[medida('Gestações acompanhadas',d.perdas.contagens.gestacoes),medida('Perdas até o corte',d.perdas.contagens.perdasAteCorte),medida('Seguimento incompleto',d.perdas.contagens.incompletos),...(d.perdas.janelaDias==null?[]:[medida('Perdas na janela',d.perdas.percentual,'%')])]};
 if(d.tentativasPorConcepcao.estado!=='CALCULADO')throw new Error('O cálculo de tentativas por concepção não está disponível nesta resposta. Confira a metodologia na consulta de indicadores.');
 return {avisos,linhas:(d.tentativasPorConcepcao.linhas??[]).map(c=>({id:c.concepcaoId,...animal(c.animalId),servico:data(c.servicoEm),confirmacao:data(c.confirmadaEm),tentativas:c.numeroTentativas,tipos:juntar(c.tipos.map(rotulo)),concepcaoId:c.concepcaoId,tentativaId:c.tentativaId,tentativaIds:juntar(c.tentativaIds),evidencias:juntar(c.evidenciaIds),pendencias:juntar(c.pendencias)})),resumo:[medida('Concepções comprovadas',d.tentativasPorConcepcao.linhas?.length??0),medida('Média de tentativas',d.tentativasPorConcepcao.mediaTentativas??null),medida('Pendências',d.tentativasPorConcepcao.pendencias?.length??0)]};
}
