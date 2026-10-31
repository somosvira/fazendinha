import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../../lib/banco-pecuaria-integration.fixture.js";
import { travarAnimais, hojeFazendaDate } from "../../rebanho/regras.js";
import { avaliarRegraAnimalTx } from "./produtor.js";
import { inativarRegra } from "./regras.js";
import { travarConfiguracaoAlertaTx } from "./concorrencia.js";
const executar=process.env.PECUARIA_DB_INTEGRATION==="1";
const marca=`concorrencia-alerta-${randomUUID()}`;
let sitio:number|undefined,usuario:number|undefined,produto:string|undefined,animal:string|undefined;
const regras:string[]=[];
const hoje=hojeFazendaDate();
function sinal(){let liberar!:()=>void;const promessa=new Promise<void>(resolve=>{liberar=resolve});return {promessa,liberar};}
async function regra(){const r=await prisma.regraAlertaSanitario.create({data:{nome:marca,produtoId:produto!,gatilho:"DATA_FIXA",dataFixa:hoje,vigencia:hoje,adocao:hoje,ativo:true,sexo:"F",propriedadeIds:[sitio!],criadoPorId:usuario!}});regras.push(r.id);await prisma.revisaoRegraAlertaSanitario.create({data:{regraId:r.id,revisao:r.revisao,dados:JSON.parse(JSON.stringify(r)),motivo:"Configuração da fixture",autorId:usuario!}});return r;}
/** Somente fixtures próprias; não executa avaliador global, seed, migration ou limpeza de outros IDs. */
describe.skipIf(!executar)("serialização sanitária — advisory locks reais",()=>{
 beforeAll(async()=>{
  const banco=exigirBancoIntegracaoPecuaria();
  if(process.env.DIRECT_URL){const url=new URL(process.env.DIRECT_URL);if(url.pathname!==`/${banco}`||!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("DIRECT_URL fora da base autorizada");}
  const [atual]=await prisma.$queryRaw<Array<{banco:string}>>`SELECT current_database()::text banco`;
  if(atual?.banco!==banco)throw new Error("Banco efetivo fora do autorizado");
  sitio=(await prisma.propriedade.create({data:{nome:marca}})).id;
  usuario=(await prisma.usuario.create({data:{nome:marca,email:`${marca}@example.test`,papel:"DONO",dono:true,abas:[],flags:[],status:"ATIVO"}})).id;
  produto=(await prisma.produto.create({data:{nome:marca,usoSanitario:true,unidade:"ML"}})).id;
  animal=(await prisma.animal.create({data:{brinco:marca,sexo:"F",origem:"COMPRADO",dataNascimento:new Date("2024-01-01Z"),dataEntrada:new Date("2025-01-01Z")}})).id;
  await prisma.localizacaoAnimal.create({data:{animalId:animal,propriedadeId:sitio,desde:new Date("2025-01-01Z")}});
 },30000);
 afterAll(async()=>{
  if(!sitio)return;
  const ns=await prisma.necessidadeSanitaria.findMany({where:{regraId:{in:regras}},select:{id:true,alertaId:true}});
  const alertas=ns.flatMap(n=>n.alertaId?[n.alertaId]:[]);
  await prisma.eventoAlerta.deleteMany({where:{alertaId:{in:alertas}}});
  await prisma.necessidadeSanitaria.deleteMany({where:{regraId:{in:regras}}});
  await prisma.alerta.deleteMany({where:{id:{in:alertas}}});
  await prisma.revisaoRegraAlertaSanitario.deleteMany({where:{regraId:{in:regras}}});
  await prisma.regraAlertaSanitario.deleteMany({where:{id:{in:regras}}});
  await prisma.auditoriaPecuaria.deleteMany({where:{OR:[{entidadeId:{in:[...regras,...ns.map(n=>n.id)]}},...(animal?[{animalId:animal}]:[])]}});
  if(animal){await prisma.localizacaoAnimal.deleteMany({where:{animalId:animal}});await prisma.animal.delete({where:{id:animal}});}
  if(produto)await prisma.produto.delete({where:{id:produto}});
  await prisma.propriedade.delete({where:{id:sitio}});
  if(usuario)await prisma.usuario.delete({where:{id:usuario}});
 },30000);
 it("configuração em alteração recusa publicação e nova transação relê inativação",async()=>{
  const r=await regra(),adquirida=sinal(),soltar=sinal();
  const escrita=prisma.$transaction(async tx=>{
   await travarConfiguracaoAlertaTx(tx,"regra",r.id);adquirida.liberar();await soltar.promessa;
   await tx.regraAlertaSanitario.update({where:{id:r.id},data:{ativo:false}});
  });
  await adquirida.promessa;
  try{await expect(prisma.$transaction(tx=>avaliarRegraAnimalTx(tx,r.id,animal!,hoje,{usuarioId:usuario!}))).rejects.toMatchObject({code:"CONFLITO"});}
  finally{soltar.liberar();await escrita;}
  expect(await prisma.$transaction(tx=>avaliarRegraAnimalTx(tx,r.id,animal!,hoje,{usuarioId:usuario!}))).toBeNull();
  expect(await prisma.necessidadeSanitaria.count({where:{regraId:r.id}})).toBe(0);
 });
 it("trava operacional do animal impede publicação com cadastro anterior à correção",async()=>{
  const r=await regra(),adquirida=sinal(),soltar=sinal();
  const escrita=prisma.$transaction(async tx=>{
   await travarAnimais(tx,[animal!]);adquirida.liberar();await soltar.promessa;
   await tx.animal.update({where:{id:animal!},data:{sexo:"M"}});
  });
  await adquirida.promessa;
  try{await expect(prisma.$transaction(tx=>avaliarRegraAnimalTx(tx,r.id,animal!,hoje,{usuarioId:usuario!}))).rejects.toMatchObject({code:"CONFLITO"});}
  finally{soltar.liberar();await escrita;}
  expect(await prisma.$transaction(tx=>avaliarRegraAnimalTx(tx,r.id,animal!,hoje,{usuarioId:usuario!}))).toBeNull();
  expect(await prisma.necessidadeSanitaria.count({where:{regraId:r.id}})).toBe(0);
  await prisma.animal.update({where:{id:animal!},data:{sexo:"F"}});
 });
 it("inativação iniciada durante primeira publicação espera e encerra a necessidade confirmada",async()=>{
  const r=await regra(),publicada=sinal(),soltar=sinal();
  const producao=prisma.$transaction(async tx=>{
   const n=await avaliarRegraAnimalTx(tx,r.id,animal!,hoje,{usuarioId:usuario!});publicada.liberar();await soltar.promessa;return n;
  },{timeout:10000});
  await publicada.promessa;
  const inativacao=inativarRegra(r.id,{revisao:1,destinoAbertas:"ENCERRAR",motivo:"Encerramento concorrente de fixture"},usuario!);
  let aguardando=false;
  try{
   for(let tentativa=0;tentativa<100&&!aguardando;tentativa++){
    const [linha]=await prisma.$queryRaw<Array<{aguardando:boolean}>>`
     SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted
      AND classid::bigint=((hashtextextended(${`regra:${r.id}`},0)>>32)&4294967295)
      AND objid::bigint=(hashtextextended(${`regra:${r.id}`},0)&4294967295)) AS aguardando`;
    aguardando=linha.aguardando;if(!aguardando)await new Promise(resolve=>setTimeout(resolve,10));
   }
   expect(aguardando).toBe(true);
  }finally{soltar.liberar();await Promise.all([producao,inativacao]);}
  const n=await prisma.necessidadeSanitaria.findUniqueOrThrow({where:{regraId_animalId:{regraId:r.id,animalId:animal!}}});
  expect(n.situacao).toBe("ENCERRADO");
  expect(await prisma.alerta.findUnique({where:{id:n.alertaId!}})).toMatchObject({ciclo:"ENCERRADO",situacao:"ENCERRADO"});
 },15000);
});
