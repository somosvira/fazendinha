import { marcarReavaliacaoSanitariaTx } from "./cobertura.js";
import { idadeEmMeses, idadeNaFaixa } from "../../rebanho/categoria.calc.js";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../db.js";
import { RebanhoError, auditar } from "../../rebanho/regras.js";
import { hashConteudo } from "../../../alertas/publicacao.js";
import { alcanceIdade, avaliarPrazo, dataCivil, diaCivil } from "./datas.calc.js";
import { avaliarRegraAnimalTx, publicarNecessidadeTx } from "./produtor.js";
export const regraAlertaSchema=z.object({nome:z.string().trim().min(2).max(160),idadeMinimaMeses:z.number().int().min(0).max(1200).nullable().default(null),idadeMaximaMeses:z.number().int().min(0).max(1200).nullable().default(null),tipoAplicacaoId:z.string().uuid().nullable().default(null),cuidado:z.string().trim().max(160).nullable().default(null),produtoId:z.string().uuid().nullable().default(null),protocoloId:z.string().uuid().nullable().default(null),gatilho:z.enum(["IDADE","DATA_FIXA"]),idadeMeses:z.number().int().min(1).max(1200).nullable().default(null),dataFixa:z.string().date().nullable().default(null),propriedadeIds:z.array(z.number().int().positive()).min(1).max(100),sexo:z.enum(["F","M"]).nullable().default(null),antecedenciaDias:z.number().int().min(0).max(3650).default(0),prazoDias:z.number().int().min(0).max(3650).default(0),vigencia:z.string().date(),orientacao:z.string().trim().max(1000).nullable().default(null)}).strict().superRefine((v,c)=>{if(v.idadeMinimaMeses!=null&&v.idadeMaximaMeses!=null&&v.idadeMinimaMeses>v.idadeMaximaMeses)c.addIssue({code:"custom",message:"A idade mínima não pode superar a máxima",path:["idadeMaximaMeses"]});if(Number(v.produtoId!=null)+Number(v.protocoloId!=null)!==1)c.addIssue({code:"custom",message:"Informe Produto ou Protocolo",path:["produtoId"]});if(v.gatilho==="IDADE"?v.idadeMeses==null||v.dataFixa!=null:v.dataFixa==null||v.idadeMeses!=null)c.addIssue({code:"custom",message:"Informe idade OU data fixa",path:["gatilho"]});});
export type RegraAlertaInput=z.infer<typeof regraAlertaSchema>;
async function validarDestino(tx:Prisma.TransactionClient,input:RegraAlertaInput) {
  if(input.tipoAplicacaoId&&!await tx.tipoAplicacaoSanitaria.findFirst({where:{id:input.tipoAplicacaoId,ativo:true}}))throw new RebanhoError("VALIDACAO","Tipo de aplicação não encontrado ou inativo");
  if(input.produtoId&&!await tx.produto.findFirst({where:{id:input.produtoId,ativo:true,usoSanitario:true,perfilSanitarioProduto:{isNot:null}}}))throw new RebanhoError("VALIDACAO","Produto sanitário ativo não encontrado");
  if(input.protocoloId&&!await tx.protocolo.findFirst({where:{id:input.protocoloId,ativo:true,publicado:true,tipo:"SANITARIO"}}))throw new RebanhoError("VALIDACAO","Protocolo ativo não encontrado");
  if(await tx.propriedade.count({where:{id:{in:[...new Set(input.propriedadeIds)]},ativo:true}})!==new Set(input.propriedadeIds).size)throw new RebanhoError("VALIDACAO","Sítio não encontrado ou inativo");
}
export async function criarRegra(input:RegraAlertaInput,autorId:number) {
  return prisma.$transaction(async tx=>{await validarDestino(tx,input);const regra=await tx.regraAlertaSanitario.create({data:{...input,dataFixa:input.dataFixa?dataCivil(input.dataFixa):null,vigencia:dataCivil(input.vigencia),criadoPorId:autorId}});await tx.revisaoRegraAlertaSanitario.create({data:{regraId:regra.id,revisao:1,dados:JSON.parse(JSON.stringify(regra)) as Prisma.InputJsonObject,motivo:"Cadastro inativo",autorId}});return regra;});
}
export const listarRegras=(propriedadeId:number|null)=>prisma.regraAlertaSanitario.findMany({where:propriedadeId==null?{}:{propriedadeIds:{has:propriedadeId}},orderBy:{nome:"asc"}});
export async function basePreviaTx(tx:Prisma.TransactionClient,id:string,hoje:Date) {
 const regra=await tx.regraAlertaSanitario.findUnique({where:{id}});if(!regra)throw new RebanhoError("NAO_ENCONTRADO","Regra não encontrada");
 const destino=regra.produtoId?await tx.produto.findUnique({where:{id:regra.produtoId},select:{id:true,nome:true,ativo:true,usoSanitario:true,perfilSanitarioProduto:{select:{id:true,atualizadoEm:true}}}}):await tx.protocolo.findUnique({where:{id:regra.protocoloId!},select:{id:true,nome:true,ativo:true,publicado:true,tipo:true,atualizadoEm:true}});
 const sitios=await tx.propriedade.findMany({where:{id:{in:regra.propriedadeIds}},select:{id:true,ativo:true}});
 const destinoDisponivel=!!destino?.ativo && (!("publicado" in destino)||destino.publicado) && (!("usoSanitario" in destino)||(destino.usoSanitario&&!!destino.perfilSanitarioProduto)) && sitios.length===regra.propriedadeIds.length && sitios.every(s=>s.ativo);
 const animais=await tx.animal.findMany({where:{...(regra.sexo?{sexo:regra.sexo as "F"|"M"}:{}),baixas:{none:{estornadaEm:null}},localizacoes:{some:{ate:null,propriedadeId:{in:regra.propriedadeIds}}}},select:{id:true,brinco:true,nome:true,dataNascimento:true,nascimentoEstimado:true,atualizadoEm:true,localizacoes:{where:{ate:null},select:{propriedadeId:true,atualizadoEm:true}},aplicacaoProdutos:{where:{status:"VALIDO",...(regra.produtoId?{produtoId:regra.produtoId}:{})},select:{id:true,data:true,atualizadoEm:true}}},orderBy:{id:"asc"}});
 const elegiveis=animais.filter(a=>idadeNaFaixa(idadeEmMeses(a.dataNascimento,hoje),regra.idadeMinimaMeses,regra.idadeMaximaMeses));
 const itens=elegiveis.map(a=>{const data=regra.gatilho==="IDADE"?alcanceIdade(a.dataNascimento,regra.idadeMeses!):regra.dataFixa;return{animalId:a.id,brinco:a.brinco,nome:a.nome,nascimentoEstimado:a.nascimentoEstimado,dataReferencia:data?.toISOString().slice(0,10)??null,situacao:avaliarPrazo({data,hoje,adocao:hoje,antecedenciaDias:regra.antecedenciaDias,prazoDias:regra.prazoDias}).situacao,candidatas:a.aplicacaoProdutos.map(p=>({id:p.id,data:p.data.toISOString().slice(0,10)}))};});
 return {regra,animais,itens,destinoDisponivel,base:hashConteudo({regra,animais,destino,sitios,dia:hoje.toISOString().slice(0,10)})};
}
export async function previaRegra(id:string,pagina=1,tamanho=20,agora=new Date()) {return prisma.$transaction(async tx=>{const p=await basePreviaTx(tx,id,dataCivil(diaCivil(agora)));return{regra:p.regra,base:p.base,revisao:p.regra.revisao,itens:p.itens.slice((pagina-1)*tamanho,pagina*tamanho),total:p.itens.length,pagina,tamanho,totais:p.itens.reduce<Record<string,number>>((a,i)=>(a[i.situacao]=(a[i.situacao]??0)+1,a),{})};});}
export async function ativarRegraTx(tx:Prisma.TransactionClient,id:string,input:{base:string;revisao:number},autorId:number,agora=new Date()) {
 const hoje=dataCivil(diaCivil(agora));
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra:${id}`},0))`;
 const p=await basePreviaTx(tx,id,hoje);
 if(p.regra.ativo){if(p.regra.revisao===input.revisao&&p.regra.baseAtivacao===input.base)return p.regra;throw new RebanhoError("CONFLITO","Regra já ativada em outra revisão");}
 if(p.regra.revisao!==input.revisao||p.base!==input.base)throw new RebanhoError("CONFLITO","O público ou a regra mudou. Confira uma nova prévia");
 if(!p.destinoDisponivel)throw new RebanhoError("VALIDACAO","Confira o destino sanitário e os sítios antes de ativar");
 const regra=await tx.regraAlertaSanitario.update({where:{id},data:{ativo:true,adocao:hoje,baseAtivacao:input.base}});
 await auditar(tx,{entidade:"RegraAlertaSanitario",entidadeId:id,acao:"ATIVACAO_CONFERIDA",usuarioId:autorId,antes:p.regra,depois:{...regra,baseConferida:input.base,motivo:"Ativação após confirmação da prévia"}});
 await marcarReavaliacaoSanitariaTx(tx);
 return regra;
}
export async function ativarRegra(id:string,input:{base:string;revisao:number},autorId:number,agora=new Date()) {
 return prisma.$transaction(tx=>ativarRegraTx(tx,id,input,autorId,agora),{isolationLevel:"Serializable"});
}
export async function inativarRegra(id:string,input:{revisao:number;destinoAbertas:"MANTER"|"ENCERRAR";motivo:string},autorId:number) {
 return prisma.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra:${id}`},0))`;const r=await tx.regraAlertaSanitario.findUniqueOrThrow({where:{id}});if(r.revisao!==input.revisao)throw new RebanhoError("CONFLITO","Regra alterada. Reconsulte");const regra=await tx.regraAlertaSanitario.update({where:{id},data:{ativo:false,revisao:{increment:1}}});await tx.revisaoRegraAlertaSanitario.create({data:{regraId:id,revisao:regra.revisao,dados:JSON.parse(JSON.stringify(regra)) as Prisma.InputJsonObject,motivo:input.motivo,autorId}});
 if(input.destinoAbertas==="ENCERRAR"){const abertas=await tx.necessidadeSanitaria.findMany({where:{regraId:id,alerta:{ciclo:"ABERTO"}}});for(const n of abertas){await tx.necessidadeSanitaria.update({where:{id:n.id},data:{situacao:"ENCERRADO",motivo:input.motivo,revisao:{increment:1},decisaoEm:new Date(),decisaoPorId:autorId}});await publicarNecessidadeTx(tx,n.id,{usuarioId:autorId},"ENCERRAR");}}
 return regra;});
}
export { avaliarRegraAnimalTx };
/** Revisão conserva identidades e exige destino das abertas; concluídas nunca reiniciam. */
export async function revisarRegra(id:string,input:RegraAlertaInput,decisao:{revisao:number;destinoAbertas:"MANTER"|"ENCERRAR";motivo:string},autorId:number) {
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra:${id}`},0))`;
  const anterior=await tx.regraAlertaSanitario.findUniqueOrThrow({where:{id}});
  if(anterior.revisao!==decisao.revisao)throw new RebanhoError("CONFLITO","Regra alterada. Confira novamente");
  await validarDestino(tx,input);
  if(decisao.destinoAbertas==="ENCERRAR"){
   const abertas=await tx.necessidadeSanitaria.findMany({where:{regraId:id,alerta:{ciclo:"ABERTO"}}});
   for(const n of abertas){await tx.necessidadeSanitaria.update({where:{id:n.id},data:{situacao:"ENCERRADO",motivo:decisao.motivo,revisao:{increment:1},decisaoEm:new Date(),decisaoPorId:autorId}});await publicarNecessidadeTx(tx,n.id,{usuarioId:autorId},"ENCERRAR");}
  }
  const regra=await tx.regraAlertaSanitario.update({where:{id},data:{...input,dataFixa:input.dataFixa?dataCivil(input.dataFixa):null,vigencia:dataCivil(input.vigencia),ativo:false,revisao:{increment:1},adocao:null,baseAtivacao:null}});
  await tx.revisaoRegraAlertaSanitario.create({data:{regraId:id,revisao:regra.revisao,dados:JSON.parse(JSON.stringify(regra)) as Prisma.InputJsonObject,motivo:decisao.motivo,autorId}});
  return regra;
 });
}
