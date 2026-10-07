import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { criarProtocolo, publicarProtocolo, iniciarExecucao } from "./protocolos.js";
import { criarTipoExame, registrarExame } from "./exames.js";
import { criarRodada, preverRodada, listarParticipantes, listarEtapas, retirarParticipante, adicionarParticipantes, associarExecucoes, listarTarefasEtapa, listarRodadas } from "./rodadas.js";
import { consultaSanitariaSchema } from "./consulta.js";
const suite=process.env.PECUARIA_DB_INTEGRATION==="1"?describe:describe.skip;
const run=crypto.randomUUID();let propriedadeId:number;let protocoloId:string;let tipoExameId:string;const animais:string[]=[];
const filtro=consultaSanitariaSchema.parse({porPagina:1});
afterAll(async()=>{if(!propriedadeId)return;await prisma.requisicaoPecuaria.deleteMany({where:{propriedadeId}});await prisma.auditoriaPecuaria.deleteMany({where:{OR:[{propriedadeId},{animalId:{in:animais}},{entidadeId:{in:[protocoloId,tipoExameId]}}]}});await prisma.exameAnimal.deleteMany({where:{animalId:{in:animais}}});await prisma.tarefaSanitaria.deleteMany({where:{execucao:{animalId:{in:animais}}}});await prisma.execucaoProtocoloSanitario.deleteMany({where:{animalId:{in:animais}}});await prisma.rodadaProtocoloSanitario.deleteMany({where:{propriedadeId}});await prisma.etapaProtocoloSanitario.deleteMany({where:{protocoloId}});await prisma.protocoloSanitario.delete({where:{id:protocoloId}});await prisma.tipoExame.delete({where:{id:tipoExameId}});await prisma.destinoAnimal.deleteMany({where:{animalId:{in:animais}}});await prisma.localizacaoAnimal.deleteMany({where:{animalId:{in:animais}}});await prisma.animal.deleteMany({where:{id:{in:animais}}});await prisma.propriedade.delete({where:{id:propriedadeId}});});
suite("rodadas preservam calendário, participação e reenvio",()=>{
 beforeAll(async()=>{propriedadeId=(await prisma.propriedade.create({data:{nome:`Rodada ${run}`}})).id;for(let n=0;n<3;n++)animais.push((await cadastrar(cadastrarAnimalSchema.parse({brinco:`R${n}${run.slice(0,7)}`,sexo:"F",origem:"COMPRADO",aptidao:"LEITE",dataNascimento:"2024-01-01",dataEntrada:"2026-08-01",propriedadeId}),null)).id);tipoExameId=(await criarTipoExame({nome:`Rodada exame ${run}`,tipoResultado:"TEXTO"},null)).id;protocoloId=(await criarProtocolo({nome:`Rodada protocolo ${run}`,etapas:[{tipo:"EXAME",tipoExameId,diaRelativo:0},{tipo:"EXAME",tipoExameId,diaRelativo:7}]},null)).id;await publicarProtocolo(protocoloId,null);});
 const input=()=>({chave:crypto.randomUUID(),propriedadeId,nome:"Rodada de teste",protocoloId,inicioReferencia:"2026-09-01",itens:[{animalId:animais[0]},{animalId:animais[1]}]});
 it("prévia não cria fatos; confirmação é idempotente e pagina participantes",async()=>{const b=input();const p=await preverRodada(b);expect(p.itens[0].tarefas.map(t=>t.previstaPara)).toEqual(["2026-09-01","2026-09-08"]);expect(await prisma.execucaoProtocoloSanitario.count({where:{propriedadeId}})).toBe(0);const r=await criarRodada(b,null);expect((await criarRodada(b,null)).id).toBe(r.id);await expect(criarRodada({...b,nome:"Mudou"},null)).rejects.toMatchObject({code:"CONFLITO"});const ps=await listarParticipantes(r.id,propriedadeId,filtro);expect(ps.total).toBe(2);expect(ps.itens).toHaveLength(1);expect(r.contagens.total).toBe(4);expect(await prisma.exameAnimal.count({where:{propriedadeId}})).toBe(0);});
 it("retirada preserva fato realizado; reentrada cria calendário novo",async()=>{const r=await prisma.rodadaProtocoloSanitario.findFirstOrThrow({where:{propriedadeId}});const e=await prisma.execucaoProtocoloSanitario.findFirstOrThrow({where:{rodadaId:r.id,animalId:animais[0]},include:{tarefas:{orderBy:{previstaPara:"asc"}}}});const fato=await registrarExame({animalId:animais[0],propriedadeId,tipoExameId,tarefaId:e.tarefas[0].id,data:"2026-09-01"},null);const b={chave:crypto.randomUUID(),propriedadeId,motivo:"Retirada do manejo coletivo"};await retirarParticipante(r.id,e.id,b,null);await retirarParticipante(r.id,e.id,b,null);expect((await prisma.exameAnimal.findUniqueOrThrow({where:{id:fato.id}})).status).toBe("VALIDO");expect((await listarEtapas(r.id,propriedadeId,consultaSanitariaSchema.parse({}))).itens[0].contagens.realizadas).toBe(1);await adicionarParticipantes(r.id,{chave:crypto.randomUUID(),propriedadeId,itens:[{animalId:animais[0],inicio:"2026-09-10",justificativaInicio:"Animal reincluído em nova data"}]},null);const execs=await prisma.execucaoProtocoloSanitario.findMany({where:{rodadaId:r.id,animalId:animais[0]}});expect(execs).toHaveLength(2);expect(execs.filter(x=>!x.canceladaEm)).toHaveLength(1);});
 it("inclusão inválida não grava parcialmente",async()=>{const r=await prisma.rodadaProtocoloSanitario.findFirstOrThrow({where:{propriedadeId}});const antes=await prisma.execucaoProtocoloSanitario.count({where:{rodadaId:r.id}});await expect(adicionarParticipantes(r.id,{chave:crypto.randomUUID(),propriedadeId,itens:[{animalId:animais[2]},{animalId:animais[1]}]},null)).rejects.toMatchObject({code:"CONFLITO"});expect(await prisma.execucaoProtocoloSanitario.count({where:{rodadaId:r.id}})).toBe(antes);});
 it("associação explícita mantém tarefas e datas da execução antiga",async()=>{const e=await iniciarExecucao({animalId:animais[2],propriedadeId,protocoloId,inicio:"2026-09-03"},null);const r=await prisma.rodadaProtocoloSanitario.findFirstOrThrow({where:{propriedadeId}});await associarExecucoes(r.id,{chave:crypto.randomUUID(),propriedadeId,execucaoIds:[e.id]},null);const depois=await prisma.execucaoProtocoloSanitario.findUniqueOrThrow({where:{id:e.id},include:{tarefas:{orderBy:{previstaPara:"asc"}}}});expect(depois.inicio).toEqual(e.inicio);expect(depois.tarefas.map(t=>t.id)).toEqual(e.tarefas.map(t=>t.id));});
 it("rodada maior que 100 pagina sem duplicação e confirma por subconjuntos",async()=>{
   const ids=Array.from({length:101},()=>crypto.randomUUID());animais.push(...ids);
   await prisma.animal.createMany({data:ids.map((id,n)=>({id,brinco:`Grande${n}${run.slice(0,6)}`,sexo:"F",origem:"COMPRADO",dataNascimento:new Date("2024-01-01"),dataEntrada:new Date("2026-08-01")}))});
   await prisma.localizacaoAnimal.createMany({data:ids.map(animalId=>({animalId,propriedadeId,desde:new Date("2026-08-01")}))});
   const b={...input(),itens:ids.map(animalId=>({animalId}))};
   await expect(criarRodada(b,null)).rejects.toThrow();
   const r=await criarRodada({...b,itens:b.itens.slice(0,100)},null);
   await adicionarParticipantes(r.id,{chave:crypto.randomUUID(),propriedadeId,itens:b.itens.slice(100)},null);
   const p1=await listarParticipantes(r.id,propriedadeId,consultaSanitariaSchema.parse({porPagina:100}));
   const p2=await listarParticipantes(r.id,propriedadeId,consultaSanitariaSchema.parse({porPagina:100,pagina:2}));
   expect(p1.total).toBe(101);expect(new Set([...p1.itens,...p2.itens].map(e=>e.id)).size).toBe(101);
   const etapas=await listarEtapas(r.id,propriedadeId,consultaSanitariaSchema.parse({porPagina:1}));expect(etapas.total).toBe(2);expect(etapas.itens[0].contagens.pendentes).toBe(101);
   const tarefas=await listarTarefasEtapa(r.id,etapas.itens[0].id,propriedadeId,consultaSanitariaSchema.parse({porPagina:100,pagina:2}));expect(tarefas.total).toBe(101);expect(tarefas.itens).toHaveLength(1);
 });
 it("filtros de tarefa restringem rodadas antes da paginação",async()=>{
   const vazias=await listarRodadas(propriedadeId,consultaSanitariaSchema.parse({de:"2027-01-01",porPagina:1}));expect(vazias.total).toBe(0);
   const realizadas=await listarRodadas(propriedadeId,consultaSanitariaSchema.parse({situacao:"REALIZADA",porPagina:1}));expect(realizadas.total).toBe(1);
   const resultado=await listarRodadas(propriedadeId,consultaSanitariaSchema.parse({buscaAnimal:`R0${run.slice(0,7)}`,porPagina:1}));expect(resultado.total).toBe(1);
   const participantes=await listarParticipantes(resultado.itens[0].id,propriedadeId,consultaSanitariaSchema.parse({animalId:animais[0]}));expect(participantes.itens[0].propriedadeAtualId).toBe(propriedadeId);
 });
 it("duas inclusões concorrentes não criam duas participações ativas",async()=>{
   const r=await prisma.rodadaProtocoloSanitario.findFirstOrThrow({where:{propriedadeId},orderBy:{criadoEm:"asc"}});
   const e=await prisma.execucaoProtocoloSanitario.findFirstOrThrow({where:{rodadaId:r.id,animalId:animais[2]}});
   await retirarParticipante(r.id,e.id,{chave:crypto.randomUUID(),propriedadeId,motivo:"Preparar reentrada simultânea"},null);
   const incluir=()=>adicionarParticipantes(r.id,{chave:crypto.randomUUID(),propriedadeId,itens:[{animalId:animais[2]}]},null);
   const resultados=await Promise.allSettled([incluir(),incluir()]);expect(resultados.filter(r=>r.status==="fulfilled")).toHaveLength(1);
   expect(await prisma.execucaoProtocoloSanitario.count({where:{rodadaId:r.id,animalId:animais[2],canceladaEm:null}})).toBe(1);
 });
 it("baixa não esconde histórico e permite encerrar participação sem reativar animal",async()=>{
   const local=await prisma.localizacaoAnimal.findFirstOrThrow({where:{animalId:animais[1],ate:null}});
   const e=await prisma.execucaoProtocoloSanitario.findFirstOrThrow({where:{animalId:animais[1],canceladaEm:null,rodadaId:{not:null}}});
   const baixa=await prisma.baixaAnimal.create({data:{animalId:animais[1],data:new Date("2026-10-01"),tipo:"VENDA",localizacaoFechadaId:local.id}});
   try {
     await prisma.localizacaoAnimal.update({where:{id:local.id},data:{ate:new Date("2026-10-01")}});
     const ps=await listarParticipantes(e.rodadaId!,propriedadeId,consultaSanitariaSchema.parse({animalId:animais[1]}));
     expect(ps.itens).toHaveLength(1);expect(ps.itens[0].propriedadeAtualId).toBeNull();expect(ps.itens[0].propriedadeContextoId).toBe(propriedadeId);
     await retirarParticipante(e.rodadaId!,e.id,{chave:crypto.randomUUID(),propriedadeId,motivo:"Animal já saiu do rebanho"},null);
     expect((await prisma.baixaAnimal.findUniqueOrThrow({where:{id:baixa.id}})).estornadaEm).toBeNull();
     expect(await prisma.localizacaoAnimal.count({where:{animalId:animais[1],ate:null}})).toBe(0);
     expect((await listarParticipantes(e.rodadaId!,propriedadeId,consultaSanitariaSchema.parse({animalId:animais[1]}))).itens[0].canceladaEm).not.toBeNull();
   } finally { await prisma.baixaAnimal.delete({where:{id:baixa.id}}); }
 });
});
