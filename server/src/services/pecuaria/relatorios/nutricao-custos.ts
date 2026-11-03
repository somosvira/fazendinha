import {Prisma} from '@prisma/client';
import {prisma} from '../../../db.js';
import {listarDietas} from '../nutricao/dietas.js';
import {listarFechamentos} from '../nutricao/consumo.js';
import {consultarCustosTx} from '../custos/custos.js';
import {RebanhoError} from '../rebanho/regras.js';
import {paginarRelatorio, type ConsultaRelatorio, type ResultadoRelatorio} from './tipos.js';

const data = (v:Date|null) => v?.toISOString().slice(0,10) ?? null;
const dia = (v:string) => new Date(`${v}T00:00:00Z`);
const metadados = (q:ConsultaRelatorio,total:number) => ({total,pagina:q.pagina,porPagina:q.porPagina,paginado:true,consultadoEm:new Date().toISOString()});

/** Leituras factuais; valores monetários são selecionados explicitamente e mascarados no servidor. */
export async function consultarRelatoriosNutricaoCustos(q:ConsultaRelatorio):Promise<ResultadoRelatorio|null> {
  if(q.fonte==='dietas') {
    const dietas=await listarDietas(q.propriedadeId);
    return paginarRelatorio(dietas.flatMap(d=>d.itens.map(i=>({id:i.id,dietaId:d.id,dieta:d.nome,versao:d.versao,ativa:d.ativo,publicadaEm:data(d.publicadaEm),situacao:d.publicadaEm?'PUBLICADA':'RASCUNHO',produtoId:i.produtoId,ingrediente:i.produto.nome,quantidade:i.quantidadeCabecaDia.toNumber(),unidade:i.unidade,materiaSeca:i.materiaSecaPercentualSnapshot?.toNumber()??null,observacao:d.observacao}))),q,['Catálogo compartilhado atual de receitas e versões. A composição não comprova atribuição ou consumo. Quantidades de unidades diferentes não são somáveis.']);
  }
  if(q.fonte==='vigencias') {
    const where:Prisma.VigenciaDietaLoteWhereInput={lote:{propriedadeId:q.propriedadeId},...(q.loteId?{loteId:q.loteId}:{}),desde:{lte:dia(q.fim)},OR:[{ate:null},{ate:{gt:dia(q.inicio)}}]};
    return prisma.$transaction(async tx=>{
      const [itens,total]=await Promise.all([
        tx.vigenciaDietaLote.findMany({where,include:{dieta:{select:{nome:true,versao:true}},lote:{select:{nome:true}}},orderBy:[{desde:'desc'},{id:'asc'}],skip:(q.pagina-1)*q.porPagina,take:q.porPagina}),
        tx.vigenciaDietaLote.count({where}),
      ]);
      return {...metadados(q,total),linhas:itens.map(v=>({id:v.id,loteId:v.loteId,lote:v.lote.nome,sitio:q.propriedadeId,dietaId:v.dietaId,dieta:v.dieta.nome,versao:v.dieta.versao,inicio:data(v.desde),fim:data(v.ate),registradaEm:v.criadoEm.toISOString()})),avisos:['Vigências sobrepostas ao período; fim exclusivo. Atribuição de dieta não comprova consumo.']};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
  if(q.fonte==='consumos') {
    const r=await listarFechamentos(q.loteId,q.propriedadeId,{pagina:q.pagina,limite:q.porPagina},q.podeVerValores,q.animalId,undefined,{de:q.inicio,ate:q.fim},false);
    return {...metadados(q,r.total),linhas:r.itens.map(f=>({id:f.id,loteId:f.loteId,lote:f.lote.nome,sitio:q.propriedadeId,dieta:f.vigencia.dieta.nome,versao:f.vigencia.dieta.versao,inicio:data(f.inicio),fim:data(f.fim),situacao:f.status,animalDias:f.animalDias,participantes:f.participacoes.length,custoConhecido:q.podeVerValores?f.custoConhecido:null,cobertura:!q.podeVerValores?'OCULTO':f.coberturaCustoCompleta?'COMPLETO':f.custoConhecido==null?'DESCONHECIDO':'PARCIAL',confirmadoEm:f.confirmadoEm.toISOString(),estornadoEm:f.estornadoEm?.toISOString()??null,motivoEstorno:f.motivoEstorno})),avisos:['Fechamentos sobrepostos ao período, sem rateio do valor por dias do recorte. Estornos são históricos e não integram o consumo atual. Quantidade atribuída não comprova ingestão individual.']};
  }
  if(q.fonte==='custos') {
    if(!q.podeConsultarCustos) throw new RebanhoError('VALIDACAO','Sem permissão para consultar custos diretos');
    if(!q.animalId) throw new RebanhoError('VALIDACAO','Selecione um animal para consultar custos diretos','animalId');
    const r=await prisma.$transaction(tx=>consultarCustosTx(tx,q.propriedadeId,{animalId:q.animalId,inicio:q.inicio,fim:q.fim,pagina:q.pagina,limite:q.porPagina},q.podeVerValores,false),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
    return {...metadados({...q,pagina:r.pagina},r.total),linhas:r.componentes.map(c=>({id:c.chave,fonteId:c.fonteId,tipo:c.tipoFonte,animalId:c.animalId,sitio:q.propriedadeId,data:c.data,descricao:c.descricao,situacao:c.estadoFato,participacaoId:c.participacaoId,finalidade:c.finalidade,natureza:c.natureza,estado:c.estado,valor:q.podeVerValores?c.valor:null,origemId:q.podeVerValores?c.origemId:null,visibilidade:q.podeVerValores?'VISIVEL':'OCULTO',inicio:c.periodoConsumo?.inicio??null,fim:c.periodoConsumo?.fim??null})),avisos:['Custo direto registrado por animal, sem duplicação dos componentes. Custo parcial não representa lucro nem custo econômico integral. Nutrição usa a data final do fechamento e preserva seu intervalo; não é rateada pelo recorte.']};
  }
  return null;
}
