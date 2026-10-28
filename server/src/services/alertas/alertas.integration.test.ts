import { darBaixa } from "../pecuaria/rebanho/animais.js";
import * as produtorSanitario from "../pecuaria/sanidade/alertas/produtor.js";
import { basePreviaTx,ativarRegraTx } from "../pecuaria/sanidade/alertas/regras.js";
import { avaliarRegraAnimalTx } from "../pecuaria/sanidade/alertas/produtor.js";
import { beforeAll,afterAll,describe,it,expect,vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../lib/banco-pecuaria-integration.fixture.js";
import { publicarAlertaTx } from "./publicacao.js";
import { consultaAlertasSchema,consultarAlertas,consultarParticipantes } from "../pecuaria/sanidade/alertas/consulta-alertas.js";
import type { PublicacaoAlerta } from "./contratos.js";
const habilitado=process.env.PECUARIA_DB_INTEGRATION==="1";
const marca=`alertas-test-${randomUUID()}`;
const idsAlerta:string[]=[];const idsAnimal:string[]=[];
let sitioId:number;let usuarioId:number;let produtoId:string;let regraId:string;
const hoje=new Date("2026-10-28T12:00:00Z");
function entrada(chave:string,revisao=1,extra:Partial<PublicacaoAlerta>={}):PublicacaoAlerta{return{proprietario:marca,produtor:"sanidade",tipo:"DATA_FIXA",versaoContrato:1,chaveOcorrencia:chave,revisaoOrigem:revisao,eventoId:`${chave}:${revisao}`,comando:"PUBLICAR",origemId:marca,sujeitoTipo:"ANIMAL",sujeitoId:marca,propriedadeId:null,chaveAgrupamento:marca,titulo:"Cuidado fictício",motivo:"Fixture isolada",situacao:"PENDENTE",resumo:{regraId:marca,revisaoRegra:1,produtoId:null,produtoNome:null,protocoloId:null,animalId:marca,brinco:marca,nome:null,nascimentoEstimado:false,dataNascimento:"2026-01-01"},...extra};}
/** Escritas só em IDs criados pelo próprio arquivo. Não altera seed, saldos ou fatos preexistentes. */
describe.skipIf(!habilitado)("alertas persistidos — integração restrita",()=>{
 beforeAll(async()=>{
  const bancoEsperado=exigirBancoIntegracaoPecuaria();
  for(const variavel of ["DATABASE_URL","DIRECT_URL"]){
   const url=new URL(process.env[variavel]??"");
   if(url.pathname!==`/${bancoEsperado}`||!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error(`Integração exige PostgreSQL ${bancoEsperado} neste ambiente`);
  }
  const banco=await prisma.$queryRaw<Array<{nome:string}>>`SELECT current_database()::text nome`;
  if(banco[0]?.nome!==bancoEsperado)throw new Error("Banco efetivo inesperado");
  const u=await prisma.usuario.create({data:{nome:marca,email:`${marca}@example.invalid`,papel:"proprietario",abas:["cadastros"],areas:["pecuaria"],flags:["lancar"],status:"ATIVO"}});usuarioId=u.id;
  const s=await prisma.propriedade.create({data:{nome:marca}});sitioId=s.id;
  const p=await prisma.produto.create({data:{nome:marca,usoSanitario:true}});produtoId=p.id;
  const regra=await prisma.regraAlertaSanitario.create({data:{nome:marca,produtoId,gatilho:"DATA_FIXA",dataFixa:new Date("2026-10-28"),propriedadeIds:[sitioId],vigencia:new Date("2026-10-28"),criadoPorId:usuarioId}});regraId=regra.id;
 },30000);
 afterAll(async()=>{
  if(regraId){const ns=await prisma.necessidadeSanitaria.findMany({where:{regraId},select:{alertaId:true}});idsAlerta.push(...ns.flatMap(n=>n.alertaId?[n.alertaId]:[]));await prisma.necessidadeSanitaria.deleteMany({where:{regraId}});}
  const proprios=await prisma.alerta.findMany({where:{proprietario:marca},select:{id:true}});idsAlerta.push(...proprios.map(a=>a.id));
  await prisma.eventoAlerta.deleteMany({where:{alertaId:{in:idsAlerta}}});await prisma.alerta.deleteMany({where:{id:{in:idsAlerta}}});
  if(idsAnimal.length){await prisma.auditoriaPecuaria.deleteMany({where:{animalId:{in:idsAnimal}}});await prisma.baixaAnimal.deleteMany({where:{animalId:{in:idsAnimal}}});await prisma.localizacaoAnimal.deleteMany({where:{animalId:{in:idsAnimal}}});await prisma.animal.deleteMany({where:{id:{in:idsAnimal}}});}
  if(regraId)await prisma.regraAlertaSanitario.delete({where:{id:regraId}});
  if(produtoId)await prisma.produto.delete({where:{id:produtoId}});
  if(sitioId)await prisma.propriedade.delete({where:{id:sitioId}});
  if(usuarioId)await prisma.usuario.delete({where:{id:usuarioId}});
 },30000);
 it("publicação concorrente recupera mesma identidade e revisão com snapshot imutável",async()=>{
  const e=entrada("concorrente");const resultados=await Promise.all([1,2].map(()=>prisma.$transaction(tx=>publicarAlertaTx(tx,e,{tecnico:marca}))));expect(resultados[0].alertaId).toBe(resultados[1].alertaId);
  const id=resultados[0].alertaId;const original=await prisma.alerta.findUniqueOrThrow({where:{id}});
  await prisma.$transaction(tx=>publicarAlertaTx(tx,entrada("concorrente",2,{titulo:"Título atualizado"}),{tecnico:marca}));
  expect((await prisma.alerta.findUniqueOrThrow({where:{id}})).snapshotInicial).toEqual(original.snapshotInicial);
  await expect(prisma.$transaction(tx=>publicarAlertaTx(tx,entrada("concorrente",2,{titulo:"Outro conteúdo"}),{tecnico:marca}))).rejects.toThrow("outro conteúdo");
  await prisma.$transaction(tx=>publicarAlertaTx(tx,entrada("concorrente",3,{comando:"ENCERRAR",situacao:"DISPENSADO"}),{tecnico:marca}));
  await expect(prisma.$transaction(tx=>publicarAlertaTx(tx,entrada("concorrente",4),{tecnico:marca}))).rejects.toThrow("Reabrir");
  await prisma.$transaction(tx=>publicarAlertaTx(tx,entrada("concorrente",4,{comando:"REABRIR",situacao:"NECESSITA_REVISAO"}),{tecnico:marca}));
 });
 it("rollback da transação elimina publicação e evento juntos",async()=>{
  await expect(prisma.$transaction(async tx=>{await publicarAlertaTx(tx,entrada("rollback"),{tecnico:marca});throw new Error("falha posterior");})).rejects.toThrow("falha posterior");
  expect(await prisma.alerta.count({where:{proprietario:marca,chaveOcorrencia:"rollback"}})).toBe(0);
 });
 it("SQL agrupa 561 participantes antes de paginar; projeção de um encerrado preserva 560",async()=>{
  const data=new Date("2026-10-28");
  for(let i=0;i<561;i++)idsAnimal.push(randomUUID());
  await prisma.animal.createMany({data:idsAnimal.map((id,i)=>({id,brinco:`${marca}-${String(i).padStart(3,"0")}`,sexo:"F",dataNascimento:new Date("2026-01-01"),origem:"NASCIDO",dataEntrada:new Date("2026-01-01")}))});
  await prisma.localizacaoAnimal.createMany({data:idsAnimal.map(animalId=>({animalId,propriedadeId:sitioId,desde:new Date("2026-01-01")}))});
  const grupo=`${marca}-grupo`;
  const alertas=idsAnimal.map((animalId,i)=>{const id=randomUUID();idsAlerta.push(id);return{id,proprietario:"fazendinha",produtor:"sanidade",tipo:"DATA_FIXA",chaveOcorrencia:`${marca}:${animalId}`,revisao:1,ciclo:"ABERTO",situacao:"PENDENTE",propriedadeId:sitioId,origemId:marca,sujeitoTipo:"ANIMAL",sujeitoId:animalId,chaveAgrupamento:grupo,titulo:"Aplicar fixture",motivo:marca,resumo:{regraId,produtoId,produtoNome:marca},snapshotInicial:{fixture:marca},dataReferencia:data,prazo:data};});
  await prisma.alerta.createMany({data:alertas});
  await prisma.necessidadeSanitaria.createMany({data:alertas.map(a=>({id:randomUUID(),regraId,animalId:a.sujeitoId,alertaId:a.id,revisaoRegra:1,propriedadeId:sitioId,situacao:"PENDENTE",adocao:data}))});
  const filtro=consultaAlertasSchema.parse({regraId,tamanho:1});const consulta=await consultarAlertas(sitioId,filtro,hoje);expect(consulta.total).toBe(1);expect(consulta.itens[0].necessidades).toBe(561);expect(consulta.totaisFiltrados.animais).toBe(561);
  expect((await consultarParticipantes(sitioId,grupo,consultaAlertasSchema.parse({regraId,tamanho:20}),hoje)).total).toBe(561);
  await prisma.alerta.update({where:{id:alertas[0].id},data:{ciclo:"ENCERRADO",situacao:"REALIZADO"}});
  expect((await consultarAlertas(sitioId,filtro,hoje)).itens[0].necessidades).toBe(560);
  expect((await consultarAlertas(sitioId,consultaAlertasSchema.parse({regraId,disposicao:"HISTORICO"}),hoje)).totaisFiltrados.necessidades).toBe(1);
 },30000);
 it("regra→prévia→ativação→necessidade exige nova conferência e não fabrica atraso anterior",async()=>{
  const regraTeste=randomUUID();const animalTeste=randomUUID();
  await expect(prisma.$transaction(async tx=>{
   // Toda esta fatia, inclusive checkpoint global tocado pela ativação, é revertida ao fim.
   await tx.perfilSanitarioProduto.create({data:{produtoId}});
   const r=await tx.regraAlertaSanitario.create({data:{id:regraTeste,nome:`${marca}-adocao`,produtoId,gatilho:"IDADE",idadeMeses:6,propriedadeIds:[sitioId],vigencia:new Date("2026-10-28"),criadoPorId:usuarioId}});
   await tx.revisaoRegraAlertaSanitario.create({data:{regraId:r.id,revisao:1,dados:JSON.parse(JSON.stringify(r)),motivo:"Fixture transacional",autorId:usuarioId}});
   await tx.animal.create({data:{id:animalTeste,brinco:`${marca}-adocao`,sexo:"F",dataNascimento:new Date("2025-01-31"),origem:"NASCIDO",dataEntrada:new Date("2025-01-31")}});
   await tx.localizacaoAnimal.create({data:{animalId:animalTeste,propriedadeId:sitioId,desde:new Date("2025-01-31")}});
   const p=await basePreviaTx(tx,r.id,new Date("2026-10-28"));
   await tx.animal.update({where:{id:animalTeste},data:{nome:"Mudou durante a conferência"}});
   await expect(ativarRegraTx(tx,r.id,{base:p.base,revisao:1},usuarioId,hoje)).rejects.toThrow("nova prévia");
   const atual=await basePreviaTx(tx,r.id,new Date("2026-10-28"));
   await ativarRegraTx(tx,r.id,{base:atual.base,revisao:1},usuarioId,hoje);
   await ativarRegraTx(tx,r.id,{base:atual.base,revisao:1},usuarioId,hoje);
   const n=await avaliarRegraAnimalTx(tx,r.id,animalTeste,new Date("2026-10-28"),{usuarioId});
   expect(n?.situacao).toBe("CONFERENCIA_INICIAL");
   const a=await tx.alerta.findUniqueOrThrow({where:{id:n!.alertaId??(await tx.necessidadeSanitaria.findUniqueOrThrow({where:{id:n!.id}})).alertaId!}});
   expect(a.prazo).toBeNull();expect(a.dataReferencia?.toISOString().slice(0,10)).toBe("2025-07-31");
   expect(await tx.aplicacaoProduto.count({where:{animalId:animalTeste}})).toBe(0);
   throw new Error("ROLLBACK_FIXTURE_APROVADA");
  },{timeout:30000})).rejects.toThrow("ROLLBACK_FIXTURE_APROVADA");
  expect(await prisma.regraAlertaSanitario.count({where:{id:regraTeste}})).toBe(0);
  expect(await prisma.animal.count({where:{id:animalTeste}})).toBe(0);
 },30000);

 it("cadastro indevido é baixa lógica: rollback preserva local; sucesso preserva alerta e evidência",async()=>{
  const animalId=randomUUID();idsAnimal.push(animalId);
  await prisma.animal.create({data:{id:animalId,brinco:`${marca}-indevido`,sexo:"F",dataNascimento:new Date("2026-01-01"),origem:"NASCIDO",dataEntrada:new Date("2026-01-01")}});
  await prisma.localizacaoAnimal.create({data:{animalId,propriedadeId:sitioId,desde:new Date("2026-01-01")}});
  const n=await prisma.necessidadeSanitaria.create({data:{regraId,animalId,revisaoRegra:1,propriedadeId:sitioId,situacao:"PENDENTE",dataTeorica:new Date("2026-10-28"),dataAtencao:new Date("2026-10-28"),adocao:new Date("2026-10-28")}});
  const publicado=await prisma.$transaction(tx=>produtorSanitario.publicarNecessidadeTx(tx,n.id,{usuarioId}));
  idsAlerta.push(publicado.alertaId);
  const antes=await prisma.alerta.findUniqueOrThrow({where:{id:publicado.alertaId}});
  const falha=vi.spyOn(produtorSanitario,"publicarNecessidadeTx").mockRejectedValueOnce(new Error("FALHA_PUBLICACAO_BAIXA"));
  try {await expect(darBaixa({animalId,data:"2026-10-28",tipo:"CADASTRO_INDEVIDO"},usuarioId,sitioId)).rejects.toThrow("FALHA_PUBLICACAO_BAIXA");} finally {falha.mockRestore();}
  expect(await prisma.baixaAnimal.count({where:{animalId}})).toBe(0);
  expect(await prisma.localizacaoAnimal.count({where:{animalId,ate:null}})).toBe(1);
  await darBaixa({animalId,data:"2026-10-28",tipo:"CADASTRO_INDEVIDO"},usuarioId,sitioId);
  expect(await prisma.animal.count({where:{id:animalId}})).toBe(1);
  expect(await prisma.baixaAnimal.count({where:{animalId,tipo:"CADASTRO_INDEVIDO"}})).toBe(1);
  const depois=await prisma.alerta.findUniqueOrThrow({where:{id:publicado.alertaId}});
  expect(depois.ciclo).toBe("ENCERRADO");expect(depois.snapshotInicial).toEqual(antes.snapshotInicial);
  expect(await prisma.eventoAlerta.count({where:{alertaId:depois.id}})).toBe(2);
 },30000);

});
