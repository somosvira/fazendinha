import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { tarefaNoEscopoOperacao } from "./operacao.escopo.js";
import { hashFormatoExame } from "../exames/formato-snapshot.js";
import { obterSaldo } from "../consumo.js";
import { paginaOperacao } from "./operacao.js";

const base={pagina:z.coerce.number().int().positive().default(1),porPagina:z.coerce.number().int().min(1).max(10).default(10),busca:z.string().trim().max(120).default(""),selecionadoId:z.string().uuid().optional()};
export const opcoesClinicasSchema=z.discriminatedUnion("opcao",[
 z.object({...base,opcao:z.literal("TIPO_EXAME")}).strict(),
 z.object({...base,opcao:z.literal("MATERIAL"),tipoTentativa:z.enum(["IA","TE"]).optional()}).strict(),
 z.object({...base,opcao:z.literal("PARTIDA"),materialId:z.string().uuid()}).strict(),
 z.object({...base,opcao:z.literal("SERVICO")}).strict(),
 z.object({...base,opcao:z.literal("TENTATIVA")}).strict(),
 z.object({...base,opcao:z.literal("GESTACAO")}).strict(),
 z.object({...base,opcao:z.literal("REPRODUTOR"),externo:z.enum(["true","false"]).default("true")}).strict(),
]);
export async function listarOpcoesClinicas(tarefaId:string,propriedadeId:number|null,entrada:unknown){
 const f=opcoesClinicasSchema.parse(entrada);
 return prisma.$transaction(async tx=>{
  const tarefa=await tx.tarefaProtocolo.findFirst({where:{id:tarefaId,AND:[tarefaNoEscopoOperacao(propriedadeId)]},include:{etapa:true,execucao:true,demandaAcompanhamento:{select:{id:true,estado:true,previstaPara:true,finalidade:true,tentativaId:true,gestacaoId:true,versao:true,regraSnapshot:true}}}});
  if(!tarefa)throw new RebanhoError("NAO_ENCONTRADO","Tarefa não encontrada neste sítio");
  const config=tarefa.etapa.configuracao as Record<string,unknown>;
  const acao=config.tipo??tarefa.etapa.tipo;
  if(!["EXAME","AVALIACAO","TENTATIVA"].includes(String(acao)))throw new RebanhoError("VALIDACAO","A tarefa não é uma ação clínica");
  const paginas=async<T>(contar:()=>Promise<number>,listar:(skip:number,take:number)=>Promise<T[]>)=>{const total=await contar();const pagina=paginaOperacao(total,f.pagina,f.porPagina);return{itens:await listar((pagina-1)*f.porPagina,f.porPagina),total,pagina,porPagina:f.porPagina,acompanhamento:tarefa.demandaAcompanhamento};};
  const id=f.selecionadoId?{id:f.selecionadoId}:{};
  if(f.opcao==="TIPO_EXAME"){
   if(acao==="TENTATIVA")throw new RebanhoError("VALIDACAO","Tentativa não usa tipo de exame");
   const where:Prisma.TipoExameWhereInput={...id,ativo:true,contexto:{in:acao==="AVALIACAO"?["REPRODUTIVO","COMPARTILHADO"]:["SANITARIO","COMPARTILHADO"]},...(acao==="AVALIACAO"?{tipoResultado:"MULTIPLO"}:{}),nome:{contains:f.busca,mode:"insensitive"}};
   return paginas(()=>tx.tipoExame.count({where}),async(skip,take)=>(await tx.tipoExame.findMany({where,orderBy:[{nome:"asc"},{id:"asc"}],skip,take,select:{id:true,nome:true,tipoResultado:true,unidade:true,opcoes:true,campos:true,versaoFormato:true}})).map(t=>({...t,formatoExameHash:hashFormatoExame(t)})));
  }
  if(f.opcao==="MATERIAL"){
   if(acao!=="TENTATIVA")throw new RebanhoError("VALIDACAO","Seleção de material exige tentativa");
   const where:Prisma.MaterialGeneticoWhereInput={...id,...(f.tipoTentativa?{tipo:f.tipoTentativa==="IA"?"SEMEN":"EMBRIAO"}:{}),produto:{ativo:true,usoGenetico:true,nome:{contains:f.busca,mode:"insensitive"}}};
   return paginas(()=>tx.materialGenetico.count({where}),async(skip,take)=>(await tx.materialGenetico.findMany({where,skip,take,orderBy:[{produto:{nome:"asc"}},{id:"asc"}],select:{id:true,tipo:true,touroId:true,touroExternoId:true,doadoraId:true,doadoraExternaId:true,produto:{select:{id:true,nome:true,unidade:true,rastrearPartidas:true}}}})).map(m=>({...m,nome:m.produto.nome})));
  }
  if(f.opcao==="PARTIDA"){
   if(acao!=="TENTATIVA")throw new RebanhoError("VALIDACAO","Lote genético exige tentativa");
   const material=await tx.materialGenetico.findUnique({where:{id:f.materialId},select:{produtoId:true}});
   if(!material)throw new RebanhoError("NAO_ENCONTRADO","Material não encontrado no catálogo genético");
   const where:Prisma.PartidaProdutoWhereInput={...id,produtoId:material.produtoId,lotePrincipalId:null,OR:[{codigo:{contains:f.busca,mode:"insensitive"}},{nome:{contains:f.busca,mode:"insensitive"}}]};
   return paginas(()=>tx.partidaProduto.count({where}),async(skip,take)=>Promise.all((await tx.partidaProduto.findMany({where,skip,take,orderBy:[{codigo:"asc"},{id:"asc"}],select:{id:true,codigo:true,nome:true,validade:true}})).map(async p=>({...p,nome:p.nome??p.codigo,saldo:propriedadeId==null?null:(await obterSaldo(tx,material.produtoId,propriedadeId,p.id)).toString()}))));
  }
  if(f.opcao==="SERVICO"){
   const sitio=propriedadeId??tarefa.execucao.propriedadeId;
   if(!sitio)throw new RebanhoError("VALIDACAO","Selecione um sítio para consultar Serviços");
   const where:Prisma.OperacaoWhereInput={...id,propriedadeId:sitio,tipo:"SERVICO",status:"CONFIRMADA",descricao:{contains:f.busca,mode:"insensitive"}};
   return paginas(()=>tx.operacao.count({where}),async(skip,take)=>(await tx.operacao.findMany({where,skip,take,orderBy:[{data:"desc"},{id:"asc"}],select:{id:true,numero:true,data:true}})).map(s=>({...s,nome:`Serviço OP-${s.numero} · ${s.data.toISOString().slice(0,10)}`})));
  }
  if(f.opcao==="TENTATIVA"){
   const where:Prisma.TentativaReprodutivaWhereInput={...id,animalId:tarefa.execucao.animalId,status:"VALIDO",...(propriedadeId!=null?{propriedadeId}:{})};
   return paginas(()=>tx.tentativaReprodutiva.count({where}),async(skip,take)=>(await tx.tentativaReprodutiva.findMany({where,skip,take,orderBy:[{data:"desc"},{ordem:"desc"},{id:"asc"}],select:{id:true,tipo:true,data:true,ordem:true}})).map(t=>({...t,nome:`${t.tipo} · ${t.data.toISOString().slice(0,10)} · tentativa ${t.ordem}`})));
  }
  if(f.opcao==="GESTACAO"){
   const where:Prisma.GestacaoAnimalWhereInput={...id,animalId:tarefa.execucao.animalId,status:"VALIDO",...(propriedadeId!=null?{propriedadeId}:{})};
   return paginas(()=>tx.gestacaoAnimal.count({where}),async(skip,take)=>(await tx.gestacaoAnimal.findMany({where,skip,take,orderBy:[{confirmadaEm:"desc"},{id:"asc"}],select:{id:true,confirmadaEm:true,encerradaEm:true,sexoFetal:true,tentativaId:true}})).map(g=>({...g,nome:`Gestação confirmada em ${g.confirmadaEm.toISOString().slice(0,10)}${g.encerradaEm?" · encerrada":""}`})));
  }
  if(acao!=="TENTATIVA")throw new RebanhoError("VALIDACAO","Reprodutor exige tentativa");
  if(f.externo==="true"){
   const where:Prisma.GenitorExternoWhereInput={...id,ativo:true,sexo:"M",nome:{contains:f.busca,mode:"insensitive"}};
   return paginas(()=>tx.genitorExterno.count({where}),async(skip,take)=>(await tx.genitorExterno.findMany({where,skip,take,orderBy:[{nome:"asc"},{id:"asc"}],select:{id:true,nome:true,codigo:true}})).map(g=>({...g,externo:true})));
  }
  const where:Prisma.AnimalWhereInput={...id,sexo:"M",OR:[{brinco:{contains:f.busca,mode:"insensitive"}},{nome:{contains:f.busca,mode:"insensitive"}}],...(propriedadeId!=null?{localizacoes:{some:{propriedadeId,ate:null}}}:{})};
  return paginas(()=>tx.animal.count({where}),async(skip,take)=>(await tx.animal.findMany({where,skip,take,orderBy:[{brinco:"asc"},{id:"asc"}],select:{id:true,brinco:true,nome:true}})).map(g=>({...g,nome:g.nome?`${g.brinco} · ${g.nome}`:g.brinco,externo:false})));
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}

/** Histórico factual inclui reavaliações ligadas pela demanda, sem substituir a coleta original. */
export async function listarExamesTarefaClinica(tarefaId:string,propriedadeId:number|null,entrada:unknown){
 const f=z.object({pagina:z.coerce.number().int().positive().default(1),porPagina:z.coerce.number().int().min(1).max(10).default(10)}).strict().parse(entrada);
 return prisma.$transaction(async tx=>{
  const tarefa=await tx.tarefaProtocolo.findFirst({where:{id:tarefaId,AND:[tarefaNoEscopoOperacao(propriedadeId)]},select:{id:true}});
  if(!tarefa)throw new RebanhoError("NAO_ENCONTRADO","Tarefa não encontrada neste sítio");
  const where:Prisma.ExameAnimalWhereInput={...(propriedadeId==null?{}:{propriedadeId}),OR:[{tarefaId},{demandaAcompanhamento:{tarefaId}}]};
  const total=await tx.exameAnimal.count({where});const pagina=paginaOperacao(total,f.pagina,f.porPagina);
  const itens=await tx.exameAnimal.findMany({where,orderBy:[{data:"desc"},{criadoEm:"desc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina,select:{id:true,animalId:true,propriedadeId:true,data:true,status:true,realizacao:true,formatoSnapshot:true,tarefaId:true,demandaAcompanhamentoId:true,observacao:true,responsavel:true,resultadoTexto:true,resultadoNumero:true,resultadoOpcao:true,resultados:{where:{vigente:true},select:{campo:true,valor:true}},interpretacao:{select:{tentativaId:true,gestacaoId:true,conduta:true,retornoEm:true}}}});
  return{itens,total,pagina,porPagina:f.porPagina};
 },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
