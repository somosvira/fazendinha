import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import * as sanitario from "../sanidade/protocolos.js";
import { listarAplicacoes, obterSaldo } from "../sanidade/aplicacoes.js";
import * as iatf from "./iatf.js";
import { protocoloSchema, programacaoSchema, confirmacaoVisitaSchema } from "./schemas.js";
import { criarVisita, adicionarAtividade, salvarRascunho, previaAtividade, confirmarAtividade, obterConfirmacaoVisita } from "./visitas.js";
import { listarTarefasOperacao } from "../protocolos/operacao.js";
import { consultaOperacaoSchema } from "../protocolos/operacao.schemas.js";
import { listarExamesTarefaClinica } from "../protocolos/opcoes-clinicas.js";
import { preverExecucaoProtocolo } from "../protocolos/execucao.js";
import { resumoVisita, listarParticipantesAtividade, obterParticipanteVisita } from "./visitas-consultas.js";
import { listarOpcoesCadastro } from "../protocolos/cadastros-opcoes.js";
import { criarEntradaValorizadaFixture, limparMovimentosValorizadosFixture } from "../../../test/estoque-valorizado.fixture.js";
const suite=process.env.PECUARIA_DB_INTEGRATION==="1"?describe:describe.skip;
const uuid=()=>crypto.randomUUID();
const dias=(n:number)=>new Date(Date.parse(hojeFazenda())+n*86400000).toISOString().slice(0,10);
const data=dias(-2);
const sitios:number[]=[],animais:string[]=[],produtos:string[]=[],protocolos:string[]=[],materiais:string[]=[],genitores:string[]=[],visitas:string[]=[];
// As exclusões abrangem somente identidades criadas por esta suíte, sem tocar seed/manifestações alheias.
afterAll(async()=>{
 if(!sitios.length)return;
 await prisma.requisicaoPecuaria.deleteMany({where:{propriedadeId:{in:sitios}}});
 await prisma.auditoriaPecuaria.deleteMany({where:{OR:[{animalId:{in:animais}},{propriedadeId:{in:sitios}},{entidadeId:{in:protocolos}}]}});
 const atividades=await prisma.atividadeVisita.findMany({where:{visitaId:{in:visitas}},select:{id:true}});
 await prisma.participanteVisita.deleteMany({where:{atividadeId:{in:atividades.map(a=>a.id)}}});
 await prisma.atividadeVisita.deleteMany({where:{visitaId:{in:visitas}}});
 await prisma.visitaVeterinaria.deleteMany({where:{id:{in:visitas}}});
 await prisma.vinculoTarefaProtocolo.deleteMany({where:{tarefa:{execucao:{animalId:{in:animais}}}}});
 await prisma.eventoTarefaProtocolo.deleteMany({where:{tarefa:{execucao:{animalId:{in:animais}}}}});
 await prisma.demandaAcompanhamentoReprodutivo.deleteMany({where:{animalId:{in:animais}}});
 await prisma.interpretacaoReprodutiva.deleteMany({where:{exame:{animalId:{in:animais}}}});
 await prisma.resultadoExame.deleteMany({where:{exame:{animalId:{in:animais}}}});
 await prisma.exameAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.gestacaoAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.tentativaReprodutiva.deleteMany({where:{animalId:{in:animais}}});
 await prisma.aplicacaoProduto.deleteMany({where:{animalId:{in:animais}}});
 await limparMovimentosValorizadosFixture(produtos);
 await prisma.tarefaProtocolo.deleteMany({where:{execucao:{animalId:{in:animais}}}});
 await prisma.participacaoProtocolo.deleteMany({where:{animalId:{in:animais}}});
 await prisma.programacaoProtocolo.deleteMany({where:{propriedadeId:{in:sitios}}});
 await prisma.protocolo.deleteMany({where:{id:{in:protocolos}}});
 await prisma.materialGenetico.deleteMany({where:{id:{in:materiais}}});
 await prisma.genitorExterno.deleteMany({where:{id:{in:genitores}}});
 await prisma.produto.deleteMany({where:{id:{in:produtos}}});
 await prisma.periodoReprodutivoAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.finalidadeAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.localizacaoAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.animal.deleteMany({where:{id:{in:animais}}});
 await prisma.propriedade.deleteMany({where:{id:{in:sitios}}});
});
async function fixture(quantidade:number,saldo:number,reprodutivo=false){
 const run=uuid().slice(0,8),sitio=await prisma.propriedade.create({data:{nome:`Visita ações ${run}`}});sitios.push(sitio.id);
 const produto=await prisma.produto.create({data:{nome:`Material visita ${run}`,unidade:reprodutivo?"DOSE":"ML",usoGenetico:reprodutivo,usoSanitario:!reprodutivo}});produtos.push(produto.id);
 const ids:string[]=[];
 for(let n=0;n<quantidade;n++){const a=await cadastrar(cadastrarAnimalSchema.parse({brinco:`VPA${run}${n}`,sexo:"F",origem:"COMPRADO",aptidao:"LEITE",dataNascimento:"2024-01-01",dataEntrada:"2026-08-01",propriedadeId:sitio.id}),null);animais.push(a.id);ids.push(a.id);}
 let grupoId:string,materialId:string|undefined;
 if(reprodutivo){
  const touro=await prisma.genitorExterno.create({data:{nome:`Touro visita ${run}`,sexo:"M"}});genitores.push(touro.id);
  const material=await prisma.materialGenetico.create({data:{tipo:"SEMEN",produtoId:produto.id,touroExternoId:touro.id}});materiais.push(material.id);materialId=material.id;
  const protocolo=await iatf.criarProtocolo(protocoloSchema.parse({nome:`IATF visita ${run}`,versao:1,publicado:true,etapas:[{nome:"Tentativa",tipo:"TENTATIVA",intervalo:0,unidade:"DIAS",planoTentativa:{tipo:"IA",materialId,quantidade:1}},{nome:"Diagnóstico",tipo:"AVALIACAO",intervalo:0,unidade:"DIAS",planoAvaliacao:{tipo:"DIAGNOSTICO"}}]}),null);protocolos.push(protocolo.id);
  const g=await iatf.criarProgramacao(programacaoSchema.parse({chave:uuid(),propriedadeId:sitio.id,protocoloId:protocolo.id,nome:`Grupo visita ${run}`,inicioPrevisto:data,animais:ids.map(animalId=>({animalId}))}),null);grupoId=g.id;
 }else{
  const protocolo=await sanitario.criarProtocolo({nome:`Sanitário visita ${run}`,etapas:[1,2].map(n=>({tipo:"APLICACAO" as const,nome:`Ação ${n}`,diaRelativo:0,produtoId:produto.id,dose:2,unidade:"ML" as const,finalidade:"TRATAMENTO" as const}))},null);protocolos.push(protocolo.id);await sanitario.publicarProtocolo(protocolo.id,null);
  const grupo=await prisma.programacaoProtocolo.create({data:{protocoloId:protocolo.id,propriedadeId:sitio.id,nome:`Grupo visita ${run}`,inicioReferencia:new Date(data)}});grupoId=grupo.id;
  for(const animalId of ids){const p=await sanitario.iniciarExecucao({animalId,propriedadeId:sitio.id,protocoloId:protocolo.id,inicio:data},null);await prisma.participacaoProtocolo.update({where:{id:p.id},data:{rodadaId:grupo.id}});}
 }
 await criarEntradaValorizadaFixture({data:{produtoId:produto.id,propriedadeId:sitio.id,data:new Date(data),tipo:"ENTRADA",origem:"INVENTARIO_INICIAL",quantidade:saldo,custoUnitario:1,valorTotal:saldo}});
 const participacoes=await prisma.participacaoProtocolo.findMany({where:{rodadaId:grupoId},include:{tarefas:{orderBy:{etapa:{ordem:"asc"}}}},orderBy:{animalId:"asc"}});
 const visita=await criarVisita({chave:uuid(),propriedadeId:sitio.id,nome:`Visita ${run}`,data},null);visitas.push(visita.id);
 const aplicacao={data,aplicadaEm:`${data}T14:00:00-03:00`,produtoId:produto.id,nomeProdutoAplicado:produto.nome,dose:"2",unidadeDose:"ML",origemInsumo:"BAIXA_ESTOQUE",finalidade:"TRATAMENTO",estadoCarenciaLeite:"INFORMADO",estadoCarenciaCarne:"INFORMADO",carenciaLeiteHoras:0,carenciaCarneHoras:0};
 return{sitio,produto,grupoId,materialId,participacoes,visita,aplicacao};
}
suite("visita e protocolo compartilham fatos e confirmação atômica",()=>{
 it("14aplicações da visita aparecem na ficha e protocolo com o mesmo ID,28mL e recibo/retry sem duplicação",async()=>{
  const f=await fixture(14,100);
  const atividade=await adicionarAtividade(f.visita.id,{propriedadeId:f.sitio.id,tipo:"APLICACAO_SANITARIA",nome:"Aplicações",extra:false,contexto:{},participantes:f.participacoes.map(p=>({animalId:p.animalId,tarefaSanitariaId:p.tarefas[0].id}))},null);
  // A preparação não é o cenário de concorrência: cada rascunho tem sua própria transação Serializable.
  const salvos=[];
  for(const p of atividade.participantes)salvos.push(await salvarRascunho(f.visita.id,p.id,f.sitio.id,f.aplicacao,null,0));
  const resumo=await resumoVisita(f.visita.id,f.sitio.id);
  expect(resumo).toMatchObject({totalAnimais:14,totalParticipantes:14,atividades:[{totais:{pendentes:14}}]});expect(resumo.atividades[0]).not.toHaveProperty("participantes");
  const paginaParticipantes=await listarParticipantesAtividade(f.visita.id,atividade.id,f.sitio.id,{pagina:2,status:"PENDENTE",motivos:["Tarefa sanitária pendente"]});expect(paginaParticipantes).toMatchObject({total:14,pagina:2,porPagina:10});expect(paginaParticipantes.itens).toHaveLength(4);
  const animal=await prisma.animal.findUniqueOrThrow({where:{id:atividade.participantes[0].animalId},select:{brinco:true}});
  expect((await listarParticipantesAtividade(f.visita.id,atividade.id,f.sitio.id,{busca:animal.brinco,motivos:["Tarefa sanitária pendente"]})).total).toBe(1);
  expect(await obterParticipanteVisita(f.visita.id,salvos[0].id,f.sitio.id)).toMatchObject({id:salvos[0].id,tarefaSanitariaId:salvos[0].tarefaId});
  expect((await listarOpcoesCadastro({opcao:"PRODUTO",origem:"SANITARIO",selecionadoId:f.produto.id})).total).toBe(1);
  const consulta={participanteIds:salvos.map(p=>p.id)};
  const a=await previaAtividade(f.visita.id,atividade.id,f.sitio.id,consulta),b=await previaAtividade(f.visita.id,atividade.id,f.sitio.id,{...consulta,pagina:2});
  expect(a.total).toBe(14);expect(a.itens).toHaveLength(10);expect(b.itens).toHaveLength(4);expect(a.fingerprint).toBe(b.fingerprint);
  expect(a.execucaoProtocolos).toMatchObject({estado:"CONFERIDA"});expect(await prisma.aplicacaoProduto.count({where:{propriedadeId:f.sitio.id}})).toBe(0);
  const entrada=confirmacaoVisitaSchema.parse({propriedadeId:f.sitio.id,chave:uuid(),itens:salvos.map(p=>({participanteId:p.id,versaoRascunho:p.versaoRascunho,status:"CONFIRMADO"}))});
  const recibo=await confirmarAtividade(f.visita.id,atividade.id,entrada,null);expect(recibo.total).toBe(14);expect(recibo.participantes).toHaveLength(10);
  expect(JSON.parse(JSON.stringify(await confirmarAtividade(f.visita.id,atividade.id,entrada,null)))).toEqual(JSON.parse(JSON.stringify(recibo)));
  expect((await obterConfirmacaoVisita(f.visita.id,atividade.id,entrada.chave,f.sitio.id,null,{pagina:2})).itens).toHaveLength(4);
  expect((await obterSaldo(prisma,f.produto.id,f.sitio.id)).toString()).toBe("72");
  const linha=(await listarTarefasOperacao({programacaoId:f.grupoId},f.sitio.id,consultaOperacaoSchema.parse({etapaId:f.participacoes[0].tarefas[0].etapaId}),{dono:true,areas:[],flags:[]})).itens[0];
  expect(linha).toBeDefined();
  expect(linha.vinculoAtual).toMatchObject({tipo:"APLICACAO"});
  const participacao=f.participacoes.find(p=>p.tarefas.some(t=>t.id===linha.id))!;
  const ficha=await listarAplicacoes(participacao.animalId,f.sitio.id);
  expect(ficha.some(a=>a.id===linha.vinculoAtual?.id)).toBe(true);
  expect(await prisma.participanteVisita.findFirst({where:{atividadeId:atividade.id,animalId:participacao.animalId}})).toMatchObject({fatoTipo:"AplicacaoProduto",fatoId:linha.vinculoAtual?.id});
 },90000);
 it("consumo compartilhado entre ações diferentes é conferido no conjunto e nada é salvo quando falta saldo",async()=>{
  const f=await fixture(2,3);
  const atividade=await adicionarAtividade(f.visita.id,{propriedadeId:f.sitio.id,tipo:"APLICACAO_SANITARIA",nome:"Duas ações",extra:false,contexto:{},participantes:f.participacoes.map((p,n)=>({animalId:p.animalId,tarefaSanitariaId:p.tarefas[n].id}))},null);
  const input=confirmacaoVisitaSchema.parse({propriedadeId:f.sitio.id,chave:uuid(),itens:atividade.participantes.map(p=>({participanteId:p.id,status:"CONFIRMADO",dados:f.aplicacao}))});
  await expect(confirmarAtividade(f.visita.id,atividade.id,input,null)).rejects.toMatchObject({code:"VALIDACAO"});
  expect(await prisma.aplicacaoProduto.count({where:{propriedadeId:f.sitio.id}})).toBe(0);expect((await obterSaldo(prisma,f.produto.id,f.sitio.id)).toString()).toBe("3");
  expect(await prisma.participanteVisita.count({where:{atividadeId:atividade.id,status:"CONFIRMADO"}})).toBe(0);
 },45000);
 it("IA e diagnóstico pela visita preservam IDs clínicos,gestação única e envelope TarefaIatf no retry",async()=>{
  const f=await fixture(2,2,true);
  const ia=await adicionarAtividade(f.visita.id,{propriedadeId:f.sitio.id,tipo:"TAREFA_IATF",nome:"Inseminações",extra:false,contexto:{},participantes:f.participacoes.map(p=>({animalId:p.animalId,tarefaIatfId:p.tarefas[0].id}))},null);
  const input=confirmacaoVisitaSchema.parse({propriedadeId:f.sitio.id,chave:uuid(),itens:ia.participantes.map(p=>({participanteId:p.id,status:"CONFIRMADO",dados:{realizadaEm:data,dados:{tipo:"IA",materialId:f.materialId,origem:"ESTOQUE",quantidade:1}}}))});
  await confirmarAtividade(f.visita.id,ia.id,input,null);await confirmarAtividade(f.visita.id,ia.id,input,null);
  expect(await prisma.tentativaReprodutiva.count({where:{propriedadeId:f.sitio.id}})).toBe(2);expect(await prisma.gestacaoAnimal.count({where:{animalId:{in:f.participacoes.map(p=>p.animalId)}}})).toBe(0);
  const dg=await adicionarAtividade(f.visita.id,{propriedadeId:f.sitio.id,tipo:"TAREFA_IATF",nome:"Diagnósticos",extra:false,contexto:{},participantes:f.participacoes.map(p=>({animalId:p.animalId,tarefaIatfId:p.tarefas[1].id}))},null);
  const tentativas=await prisma.tentativaReprodutiva.findMany({where:{propriedadeId:f.sitio.id}});
  const diagnostico=confirmacaoVisitaSchema.parse({propriedadeId:f.sitio.id,chave:uuid(),itens:dg.participantes.map(p=>({participanteId:p.id,status:"CONFIRMADO",dados:{realizadaEm:data,dados:{resultado:"POSITIVO",tentativaId:tentativas.find(t=>t.animalId===p.animalId)!.id}}}))});
  const feita=await confirmarAtividade(f.visita.id,dg.id,diagnostico,null);expect(JSON.parse(JSON.stringify(await confirmarAtividade(f.visita.id,dg.id,diagnostico,null)))).toEqual(JSON.parse(JSON.stringify(feita)));
  expect(await prisma.gestacaoAnimal.count({where:{animalId:{in:f.participacoes.map(p=>p.animalId)}}})).toBe(2);
  expect((await obterSaldo(prisma,f.produto.id,f.sitio.id)).toString()).toBe("0");
  const p=dg.participantes[0],tarefa=f.participacoes.find(t=>t.animalId===p.animalId)!.tarefas[1];
  const exames=await listarExamesTarefaClinica(tarefa.id,f.sitio.id,{});
  expect(exames.total).toBe(1);expect(await prisma.participanteVisita.findUnique({where:{id:p.id}})).toMatchObject({fatoTipo:"TarefaIatf",fatoId:tarefa.id,snapshot:{execucaoProtocolo:{fatoId:exames.itens[0].id,tarefaId:tarefa.id}}});
  await expect(preverExecucaoProtocolo({versao:1,propriedadeId:f.sitio.id,itens:[{tipo:"AVALIACAO",tarefaId:tarefa.id,animalId:p.animalId,data,propriedadeId:f.sitio.id,resultado:"POSITIVO"}]})).rejects.toMatchObject({code:"VALIDACAO"});
 },90000);
 it("adiamento ligado exige nova previsão e ausência vira evento comum sem consumo",async()=>{
  const f=await fixture(2,10);
  const atividade=await adicionarAtividade(f.visita.id,{propriedadeId:f.sitio.id,tipo:"APLICACAO_SANITARIA",nome:"Pendências",extra:false,contexto:{},participantes:f.participacoes.map(p=>({animalId:p.animalId,tarefaSanitariaId:p.tarefas[0].id}))},null);
  const itens=atividade.participantes.map((p,n)=>({participanteId:p.id,status:n?"NAO_ATENDIDO" as const:"ADIADO" as const,motivo:"Atendimento reagendado pelo responsável"}));
  await expect(confirmarAtividade(f.visita.id,atividade.id,{propriedadeId:f.sitio.id,chave:uuid(),itens},null)).rejects.toMatchObject({code:"VALIDACAO",campo:"previstaPara"});
  expect(await prisma.eventoTarefaProtocolo.count({where:{tarefa:{execucao:{animalId:{in:f.participacoes.map(p=>p.animalId)}}}}})).toBe(0);
  await confirmarAtividade(f.visita.id,atividade.id,{propriedadeId:f.sitio.id,chave:uuid(),itens:itens.map(i=>({...i,...(i.status==="ADIADO"?{dados:{previstaPara:dias(1)}}:{})}))},null);
  expect(await prisma.eventoTarefaProtocolo.count({where:{tarefa:{execucao:{animalId:{in:f.participacoes.map(p=>p.animalId)}}}}})).toBe(2);
  expect(await prisma.aplicacaoProduto.count({where:{propriedadeId:f.sitio.id}})).toBe(0);expect((await obterSaldo(prisma,f.produto.id,f.sitio.id)).toString()).toBe("10");
 },45000);
});
