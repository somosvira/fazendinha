import type {Prisma} from '@prisma/client';
import {prisma} from '../../../db.js';
import {paginarRelatorio,type ConsultaRelatorio,type ResultadoRelatorio,type LinhaRelatorio} from './tipos.js';
import {diaIatf} from '../reproducao/horarios.calc.js';
import {resumoPeso} from '../rebanho/peso.calc.js';
import {listarLotes} from '../rebanho/lotes.js';
import {rotuloComposicao} from '../rebanho/composicao.calc.js';
import {tarefaNoEscopoOperacao} from '../protocolos/operacao.escopo.js';
import {situacaoOperacionalTarefa} from '../protocolos/situacao.js';
import {idadeEmMeses,avaliarCategoria} from '../rebanho/categoria.calc.js';
import {carregarRegras,manualDe,SELECT_MANUAL_ABERTA,SELECT_PARTOS_CATEGORIA} from '../rebanho/categorias.js';
import {totalPartosCategoria} from '../rebanho/partos.calc.js';
import {resolverPapelReprodutivo} from '../rebanho/papel-reprodutivo.calc.js';
import {hojeFazendaDate} from '../rebanho/regras.js';
const data=(d:Date|null|undefined)=>d?.toISOString().slice(0,10)??null;
const instante=(d:Date|null|undefined)=>d?.toISOString()??null;
const atual=['Posição atual; o intervalo informado não reconstitui o rebanho no passado.'];
const identidade=(a:{id?:string;brinco:string;nome?:string|null})=>({animal:a.brinco,nome:a.nome??null});
const origem=(a:{criadoEm:Date;criadoPorId:number|null})=>({registradoEm:instante(a.criadoEm),lancador:a.criadoPorId});
function resultado(linhas:LinhaRelatorio[],total:number,q:ConsultaRelatorio,avisos?:string[]):ResultadoRelatorio{return {linhas,total,pagina:q.pagina,porPagina:q.porPagina,paginado:true,consultadoEm:new Date().toISOString(),...(avisos?{avisos}:{})};}
/** Somente leitura. O chamador autoriza a área, o sítio e as permissões da consulta. */
export async function consultarRelatoriosRebanho(q:ConsultaRelatorio):Promise<ResultadoRelatorio|null>{
 const periodo={gte:new Date(`${q.inicio}T00:00:00Z`),lt:new Date(new Date(`${q.fim}T00:00:00Z`).getTime()+86400000)};
 const pagina={skip:(q.pagina-1)*q.porPagina,take:q.porPagina};
 const animal=q.animalId?{animalId:q.animalId}:{};
 if(q.fonte==='animais'||q.fonte==='peso'){
  const hoje=hojeFazendaDate();
  const where:Prisma.AnimalWhereInput={...(q.animalId?{id:q.animalId}:{}),localizacoes:{some:{propriedadeId:q.propriedadeId,ate:null,...(q.loteId?{loteId:q.loteId}:{})}},baixas:{none:{estornadaEm:null}}};
  const [itens,total,regras]=await Promise.all([prisma.animal.findMany({where,...pagina,orderBy:[{brinco:'asc'},{id:'asc'}],include:{localizacoes:{where:{ate:null},include:{propriedade:true,lote:true}},destinos:{where:{ate:null}},papeisReprodutivos:{where:{revogadoEm:null}},composicao:{include:{raca:true}},pesagens:{where:{data:{lte:hoje}},orderBy:[{data:'desc'},{id:'desc'}]},categoriasManuais:SELECT_MANUAL_ABERTA,partos:SELECT_PARTOS_CATEGORIA,mae:true,pai:true,maeExterna:true,paiExterno:true}}),prisma.animal.count({where}),carregarRegras()]);
  return resultado(itens.map(a=>{
   const p=resumoPeso(a.pesagens.map(p=>({data:p.data,pesoKg:Number(p.pesoKg)})),{hoje,periodoDias:30});
   const categoria=avaliarCategoria({sexo:a.sexo,dataNascimento:a.dataNascimento,partos:totalPartosCategoria(a,hoje)},regras,manualDe(a.categoriasManuais),hoje);
   const papel=resolverPapelReprodutivo(a.papeisReprodutivos,hoje,false);
   const base={id:a.id,animalId:a.id,...identidade(a),sitio:a.localizacoes[0]?.propriedade.nome??null,lote:a.localizacoes[0]?.lote?.nome??null,situacao:'ATIVO',categoria:categoria.categoria?.nome??null,peso:p.ultimo?.kg??null,dataPeso:p.ultimo?.data??null,gmd:p.gmdRecente,gmd30:p.gmdPeriodo.valor,gmdDesdeEntrada:p.gmdDesdeEntrada,pesagens30:p.gmdPeriodo.pesagens};
   if(q.fonte==='peso')return base;
   return {...base,sexo:a.sexo,nascimento:data(a.dataNascimento),nascimentoEstimado:a.nascimentoEstimado,entrada:data(a.dataEntrada),origem:a.origem,finalidade:a.destinos[0]?.aptidao??null,papel:papel.papel,estadoPapel:papel.estado,categoriaOrigem:categoria.origem,idadeMeses:idadeEmMeses(a.dataNascimento,hoje),noLocalDesde:data(a.localizacoes[0]?.desde),composicao:rotuloComposicao(a.composicao.map(c=>({sigla:c.raca.sigla,fracao64:c.fracao64}))),mae:a.mae?.brinco??a.maeExterna?.nome??null,pai:a.pai?.brinco??a.paiExterno?.nome??null,maeId:a.maeId??a.maeExternaId,paiId:a.paiId??a.paiExternoId,brincoEletronico:a.brincoEletronico,sisbov:a.sisbov,identificacaoProvisoria:a.identificacaoProvisoria,codigoProvisorio:a.codigoProvisorio,partosAntesEntrada:a.partosAntesDaEntrada,observacao:a.observacao,...origem(a)};
  }),total,q,atual);
 }
 if(q.fonte==='lotes'){
  const itens=await listarLotes(q.propriedadeId,true);
  return paginarRelatorio(itens.filter(l=>!q.loteId||l.id===q.loteId).map(l=>({id:l.id,lote:l.nome,sitio:l.propriedade.nome,ativo:l.ativo,efetivo:l.animaisAtivos,centroCusto:l.centroCustoId??null,observacao:l.observacao})),q,atual);
 }
 if(q.fonte==='genitores'){
  const [itens,total]=await Promise.all([prisma.genitorExterno.findMany({...pagina,orderBy:[{nome:'asc'},{id:'asc'}],include:{fornecedorParceiro:{select:{nome:true}},composicao:{include:{raca:true}}}}),prisma.genitorExterno.count()]);
  return resultado(itens.map(g=>({id:g.id,nome:g.nome,sexo:g.sexo,codigo:g.codigo,fornecedor:g.fornecedorParceiro?.nome??g.fornecedor,fornecedorId:g.fornecedorId,ativo:g.ativo,composicao:rotuloComposicao(g.composicao.map(c=>({sigla:c.raca.sigla,fracao64:c.fracao64}))),observacao:g.observacao,...origem(g)})),total,q,[...atual,'Cadastro compartilhado de genitores externos; não representa efetivo ou descendência do sítio.']);
 }
 if(q.fonte==='materiais'){
  const [itens,total]=await Promise.all([prisma.materialGenetico.findMany({...pagina,orderBy:{id:'asc'},include:{produto:true,touro:true,touroExterno:true,doadora:true,doadoraExterna:true}}),prisma.materialGenetico.count()]);
  return resultado(itens.map(m=>({id:m.id,nome:m.produto.nome,tipo:m.tipo,tipoSemen:m.tipoSemen,produtoId:m.produtoId,unidade:m.produto.unidade,ativo:m.produto.ativo,touro:m.touro?.brinco??m.touroExterno?.nome??null,touroId:m.touroId??m.touroExternoId,doadora:m.doadora?.brinco??m.doadoraExterna?.nome??null,doadoraId:m.doadoraId??m.doadoraExternaId,observacao:m.observacao,...origem(m)})),total,q,[...atual,'Cadastro compartilhado de identidade genética; não comprova saldo de estoque.']);
 }
 if(q.fonte==='movimentos'){
  const where:Prisma.MovimentacaoAnimalWhereInput={...animal,movimentacao:{data:periodo},AND:[{OR:[{origemPropriedadeId:q.propriedadeId},{movimentacao:{propriedadeDestinoId:q.propriedadeId}}]},...(q.loteId?[{OR:[{origemLoteId:q.loteId},{movimentacao:{loteDestinoId:q.loteId}}]}]:[])]};
  const [itens,total]=await Promise.all([prisma.movimentacaoAnimal.findMany({where,...pagina,orderBy:[{movimentacao:{data:'desc'}},{id:'asc'}],include:{animal:true,origemPropriedade:true,origemLote:true,movimentacao:{include:{propriedadeDestino:true,loteDestino:true}}}}),prisma.movimentacaoAnimal.count({where})]);
  return resultado(itens.map(i=>({id:i.id,movimentacaoId:i.movimentacaoId,animalId:i.animalId,...identidade(i.animal),data:data(i.movimentacao.data),sitioOrigem:i.origemPropriedade?.nome??null,loteOrigem:i.origemLote?.nome??null,sitioDestino:i.movimentacao.propriedadeDestino.nome,loteDestino:i.movimentacao.loteDestino?.nome??null,motivo:i.movimentacao.motivo,situacao:i.desfeitoEm||i.movimentacao.desfeitaEm?'DESFEITO':'REGISTRADO',desfeitoEm:instante(i.desfeitoEm),motivoDesfazer:i.movimentacao.desfeitaMotivo,...origem(i.movimentacao)})),total,q);
 }
 if(q.fonte==='baixas'){
  const where:Prisma.BaixaAnimalWhereInput={...animal,data:periodo,localizacaoFechada:{propriedadeId:q.propriedadeId,...(q.loteId?{loteId:q.loteId}:{})}};
  const [itens,total]=await Promise.all([prisma.baixaAnimal.findMany({where,...pagina,orderBy:[{data:'desc'},{id:'asc'}],include:{animal:true,motivo:true,localizacaoFechada:{include:{propriedade:true,lote:true}}}}),prisma.baixaAnimal.count({where})]);
  return resultado(itens.map(b=>({id:b.id,animalId:b.animalId,...identidade(b.animal),data:data(b.data),tipo:b.tipo,motivo:b.motivo?.nome??null,classe:b.motivo?.classe??null,sitio:b.localizacaoFechada?.propriedade.nome??null,lote:b.localizacaoFechada?.lote?.nome??null,situacao:b.estornadaEm?'ESTORNADA':'VIGENTE',estornadaEm:instante(b.estornadaEm),motivoEstorno:b.estornoMotivo,observacao:b.observacao,...origem(b)})),total,q,['Inclui estornos. Baixas sem vínculo preservado de localização não são atribuídas a um sítio por inferência.']);
 }
 if(q.fonte==='pesagens'){
  // Pesagem não guarda sítio: autorizar pela vigência histórica, nunca pela posição atual.
  const itens=await prisma.pesagem.findMany({where:{...animal,data:periodo,animal:{localizacoes:{some:{propriedadeId:q.propriedadeId,desde:{lt:periodo.lt},OR:[{ate:null},{ate:{gte:periodo.gte}}],...(q.loteId?{loteId:q.loteId}:{})}}}},orderBy:[{data:'desc'},{id:'asc'}],include:{animal:{select:{brinco:true,nome:true}}}});
  const locais=itens.length?await prisma.localizacaoAnimal.findMany({where:{animalId:{in:[...new Set(itens.map(p=>p.animalId))]},desde:{lt:periodo.lt},OR:[{ate:null},{ate:{gte:periodo.gte}}]},include:{propriedade:true,lote:true}}):[];
  const baixas=itens.length?await prisma.baixaAnimal.findMany({where:{animalId:{in:[...new Set(itens.map(p=>p.animalId))]},estornadaEm:null,data:periodo},select:{animalId:true,data:true,localizacaoFechadaId:true}}):[];
  const porAnimal=new Map<string,typeof locais>();for(const l of locais){const grupo=porAnimal.get(l.animalId)??[];grupo.push(l);porAnimal.set(l.animalId,grupo);}
  const linhas:LinhaRelatorio[]=[];
  for(const p of itens){const candidatas=(porAnimal.get(p.animalId)??[]).filter(l=>l.desde<=p.data&&(!l.ate||l.ate>p.data||baixas.some(b=>b.animalId===p.animalId&&b.localizacaoFechadaId===l.id&&b.data.getTime()===p.data.getTime())));if(candidatas.length!==1)continue;const l=candidatas[0];if(l.propriedadeId!==q.propriedadeId||(q.loteId&&l.loteId!==q.loteId))continue;linhas.push({id:p.id,animalId:p.animalId,...identidade(p.animal),data:data(p.data),peso:Number(p.pesoKg),tipo:p.tipo,origem:p.origem,sitio:l.propriedade.nome,lote:l.lote?.nome??null,observacao:p.observacao,...origem(p)});}
  return paginarRelatorio(linhas,q,['Pesagens sem localização única comprovada na data não são atribuídas a um sítio.']);
 }
 if(q.fonte==='gestacoes'){
  const where:Prisma.GestacaoAnimalWhereInput={...animal,propriedadeId:q.propriedadeId,confirmadaEm:periodo};
  const [itens,total]=await Promise.all([prisma.gestacaoAnimal.findMany({where,...pagina,orderBy:[{confirmadaEm:'desc'},{id:'asc'}],include:{Animal:true,Propriedade:true}}),prisma.gestacaoAnimal.count({where})]);
  return resultado(itens.map(g=>({id:g.id,animalId:g.animalId,...identidade(g.Animal),sitio:g.Propriedade?.nome??null,inicio:data(g.inicio),confirmacao:data(g.confirmadaEm),previsaoParto:data(g.previsaoParto),sexoFetal:g.sexoFetal,encerramento:data(g.encerradaEm),tipoEncerramento:g.tipoEncerramento,motivoEncerramento:g.motivoEncerramento,causaClinica:g.causaClinica==null?null:JSON.stringify(g.causaClinica),tentativaId:g.tentativaId,status:g.status,origem:g.origem,referenciaExterna:g.referenciaExterna,...origem(g)})),total,q,['Selecionadas pela data da confirmação; situação e encerramento refletem o registro consultado.']);
 }
 if(q.fonte==='lactacoes'){
  const where:Prisma.LactacaoAnimalWhereInput={...animal,propriedadeId:q.propriedadeId,inicio:periodo};
  const [itens,total]=await Promise.all([prisma.lactacaoAnimal.findMany({where,...pagina,orderBy:[{inicio:'desc'},{id:'asc'}],include:{Animal:true,Propriedade:true}}),prisma.lactacaoAnimal.count({where})]);
  return resultado(itens.map(l=>({id:l.id,animalId:l.animalId,...identidade(l.Animal),sitio:l.Propriedade?.nome??null,inicio:data(l.inicio),encerramento:data(l.encerradaEm),motivoEncerramento:l.motivoEncerramento,origem:l.origem,partoId:l.partoId,versao:l.versao,referenciaExterna:l.referenciaExterna,...origem(l)})),total,q,['Selecionadas pelo início da lactação; lactação não comprova volume produzido.']);
 }
 if(q.fonte==='protocolos'){
  const where:Prisma.TarefaProtocoloWhereInput={AND:[tarefaNoEscopoOperacao(q.propriedadeId),{previstaPara:{gte:new Date(periodo.gte.getTime()-86400000),lt:new Date(periodo.lt.getTime()+86400000)}},...(q.animalId?[{execucao:{animalId:q.animalId}}]:[])]};
  const candidatos=await prisma.tarefaProtocolo.findMany({where,orderBy:[{previstaPara:'asc'},{id:'asc'}],include:{execucao:{include:{animal:{select:{brinco:true,nome:true}},protocolo:true,propriedade:true}},etapa:true,vinculos:{orderBy:{ordem:'asc'},include:{aplicacao:{select:{status:true}},exame:{select:{status:true,realizacao:true}},tentativa:{select:{status:true}},manejo:{select:{status:true}}}},aplicacoes:{select:{status:true}},exames:{select:{status:true,realizacao:true}},tentativas:{select:{status:true}},manejos:{select:{status:true}},eventos:true}});
  const itens=candidatos.filter(t=>{const dia=diaIatf(t.previstaPara,t.precisaoTemporal);return dia>=q.inicio&&dia<=q.fim;});
  return paginarRelatorio(itens.map(t=>({id:t.id,participacaoId:t.execucaoId,animalId:t.execucao.animalId,...identidade(t.execucao.animal),sitio:t.execucao.propriedade?.nome??null,protocolo:t.execucao.protocolo.nome,versao:t.execucao.protocolo.versao,tipo:t.execucao.protocolo.tipo,etapa:t.nomeSnapshot??t.etapa.nome,etapaId:t.etapaId,procedimento:t.etapa.tipo,previsao:t.previsaoPendente?null:instante(t.previstaPara),precisao:t.precisaoTemporal,realizacao:instante(t.realizadaEm),dispensa:instante(t.dispensadaEm),motivoDispensa:t.motivoDispensa,situacao:situacaoOperacionalTarefa(t),regularizacaoPendente:t.regularizacaoPendente,programacaoId:t.execucao.rodadaId,vinculos:JSON.stringify(t.vinculos.map(v=>({id:v.id,ordem:v.ordem,estado:v.estado,origem:v.origem,aplicacaoId:v.aplicacaoId,exameId:v.exameId,tentativaId:v.tentativaId,manejoId:v.manejoId,motivo:v.motivo})))})),q,['Uma tarefa por participação. Recorte pela data prevista: precisão DIA usa calendário UTC, HORA usa data civil de São Paulo; situações são atuais. Vínculos substituídos/encerrados são preservados. Sítio identifica a participação de origem; a autorização também considera os fatos ligados à tarefa.']);
 }
 return null;
}
