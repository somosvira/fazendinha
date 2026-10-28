import {Prisma} from '@prisma/client';
import {prisma} from '../../../db.js';
import {RebanhoError} from '../rebanho/regras.js';
import {carenciaAnimal} from '../sanidade/aplicacoes.js';
import {consultarResumoEstoqueLeite} from '../leite/resumo-estoque.js';
import {consultarColetasOperacoesLeite} from '../leite/comercial.consultas-operacionais.js';
import {consultarVendasUnificadasLeite} from '../leite/vendas-unificadas.js';
import {paginarRelatorio,type ConsultaRelatorio,type ResultadoRelatorio,type LinhaRelatorio,type CelulaRelatorio} from './tipos.js';
const fontes=new Set(['ocorrencias','aplicacoes','exames','carencias','qualidade','coletas','vendas','estoque','destinos','descartes','retiradas']);
const data=(d:Date|null)=>d?.toISOString().slice(0,10)??null;
const objeto=(v:Prisma.JsonValue|null):Prisma.JsonObject=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
/** Cada observação conserva a identidade do campo; nunca agrega formatos distintos. */
export function observacoesRelatorio(formato:Prisma.JsonValue|null,resultados:{campo:string;valor:Prisma.JsonValue;unidade:string|null}[]):LinhaRelatorio[]{
 const f=objeto(formato),campos=Array.isArray(f.campos)?f.campos.map(objeto):[];
 const base={formato:typeof f.nome==='string'?f.nome:null,versaoFormato:typeof f.versao==='number'?f.versao:typeof f.versaoFormato==='number'?f.versaoFormato:null};
 if(!resultados.length)return [{...base,campo:null,parametro:null,unidade:null,resultado:null,situacaoResultado:'PENDENTE'}];
 return resultados.map(r=>{const c=campos.find(c=>c.codigo===r.campo);const valor:CelulaRelatorio=typeof r.valor==='string'||typeof r.valor==='number'||typeof r.valor==='boolean'?r.valor:null;return {...base,campo:r.campo,parametro:typeof c?.rotulo==='string'?c.rotulo:r.campo,unidade:r.unidade??(typeof c?.unidade==='string'?c.unidade:null),resultado:valor,situacaoResultado:valor===null?'PENDENTE':'INFORMADO'};});
}
function conferirLimite(linhas:unknown[]){if(linhas.length>10000)throw new RebanhoError('VALIDACAO','Refine o período: limite de dez mil fatos; nenhum resultado foi truncado');}
function pagina(q:ConsultaRelatorio,itens:LinhaRelatorio[],total:number):ResultadoRelatorio{return {linhas:itens,total,pagina:q.pagina,porPagina:q.porPagina,paginado:true,consultadoEm:new Date().toISOString()};}
export async function consultarRelatoriosSanidadeLeite(q:ConsultaRelatorio):Promise<ResultadoRelatorio|null>{
 if(!fontes.has(q.fonte))return null;
 const periodo={gte:new Date(q.inicio+'T00:00:00Z'),lte:new Date(q.fim+'T00:00:00Z')};
 const where={propriedadeId:q.propriedadeId,data:periodo,...(q.animalId?{animalId:q.animalId}:{})};
 const ordem=[{data:'desc' as const},{id:'asc' as const}];
 const f={de:q.inicio,ate:q.fim,pagina:q.pagina,porPagina:q.porPagina};
 if(q.fonte==='carencias'){
  if(!q.animalId)throw new RebanhoError('VALIDACAO','Selecione o animal para consultar carências');
  const c=await carenciaAnimal(q.animalId,q.propriedadeId,q.fim);
  const animal=await prisma.animal.findUnique({where:{id:q.animalId},select:{brinco:true,nome:true}});
  const identificacao=animal?`${animal.brinco}${animal.nome?` · ${animal.nome}`:''}`:q.animalId;
  const linhas=(['leite','carne'] as const).map(destino=>{const p=c[destino];return {animal:identificacao,data:q.fim,destino,estado:p.estado,ate:p.estado==='CONHECIDO'?data(p.ate):null,prazoZero:p.estado==='CONHECIDO'?p.prazoZero??false:null,aproximado:p.estado==='CONHECIDO'?p.precisaoAproximada:null,revisaoLeite:c.revisaoLeitePendente,revisaoAdministracao:c.revisaoAdministracaoPendente};});
  return paginarRelatorio(linhas,q,['A referência seleciona doses até a data; acesso pelo sítio atual. Não representa liberação clínica.']);
 }
 if(q.fonte==='estoque'){
  const r=await consultarResumoEstoqueLeite(q.propriedadeId,{pagina:q.pagina,porPagina:q.porPagina},q.podeVerValores&&q.podeConsultarCustos);
  return {...pagina(q,r.itens.map(i=>({produto:i.nome,produtoId:i.produtoId,litros:i.quantidadeLitros,confiavel:i.confiavel,motivo:i.motivoNaoAferivel,comercial:i.comercial.quantidadeLitros,naoComercial:i.descarteLitros,colostro:i.colostroLitros,classificacaoPendente:i.classificacaoPendenteLitros,custoPendente:i.custoPendenteLitros,estadoValor:i.estadoValor,valor:i.valorTotal})),r.total),avisos:['Posição atual por produto com lastro nas origens; o intervalo não reconstrói saldo histórico. Não comercial não representa descarte físico.']};
 }
 if(q.fonte==='coletas'){
  const r=await consultarColetasOperacoesLeite(q.propriedadeId,f);return pagina(q,r.itens.map(i=>({id:i.id,data:i.data,produto:i.produtoNome,litros:i.quantidadeLitros,comprador:i.parceiroNome,situacao:i.situacao,referencia:i.referencia,pontoColeta:i.pontoColeta,horario:i.horarioColeta,inicio:i.inicio,fim:i.fim})),r.total);
 }
 if(q.fonte==='vendas'){
  const r=await consultarVendasUnificadasLeite(q.propriedadeId,f,q.podeVerValores);return {...pagina(q,r.itens.map(i=>({id:i.id,data:i.data,inicio:i.inicio,fim:i.fim,modalidade:i.modalidade,comprador:i.parceiroNome,referencia:i.referencia,litros:i.quantidadeLitros,valor:i.valorTotal,situacao:i.situacao,versao:i.versaoComercial})),r.total),avisos:['Venda por período usa sobreposição comercial; litros e valor não representam recebimento financeiro.']};
 }
 if(q.fonte==='ocorrencias'){
  const itens=await prisma.ocorrenciaSanitaria.findMany({where:{propriedadeId:q.propriedadeId,inicio:periodo,...(q.animalId?{animalId:q.animalId}:{})},include:{animal:{select:{brinco:true}},doenca:{select:{nome:true}}},orderBy:[{inicio:'desc'},{id:'asc'}],take:10001});conferirLimite(itens);
  return paginarRelatorio(itens.map(i=>({id:i.id,animal:i.animal.brinco,data:data(i.inicio),fim:data(i.fim),doenca:i.doencaNomeSnapshot??i.doenca.nome,situacao:i.status==='ANULADO'?'ANULADA':i.fim?'ENCERRADA':'ABERTA',desfecho:i.desfecho,origem:i.origem,observacao:i.observacao})),q);
 }
 if(q.fonte==='aplicacoes'){
  const itens=await prisma.aplicacaoProduto.findMany({where,include:{animal:{select:{brinco:true}}},orderBy:ordem,take:10001});conferirLimite(itens);
  return paginarRelatorio(itens.map(i=>({id:i.id,animal:i.animal.brinco,data:data(i.data),aplicadaEm:i.aplicadaEm?.toISOString()??null,precisao:i.precisaoTemporal,produto:i.nomeProdutoAplicado,tipo:i.tipoAplicacaoNomeSnapshot,dose:i.dose?.toString()??null,unidade:i.unidadeDose,via:i.via,situacao:i.status,responsavel:i.responsavel,origem:i.origem,consumoMantido:i.consumoMantido,administracaoMantida:i.administracaoMantida})),q);
 }
 if(q.fonte==='exames'){
  const itens=await prisma.exameAnimal.findMany({where:{...where,tipoExame:{contexto:{not:'REPRODUTIVO'}}},include:{animal:{select:{brinco:true}},resultados:{where:{vigente:true},orderBy:{campo:'asc'}}},orderBy:ordem,take:10001});conferirLimite(itens);
  const linhas=itens.flatMap(i=>{const obs=i.resultados.length?i.resultados:i.resultadoNumero!==null||i.resultadoTexto!==null||i.resultadoOpcao!==null?[{campo:'RESULTADO',valor:i.resultadoNumero?.toString()??i.resultadoTexto??i.resultadoOpcao,unidade:typeof objeto(i.formatoSnapshot).unidade==='string'?String(objeto(i.formatoSnapshot).unidade):null}]:[];return observacoesRelatorio(i.formatoSnapshot,obs).map(o=>({...o,id:i.id,animal:i.animal.brinco,data:data(i.data),situacao:i.status,realizacao:i.realizacao,responsavel:i.responsavel,origem:i.origem}));});
  return paginarRelatorio(linhas,q,['Uma observação por campo e animal; resultados incompatíveis não devem ser somados.']);
 }
 if(q.fonte==='qualidade'){
  const itens=await prisma.amostraQualidadeLeite.findMany({where:{propriedadeId:q.propriedadeId,data:periodo,...(q.animalId?{exameAnimal:{animalId:q.animalId}}:{})},include:{exameAnimal:{include:{animal:{select:{brinco:true}},resultados:{where:{vigente:true},orderBy:{campo:'asc'}}}},resultados:{where:{vigente:true},orderBy:{campo:'asc'}}},orderBy:ordem,take:10001});conferirLimite(itens);
  return paginarRelatorio(itens.flatMap(i=>observacoesRelatorio(i.exameAnimal?.formatoSnapshot??i.formatoSnapshot,i.exameAnimal?.resultados??i.resultados).map(o=>({...o,id:i.id,data:data(i.data),animal:i.exameAnimal?.animal.brinco??null,sujeito:i.sujeito,origemColetiva:i.origemColetiva,entradaId:i.entradaId,situacao:i.status,realizacao:i.realizacao,versao:i.versao,responsavel:i.responsavel,dataLaboratorio:data(i.dataResultadoLaboratorial),dataLaudo:data(i.dataRecebimentoLaudo)}))),q,['Uma observação por campo e sujeito; não comparar formatos/unidades incompatíveis.']);
 }
 const fisicoWhere={propriedadeId:q.propriedadeId,data:periodo};
 if(q.fonte==='destinos'){
  const itens=await prisma.destinoInternoLeite.findMany({where:{...fisicoWhere,...(q.animalId?{parcelas:{some:{animalId:q.animalId}}}:{})},orderBy:ordem,take:10001});conferirLimite(itens);
  return paginarRelatorio(itens.map(i=>({id:i.id,data:data(i.data),entradaId:i.entradaId,litros:i.quantidadeLitros.toString(),natureza:i.natureza,declaracao:i.declaracaoOrigem,situacao:i.status,responsavel:i.responsavel,observacao:i.observacao,versao:i.versao})),q,['Um fornecimento por linha, sem multiplicar volumes pelos destinatários.']);
 }
 if(q.fonte==='descartes'){
  const itens=await prisma.descarteLeite.findMany({where:fisicoWhere,orderBy:ordem,take:10001});conferirLimite(itens);
  return paginarRelatorio(itens.map(i=>({id:i.id,data:data(i.data),entradaId:i.entradaId,litros:i.quantidadeLitros.toString(),motivo:i.motivo,situacao:i.status,versao:i.versao})),q);
 }
 const itens=await prisma.retiradaInternaLeite.findMany({where:fisicoWhere,orderBy:ordem,take:10001});conferirLimite(itens);
 return paginarRelatorio(itens.map(i=>({id:i.id,data:data(i.data),entradaId:i.entradaId,litros:i.quantidadeLitros.toString(),destino:i.destino,responsavel:i.responsavel,motivo:i.motivo,situacao:i.status,versao:i.versao})),q);
}
