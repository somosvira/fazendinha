import { ConflitoAvaliacaoSanitaria } from "./concorrencia.js";
import { conflitoTransacaoPecuaria } from "../../transacao.js";
import { marcarReavaliacaoSanitariaTx } from "./cobertura.js";
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { dataCivil, diaCivil } from "./datas.calc.js";
import { avaliarRegraAnimalTx } from "./produtor.js";
import { reconciliarProgramacaoTx } from "../programacoes/continuidade.js";
import { avaliarProgramacaoTx } from "../programacoes/produtor.js";
import { RebanhoError } from "../../rebanho/regras.js";
type Cursor = { dia:string; fase:"REGRAS"|"RECONCILIAR_PROGRAMACOES"|"PROGRAMACOES"; origemId:string|null; animalId:string|null };
const TAMANHO_LOTE=50;
const LEASE_MS=60000;
export function novoCursor(dia:string):Cursor{return{dia,fase:"REGRAS",origemId:null,animalId:null};}
async function confirmarLoteComRetentativa<T>(db:PrismaClient, executar:(tx:Prisma.TransactionClient)=>Promise<T>) {
 for(let tentativa=1;;tentativa++) {
  try { return await db.$transaction(executar,{timeout:55000,isolationLevel:"ReadCommitted"}); }
  catch(erro) { if(tentativa>=3 || !(erro instanceof ConflitoAvaliacaoSanitaria || conflitoTransacaoPecuaria(erro))) throw erro; }
 }
}
/** Cada lote confirma fatos + checkpoint juntos; cliente pertence à invocação, não ao proxy HTTP. */
export async function avaliarAlertasTemporais(db:PrismaClient,agora=new Date(),maxLotes=20) {
 const posse=randomUUID();const hoje=dataCivil(diaCivil(agora));let lotes=0;
 try {
  while(lotes<maxLotes){
   const resultado=await confirmarLoteComRetentativa(db,async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('avaliacao-alertas-sanidade',0))`;
    const controle=await tx.avaliacaoAlertas.upsert({where:{id:"sanidade"},create:{id:"sanidade",produtor:"sanidade"},update:{}});
    if(controle.posse&&controle.posse!==posse&&controle.posseAte&&controle.posseAte>new Date())return"OCUPADO";
    if(controle.diaCoberto&&controle.diaCoberto>=hoje&&!controle.cursor)return"CONCLUIDO";
    let cursor:Cursor=controle.cursor?JSON.parse(controle.cursor) as Cursor:novoCursor(hoje.toISOString().slice(0,10));
    // Retomada conserva o dia interrompido; depois avalia o dia corrente sem inventar fatos retroativos.
    const dia=dataCivil(cursor.dia);
    await tx.avaliacaoAlertas.update({where:{id:"sanidade"},data:{posse,posseAte:new Date(Date.now()+LEASE_MS),estado:"EM_EXECUCAO",erro:null,versao:{increment:1}}});
    if(cursor.fase==="REGRAS"){
     const regra=await tx.regraAlertaSanitario.findFirst({where:{OR:[{ativo:true},{necessidades:{some:{alerta:{ciclo:"ABERTO"}}}}],...(cursor.origemId?{id:{gte:cursor.origemId}}:{})},orderBy:{id:"asc"}});
     if(!regra){cursor={...cursor,fase:"RECONCILIAR_PROGRAMACOES",origemId:null,animalId:null};}
     else {
      const cursorAnimal=regra.id===cursor.origemId?cursor.animalId:null;
      const elegiveis=regra.ativo?await tx.animal.findMany({where:{...(cursorAnimal?{id:{gt:cursorAnimal}}:{}),baixas:{none:{estornadaEm:null}},localizacoes:{some:{ate:null,propriedadeId:{in:regra.propriedadeIds}}}},select:{id:true},orderBy:{id:"asc"},take:TAMANHO_LOTE}):[];
      const abertas=await tx.necessidadeSanitaria.findMany({where:{regraId:regra.id,alerta:{ciclo:"ABERTO"},...(cursorAnimal?{animalId:{gt:cursorAnimal}}:{})},select:{animalId:true},orderBy:{animalId:"asc"},take:TAMANHO_LOTE});
      const animais=[...new Set([...elegiveis.map(a=>a.id),...abertas.map(n=>n.animalId)])].sort().slice(0,TAMANHO_LOTE).map(id=>({id}));
      for(const animal of animais)await avaliarRegraAnimalTx(tx,regra.id,animal.id,dia,{tecnico:"sanidade-temporal"});
      if(animais.length===TAMANHO_LOTE)cursor={...cursor,origemId:regra.id,animalId:animais.at(-1)!.id};
      else {const proxima=await tx.regraAlertaSanitario.findFirst({where:{OR:[{ativo:true},{necessidades:{some:{alerta:{ciclo:"ABERTO"}}}}],id:{gt:regra.id}},orderBy:{id:"asc"}});cursor=proxima?{...cursor,origemId:proxima.id,animalId:null}:{...cursor,fase:"RECONCILIAR_PROGRAMACOES",origemId:null,animalId:null};}
     }
    } else if(cursor.fase==="RECONCILIAR_PROGRAMACOES") {
     const programa=await tx.programacaoSanitaria.findFirst({where:{OR:[{ativo:true},{necessidades:{some:{situacao:{notIn:["REALIZADO","DISPENSADO","ENCERRADO"]}}}}],...(cursor.origemId?{id:{gte:cursor.origemId}}:{})},orderBy:{id:"asc"}});
     if(!programa)cursor={...cursor,fase:"PROGRAMACOES",origemId:null,animalId:null};
     else {
      const r=await reconciliarProgramacaoTx(tx,programa.id,dia,{tecnico:"sanidade-temporal"},programa.id===cursor.origemId?cursor.animalId??undefined:undefined);
      if(!r.concluido)cursor={...cursor,origemId:programa.id,animalId:r.cursorNecessidadeId};
      else {const proxima=await tx.programacaoSanitaria.findFirst({where:{OR:[{ativo:true},{necessidades:{some:{situacao:{notIn:["REALIZADO","DISPENSADO","ENCERRADO"]}}}}],id:{gt:programa.id}},orderBy:{id:"asc"}});cursor=proxima?{...cursor,origemId:proxima.id,animalId:null}:{...cursor,fase:"PROGRAMACOES",origemId:null,animalId:null};}
     }
    } else {
     const programa=await tx.programacaoSanitaria.findFirst({where:{ativo:true,...(cursor.origemId?{id:{gte:cursor.origemId}}:{})},orderBy:{id:"asc"}});
     if(programa){const r=await avaliarProgramacaoTx(tx,programa.id,dia,{tecnico:"sanidade-temporal"},programa.id===cursor.origemId?cursor.animalId??undefined:undefined);if(!r.concluido)cursor={...cursor,origemId:programa.id,animalId:r.cursorAnimalId};else{const proxima=await tx.programacaoSanitaria.findFirst({where:{ativo:true,id:{gt:programa.id}},orderBy:{id:"asc"}});if(proxima)cursor={...cursor,origemId:proxima.id,animalId:null};else cursor={...cursor,origemId:null,animalId:null};if(!proxima){await tx.avaliacaoAlertas.update({where:{id:"sanidade"},data:{diaCoberto:dia,ultimaConclusao:new Date(),cursor:null,estado:"CONCLUIDO",posse:null,posseAte:null}});return dia>=hoje?"CONCLUIDO":"RETOMAR_HOJE";}}}
     else {await tx.avaliacaoAlertas.update({where:{id:"sanidade"},data:{diaCoberto:dia,ultimaConclusao:new Date(),cursor:null,estado:"CONCLUIDO",posse:null,posseAte:null}});return dia>=hoje?"CONCLUIDO":"RETOMAR_HOJE";}
    }
    const alterado=await tx.avaliacaoAlertas.updateMany({where:{id:"sanidade",posse},data:{cursor:JSON.stringify(cursor),posseAte:new Date(Date.now()+LEASE_MS)}});
    if(alterado.count!==1)throw new RebanhoError("CONFLITO","A avaliação perdeu sua posse");
    return"CONTINUAR";
   });
   lotes++;
   if(resultado==="OCUPADO"||resultado==="CONCLUIDO")return{estado:resultado,lotes};
  }
  await db.avaliacaoAlertas.updateMany({where:{id:"sanidade",posse},data:{posse:null,posseAte:null}});
  return{estado:"PARCIAL",lotes};
 }catch(erro){await db.avaliacaoAlertas.updateMany({where:{id:"sanidade",OR:[{posse},{posse:null}]},data:{estado:"FALHA",erro:"Falha na avaliação sanitária",posse:null,posseAte:null}});throw erro;}
}

/** Sinalização leve e atômica com o evento do domínio. A mesma trava do lote impede perder dirty no checkpoint. */
export async function marcarReavaliacaoDestinoTx(tx:Prisma.TransactionClient,_destino:{produtoId:string}|{protocoloId:string}|{tipoExameId:string},_usuarioId:number|null) {
 await marcarReavaliacaoSanitariaTx(tx);
}
