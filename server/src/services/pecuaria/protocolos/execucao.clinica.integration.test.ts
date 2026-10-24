import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { criarProtocolo, criarProgramacao } from "../reproducao/iatf.js";
import { protocoloSchema, programacaoSchema } from "../reproducao/schemas.js";
import { criarAvaliacao } from "../reproducao/registros.js";
import { listarAcompanhamentosPaginados } from "../reproducao/acompanhamento.js";
import { anularFato, previaAnulacao } from "../reproducao/correcoes.js";
import { TIPO_EXAME_REPRODUTIVO } from "../exames/evidencia-reprodutiva.js";
import { corrigirExame } from "../sanidade/exames.js";
import { criarEntradaValorizadaFixture, limparMovimentosValorizadosFixture } from "../../../test/estoque-valorizado.fixture.js";
import { preverExecucaoProtocolo, confirmarExecucaoProtocolo } from "./execucao.js";
import { condicaoSituacaoTarefa, situacaoTarefaComum } from "./situacao.js";
import { listarTarefasOperacao, obterCabecalhoOperacao } from "./operacao.js";
import { consultaOperacaoSchema } from "./operacao.schemas.js";
import { listarExamesTarefaClinica } from "./opcoes-clinicas.js";
import type { ExecucaoProtocoloInput } from "./execucao.schemas.js";
import type { ItemExecucaoClinica } from "./execucao.clinica.schemas.js";

