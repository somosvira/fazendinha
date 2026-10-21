import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { hashFormatoExame } from "../exames/formato-snapshot.js";
const base={origem:z.enum(["SANITARIO","REPRODUTIVO"]),pagina:z.coerce.number().int().positive().default(1),porPagina:z.coerce.number().int().min(1).max(10).default(10),busca:z.string().trim().max(120).default(""),selecionadoId:z.string().uuid().optional()};
export const opcoesCadastroSchema=z.discriminatedUnion("opcao",[
 z.object({...base,opcao:z.literal("PRODUTO")}).strict(),z.object({...base,opcao:z.literal("TIPO_EXAME")}).strict(),z.object({...base,opcao:z.literal("TIPO_APLICACAO")}).strict(),z.object({...base,opcao:z.literal("MATERIAL"),tipoTentativa:z.enum(["IA","TE"]).optional()}).strict(),
]);
/** Catálogos de configuração não revelam saldo, fatos de animais ou valores financeiros. */
export async function listarOpcoesCadastro(entrada:unknown){const f=opcoesCadastroSchema.parse(entrada);return prisma.$transaction(async tx=>{
 const pagina=async<T>(count:()=>Promise<number>,find:(skip:number,take:number)=>Promise<T[]>)=>{const total=await count(),pagina=Math.min(f.pagina,Math.max(1,Math.ceil(total/f.porPagina)));return{itens:await find((pagina-1)*f.porPagina,f.porPagina),total,pagina,porPagina:f.porPagina};};
 const id=f.selecionadoId?{id:f.selecionadoId}:{},ativo=f.selecionadoId?{}:{ativo:true},nome={contains:f.busca,mode:Prisma.QueryMode.insensitive};
 if(f.opcao==="PRODUTO"){
  const where:Prisma.ProdutoWhereInput={...id,...ativo,usoSanitario:true,nome};
  return pagina(()=>tx.produto.count({where}),(skip,take)=>tx.produto.findMany({where,skip,take,orderBy:[{nome:"asc"},{id:"asc"}],select:{id:true,nome:true,ativo:true,unidade:true,usoSanitario:true,usoGenetico:true,rastrearPartidas:true}}));
 }
 if(f.opcao==="TIPO_APLICACAO"){
  const where:Prisma.TipoAplicacaoSanitariaWhereInput={...id,...ativo,nome};
  return pagina(()=>tx.tipoAplicacaoSanitaria.count({where}),(skip,take)=>tx.tipoAplicacaoSanitaria.findMany({where,skip,take,orderBy:[{nome:"asc"},{id:"asc"}],select:{id:true,nome:true,ativo:true}}));
 }
 if(f.opcao==="TIPO_EXAME"){
  const where:Prisma.TipoExameWhereInput={...id,...ativo,nome,contexto:{in:[f.origem,"COMPARTILHADO"]},...(f.origem==="REPRODUTIVO"?{tipoResultado:"MULTIPLO"}:{})};
  return pagina(()=>tx.tipoExame.count({where}),async(skip,take)=>(await tx.tipoExame.findMany({where,skip,take,orderBy:[{nome:"asc"},{id:"asc"}],select:{id:true,nome:true,ativo:true,contexto:true,tipoResultado:true,unidade:true,opcoes:true,campos:true,versaoFormato:true}})).map(e=>({...e,formatoExameHash:hashFormatoExame(e)})));
 }
 const where:Prisma.MaterialGeneticoWhereInput={...id,...(f.tipoTentativa?{tipo:f.tipoTentativa==="IA"?"SEMEN":"EMBRIAO"}:{}),produto:{...ativo,usoGenetico:true,nome}};
 return pagina(()=>tx.materialGenetico.count({where}),async(skip,take)=>(await tx.materialGenetico.findMany({where,skip,take,orderBy:[{produto:{nome:"asc"}},{id:"asc"}],select:{id:true,tipo:true,tipoSemen:true,touroId:true,touroExternoId:true,doadoraId:true,doadoraExternaId:true,observacao:true,produto:{select:{id:true,nome:true,unidade:true,ativo:true,rastrearPartidas:true}},touro:{select:{id:true,nome:true,brinco:true}},touroExterno:{select:{id:true,nome:true,codigo:true}},doadora:{select:{id:true,nome:true,brinco:true}},doadoraExterna:{select:{id:true,nome:true,codigo:true}}}})).map(m=>({...m,nome:m.produto.nome,unidade:m.produto.unidade})));
},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});}