const banco=process.env.PECUARIA_DB_INTEGRATION==="1"?describe:describe.skip;
const sitios:number[]=[],animais:string[]=[],produtos:string[]=[],materiais:string[]=[],genitores:string[]=[],protocolos:string[]=[],tipos:string[]=[];
const data=new Date(Date.parse(hojeFazenda())-3*86400000).toISOString().slice(0,10);
const uuid=()=>crypto.randomUUID();
// Somente IDs criados por esta suíte; nenhuma limpeza global/seed/estrutura.
afterAll(async()=>{
 if(!sitios.length)return;
 await prisma.requisicaoPecuaria.deleteMany({where:{propriedadeId:{in:sitios}}});
 await prisma.auditoriaPecuaria.deleteMany({where:{OR:[{animalId:{in:animais}},{propriedadeId:{in:sitios}},{entidadeId:{in:protocolos}}]}});
 await prisma.vinculoTarefaProtocolo.deleteMany({where:{tarefa:{execucao:{animalId:{in:animais}}}}});
 await prisma.demandaAcompanhamentoReprodutivo.updateMany({where:{animalId:{in:animais}},data:{estado:"PENDENTE",exameResolucaoId:null,resolvidaEm:null,resolucaoSnapshot:undefined}});
 await prisma.exameAnimal.updateMany({where:{animalId:{in:animais}},data:{demandaAcompanhamentoId:null}});
 await prisma.demandaAcompanhamentoReprodutivo.deleteMany({where:{animalId:{in:animais}}});
 await prisma.interpretacaoReprodutiva.deleteMany({where:{exame:{animalId:{in:animais}}}});
 await prisma.resultadoExame.deleteMany({where:{exame:{animalId:{in:animais}}}});
 await prisma.exameAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.gestacaoAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.tentativaReprodutiva.deleteMany({where:{animalId:{in:animais}}});
 await limparMovimentosValorizadosFixture(produtos);
 await prisma.tarefaProtocolo.deleteMany({where:{execucao:{animalId:{in:animais}}}});
 await prisma.participacaoProtocolo.deleteMany({where:{animalId:{in:animais}}});
 await prisma.programacaoProtocolo.deleteMany({where:{propriedadeId:{in:sitios}}});
 await prisma.protocolo.deleteMany({where:{id:{in:protocolos}}});
 await prisma.tipoExame.deleteMany({where:{id:{in:tipos}}});
 await prisma.materialGenetico.deleteMany({where:{id:{in:materiais}}});
 await prisma.genitorExterno.deleteMany({where:{id:{in:genitores}}});
 await prisma.produto.deleteMany({where:{id:{in:produtos}}});
 await prisma.periodoReprodutivoAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.finalidadeAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.localizacaoAnimal.deleteMany({where:{animalId:{in:animais}}});
 await prisma.animal.deleteMany({where:{id:{in:animais}}});
 await prisma.propriedade.deleteMany({where:{id:{in:sitios}}});
});
async function fixture(acao:"EXAME"|"TENTATIVA"|"AVALIACAO",quantidade=2,saldo=10,finalidade:"DIAGNOSTICO"|"RECONFIRMACAO"|"SEXAGEM"="DIAGNOSTICO"){
 const run=uuid().slice(0,8);
 const sitio=await prisma.propriedade.create({data:{nome:`Clínica ações ${run}`}});sitios.push(sitio.id);
 const produto=await prisma.produto.create({data:{nome:`Genética clínica ${run}`,unidade:"DOSE",usoGenetico:true}});produtos.push(produto.id);
 const touro=await prisma.genitorExterno.create({data:{nome:`Touro clínica ${run}`,sexo:"M"}});genitores.push(touro.id);
 const material=await prisma.materialGenetico.create({data:{tipo:"SEMEN",produtoId:produto.id,touroExternoId:touro.id}});materiais.push(material.id);
 const tipo=await prisma.tipoExame.create({data:{nome:`Exame clínica ${run}`,contexto:"SANITARIO",tipoResultado:"NUMERO",unidade:"un"}});tipos.push(tipo.id);
 const etapa={nome:`Ação ${acao}`,tipo:acao,intervalo:0,unidade:"DIAS",...(acao==="EXAME"?{planoExame:{tipoExameId:tipo.id}}:acao==="AVALIACAO"?{planoAvaliacao:{tipo:finalidade,tipoExameId:TIPO_EXAME_REPRODUTIVO}}:{planoTentativa:{tipo:"IA",materialId:material.id,quantidade:1}})};
 const protocolo=await criarProtocolo(protocoloSchema.parse({nome:`Clínica ${acao} ${run}`,versao:1,publicado:true,etapas:[etapa,...(acao!=="TENTATIVA"?[{nome:"Tentativa planejada",tipo:"TENTATIVA",intervalo:10,unidade:"DIAS",planoTentativa:{tipo:"IA",materialId:material.id,quantidade:1}}]:[])]}),null);protocolos.push(protocolo.id);
 const ids:string[]=[];
 for(let n=0;n<quantidade;n++){const animal=await cadastrar(cadastrarAnimalSchema.parse({brinco:`CL${run}${n}`,sexo:"F",origem:"COMPRADO",aptidao:"LEITE",dataNascimento:"2024-01-01",dataEntrada:"2026-08-01",propriedadeId:sitio.id}),null);animais.push(animal.id);ids.push(animal.id);}
 const grupo=await criarProgramacao(programacaoSchema.parse({chave:uuid(),propriedadeId:sitio.id,protocoloId:protocolo.id,nome:`Clínica grupo ${run}`,inicioPrevisto:data,animais:ids.map(animalId=>({animalId}))}),null);
 const participacoes=await prisma.participacaoProtocolo.findMany({where:{rodadaId:grupo.id},include:{tarefas:{orderBy:{etapa:{ordem:"asc"}}}},orderBy:{animalId:"asc"}});
 await criarEntradaValorizadaFixture({data:{produtoId:produto.id,propriedadeId:sitio.id,data:new Date(`${data}T00:00:00Z`),tipo:"ENTRADA",origem:"INVENTARIO_INICIAL",quantidade:saldo,custoUnitario:1,valorTotal:saldo}});
 const itens:ItemExecucaoClinica[]=participacoes.map(p=>{const base={tarefaId:p.tarefas[0].id,animalId:p.animalId,propriedadeId:sitio.id,data};return acao==="EXAME"?{...base,tipo:"EXAME",tipoExameId:tipo.id}:acao==="TENTATIVA"?{...base,tipo:"TENTATIVA",tipoTentativa:"IA",materialId:material.id,origem:"ESTOQUE",quantidade:1}:{...base,tipo:"AVALIACAO",tipoExameId:TIPO_EXAME_REPRODUTIVO,resultado:"INCONCLUSIVO"};});
 return {sitio,produto,grupo,itens,input:{versao:1 as const,propriedadeId:sitio.id,itens}};
}
async function confirmar(input:ExecucaoProtocoloInput){const previa=await preverExecucaoProtocolo(input);return confirmarExecucaoProtocolo({execucao:input,chave:uuid(),fingerprint:previa.fingerprint},null);}

banco("execução clínica comum preserva fatos e efeitos no PostgreSQL",()=>{
 it("coleta sem resultado não é negativo; completar preserva identidade da coleta",async()=>{
  const f=await fixture("EXAME",1);const recibo=await confirmar(f.input);const id=recibo.itens[0].id;
  expect(await prisma.exameAnimal.findUnique({where:{id}})).toMatchObject({realizacao:"COLETA_REGISTRADA",resultadoNumero:null});
  const pendentes=await listarTarefasOperacao({programacaoId:f.grupo.id},f.sitio.id,consultaOperacaoSchema.parse({situacao:"PENDENTES"}),{dono:true,areas:[],flags:[]});
  expect(pendentes.itens[0]).toMatchObject({situacao:"ATENDIDO",acompanhamentoPendente:true,acoes:{atender:false}});
  await corrigirExame(id,f.sitio.id,{motivo:"Resultado recebido pelo laboratório",resultadoNumero:0},null);
  expect(await prisma.exameAnimal.findUnique({where:{id}})).toMatchObject({realizacao:"REALIZADO",resultadoNumero:expect.anything()});
  expect(await prisma.exameAnimal.count({where:{tarefaId:f.itens[0].tarefaId}})).toBe(1);
  expect((await listarTarefasOperacao({programacaoId:f.grupo.id},f.sitio.id,consultaOperacaoSchema.parse({situacao:"ACOMPANHAMENTO_PENDENTE"}),{dono:true,areas:[],flags:[]})).total).toBe(0);
  expect(await prisma.gestacaoAnimal.count({where:{animalId:f.itens[0].animalId}})).toBe(0);
 },45000);
 it("saldo agregado insuficiente rejeita prévia; IA válida consome uma dose por animal sem gestação e retry duplica nada",async()=>{
  const curto=await fixture("TENTATIVA",2,1);
  await expect(preverExecucaoProtocolo(curto.input)).rejects.toMatchObject({code:"VALIDACAO"});
  expect(await prisma.tentativaReprodutiva.count({where:{propriedadeId:curto.sitio.id}})).toBe(0);
  const f=await fixture("TENTATIVA",2,2);const previa=await preverExecucaoProtocolo(f.input);
  expect(previa.consumos.itens[0].quantidade).toBe("2");
  const entrada={execucao:f.input,chave:uuid(),fingerprint:previa.fingerprint};
  const recibo=await confirmarExecucaoProtocolo(entrada,null);expect(await confirmarExecucaoProtocolo(entrada,null)).toEqual(recibo);
  expect(await prisma.tentativaReprodutiva.count({where:{propriedadeId:f.sitio.id}})).toBe(2);
  expect(await prisma.gestacaoAnimal.count({where:{animalId:{in:f.itens.map(i=>i.animalId)}}})).toBe(0);
 },60000);
 it("positivo e inconclusivo mantêm efeitos distintos; reavaliação cria nova evidência da mesma demanda sem substituir a original",async()=>{
  const f=await fixture("AVALIACAO",2);
  const input:ExecucaoProtocoloInput={...f.input,itens:f.itens.map((i,n)=>({...i,tipo:"AVALIACAO" as const,resultado:n?"INCONCLUSIVO" as const:"POSITIVO" as const,motivoVinculoDesconhecido:"Tentativa anterior sem vínculo comprovado"}))};
  await preverExecucaoProtocolo(input);expect(await prisma.gestacaoAnimal.count({where:{animalId:{in:f.itens.map(i=>i.animalId)}}})).toBe(0);
  const recibo=await confirmar(input);const original=recibo.itens.find(i=>i.animalId===f.itens[1].animalId)!;
  const demanda=await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({where:{tarefaId:original.tarefaId}});
  expect(demanda).toMatchObject({estado:"PENDENTE",politicaId:null,previstaPara:null,origemAdocao:"PROTOCOLO",exameOrigemId:original.id});
  const reavaliacao:ExecucaoProtocoloInput={...f.input,itens:[{...f.itens[1],tipo:"AVALIACAO",resultado:"POSITIVO",motivoVinculoDesconhecido:"Tentativa anterior sem vínculo comprovado",demandaAcompanhamentoId:demanda.id,reavaliacao:true}]};
  const novo=await confirmar(reavaliacao);
  expect(novo.itens[0].id).not.toBe(original.id);
  expect(await prisma.exameAnimal.findUnique({where:{id:original.id}})).toMatchObject({status:"VALIDO",tarefaId:original.tarefaId});
  expect(await prisma.exameAnimal.findUnique({where:{id:novo.itens[0].id}})).toMatchObject({tarefaId:null,demandaAcompanhamentoId:demanda.id});
  expect(await prisma.demandaAcompanhamentoReprodutivo.findUnique({where:{id:demanda.id}})).toMatchObject({estado:"RESOLVIDA",exameResolucaoId:novo.itens[0].id});
  expect(await prisma.vinculoTarefaProtocolo.findFirst({where:{tarefaId:original.tarefaId,estado:"ATUAL"}})).toMatchObject({exameId:original.id});
  expect((await listarExamesTarefaClinica(original.tarefaId,f.sitio.id,{})).total).toBe(2);
  const anulacao=await previaAnulacao("avaliacoes",novo.itens[0].id,f.sitio.id);
  await anularFato("avaliacoes",novo.itens[0].id,{propriedadeId:f.sitio.id,chave:uuid(),fingerprint:anulacao.fingerprint,motivo:"Conclusão revisada pelo responsável"},null);
  expect(await prisma.demandaAcompanhamentoReprodutivo.findUnique({where:{id:demanda.id}})).toMatchObject({estado:"PENDENTE",exameResolucaoId:null});
  expect(await prisma.exameAnimal.findUnique({where:{id:original.id}})).toMatchObject({status:"VALIDO"});
 },60000);
 it("negativo com gestação conhecida bloqueia todo o conjunto antes de criar positivo para outro animal",async()=>{
  const f=await fixture("AVALIACAO",2);
  await criarAvaliacao({chave:uuid(),propriedadeId:f.sitio.id,animalId:f.itens[1].animalId,data,resultado:"POSITIVO",motivoVinculoDesconhecido:"Origem anterior documentada no teste"},null);
  const input:ExecucaoProtocoloInput={...f.input,itens:f.itens.map((i,n)=>({...i,tipo:"AVALIACAO" as const,resultado:n?"NEGATIVO" as const:"POSITIVO" as const,motivoVinculoDesconhecido:"Origem anterior documentada no teste"}))};
  await expect(preverExecucaoProtocolo(input)).rejects.toMatchObject({code:"VALIDACAO"});
  expect(await prisma.gestacaoAnimal.count({where:{animalId:f.itens[0].animalId}})).toBe(0);
  expect(await prisma.tarefaProtocolo.count({where:{id:{in:f.itens.map(i=>i.tarefaId)},...condicaoSituacaoTarefa("REALIZADA")}})).toBe(0);
 },45000);
 it("sexagem pode ser a primeira ação em gestante; inconclusivo conserva demanda e sexo observado resolve sem criar gestação adicional",async()=>{
  const f=await fixture("AVALIACAO",1,10,"SEXAGEM");
  const primeiro=await criarAvaliacao({chave:uuid(),propriedadeId:f.sitio.id,animalId:f.itens[0].animalId,data,resultado:"POSITIVO",motivoVinculoDesconhecido:"Diagnóstico anterior documentado"},null);
  const item={...f.itens[0],tipo:"AVALIACAO" as const,resultado:"INCONCLUSIVO" as const,finalidade:"SEXAGEM" as const,gestacaoId:primeiro.gestacaoId};
  const inconclusivo=await confirmar({...f.input,itens:[item]});
  const demanda=await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({where:{tarefaId:item.tarefaId}});
  expect(demanda).toMatchObject({estado:"PENDENTE",finalidade:"SEXAGEM",previstaPara:null});
  await confirmar({...f.input,itens:[{...item,reavaliacao:true,demandaAcompanhamentoId:demanda.id,resultado:"SEXAGEM",sexoFetal:"F"}]});
  expect(await prisma.demandaAcompanhamentoReprodutivo.findUnique({where:{id:demanda.id}})).toMatchObject({estado:"RESOLVIDA"});
  expect(await prisma.gestacaoAnimal.count({where:{animalId:item.animalId,status:"VALIDO"}})).toBe(1);
  expect(await prisma.gestacaoAnimal.findUnique({where:{id:primeiro.gestacaoId!}})).toMatchObject({sexoFetal:"F"});
  expect(await prisma.exameAnimal.findUnique({where:{id:inconclusivo.itens[0].id}})).toMatchObject({status:"VALIDO"});
 },60000);
 it("não realização legada não atende nas projeções Prisma/TS mesmo com realizadaEm",async()=>{
  const f=await fixture("EXAME",1);const item=f.itens[0];
  if(item.tipo!=="EXAME")throw new Error("Fixture incompatível");
  await prisma.exameAnimal.create({data:{animalId:item.animalId,propriedadeId:item.propriedadeId,data:new Date(data),tipoExameId:item.tipoExameId,tarefaId:item.tarefaId,realizacao:"NAO_REALIZADO",formatoSnapshot:{nome:"Legado",tipoResultado:"NUMERO"}}});
  await prisma.tarefaProtocolo.update({where:{id:item.tarefaId},data:{realizadaEm:new Date(data)}});
  const t=await prisma.tarefaProtocolo.findUniqueOrThrow({where:{id:item.tarefaId},include:{execucao:true,exames:true}});
  expect(situacaoTarefaComum(t)).toBe("PENDENTE");
  expect(await prisma.tarefaProtocolo.count({where:{id:item.tarefaId,...condicaoSituacaoTarefa("REALIZADA")}})).toBe(0);
  const consulta=await listarTarefasOperacao({programacaoId:f.grupo.id},f.sitio.id,consultaOperacaoSchema.parse({}),{dono:true,areas:[],flags:[]});
  expect(consulta.itens.find(t=>t.id===item.tarefaId)?.situacao).toBe("SEM_REGISTRO");
 },45000);
 it("pendência clínica compõe Pendentes sem transformar atendimento em falta e pagina14demandas em dez",async()=>{
  const f=await fixture("AVALIACAO",14);
  await confirmar(f.input);
  const demandas=await listarAcompanhamentosPaginados(f.sitio.id,{data,pagina:99,estado:"PENDENTE"});
  expect(demandas).toMatchObject({total:14,pagina:2,porPagina:10,resumo:{pendentes:14,semData:14}});
  expect(demandas.itens).toHaveLength(4);
  const tarefas=await listarTarefasOperacao({programacaoId:f.grupo.id},f.sitio.id,consultaOperacaoSchema.parse({situacao:"PENDENTES"}),{dono:true,areas:[],flags:[]});
  expect(tarefas.total).toBe(14);
  expect(tarefas.itens).toHaveLength(10);
  expect(tarefas.itens.every(t=>t.situacao==="ATENDIDO"&&t.acompanhamentoPendente&&t.acoes.reavaliar)).toBe(true);
  const cabecalho=await obterCabecalhoOperacao({programacaoId:f.grupo.id},f.sitio.id);
  expect(cabecalho.contagens).toMatchObject({atendidos:14,pendentes:14,animaisPendentes:14,pendenciasOperacionais:0,acompanhamentosPendentes:14});
 },90000);
});
