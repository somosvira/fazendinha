import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";

export const consultaParticipantesVisitaSchema=z.object({pagina:z.coerce.number().int().positive().default(1),porPagina:z.coerce.number().int().min(1).max(10).default(10),busca:z.string().trim().max(120).default(""),status:z.enum(["PENDENTE","RASCUNHO","CONFIRMADO","NAO_ATENDIDO","ADIADO"]).optional(),motivos:z.array(z.string().trim().min(1).max(200)).max(30).default([])}).strict();
type Tx=Prisma.TransactionClient;
async function conferirVisita(tx:Tx,id:string,propriedadeId:number|null){
 const visita=await tx.visitaVeterinaria.findFirst({where:{id,...(propriedadeId==null?{}:{propriedadeId})}});
 if(!visita)throw new RebanhoError("NAO_ENCONTRADO","Visita não encontrada neste sítio");return visita;
}
async function conferirAtividade(tx:Tx,id:string,atividadeId:string){const a=await tx.atividadeVisita.findFirst({where:{id:atividadeId,visitaId:id}});if(!a)throw new RebanhoError("NAO_ENCONTRADO","Atividade não encontrada nesta visita");return a;}
function apresentarParticipante<T extends {tarefaId:string|null}>(p:T,tipo:string){return{...p,tarefaIatfId:tipo==="TAREFA_IATF"?p.tarefaId:null,tarefaSanitariaId:tipo!=="TAREFA_IATF"?p.tarefaId:null};}
export async function resumoVisita(id:string,propriedadeId:number|null){return prisma.$transaction(async tx=>{
 const visita=await conferirVisita(tx,id,propriedadeId);
 const atividades=await tx.atividadeVisita.findMany({where:{visitaId:id},orderBy:[{ordem:"asc"},{id:"asc"}]});
 const where={atividadeId:{in:atividades.map(a=>a.id)}};
 const [contagens,animais,impressoes]=await Promise.all([tx.participanteVisita.groupBy({by:["atividadeId","status"],where,_count:{_all:true}}),tx.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT COUNT(DISTINCT p."animalId") AS total FROM pecuaria."ParticipanteVisita" p JOIN pecuaria."AtividadeVisita" a ON a.id=p."atividadeId" WHERE a."visitaId"=${id}`),tx.impressaoVisita.findMany({where:{visitaId:id},orderBy:{versao:"desc"},select:{id:true,visitaId:true,versao:true,criadoEm:true,criadoPorId:true}})]);
 const linhas=atividades.map(a=>{const cont=contagens.filter(c=>c.atividadeId===a.id);const contar=(s:string)=>cont.find(c=>c.status===s)?._count._all??0;return{...a,totais:{totalParticipantes:cont.reduce((n,c)=>n+c._count._all,0),confirmados:contar("CONFIRMADO"),pendentes:contar("PENDENTE"),naoAtendidos:contar("NAO_ATENDIDO"),adiados:contar("ADIADO")}};});
 return{...visita,atividades:linhas,impressoes,totalAnimais:Number(animais[0]?.total??0),totalParticipantes:linhas.reduce((n,a)=>n+a.totais.totalParticipantes,0)};
},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});}

export function filtroParticipantesVisita(atividadeId:string,f:z.infer<typeof consultaParticipantesVisitaSchema>):Prisma.ParticipanteVisitaWhereInput{
 return{atividadeId,...(f.status?{status:f.status==="RASCUNHO"?"PENDENTE":f.status,...(f.status==="RASCUNHO"?{versaoRascunho:{gt:0}}:{})}:{}),...(f.motivos.length?{OR:f.motivos.map(m=>({snapshot:{path:["motivos"],array_contains:[m]}}))}:{})};
}
export async function listarParticipantesAtividade(id:string,atividadeId:string,propriedadeId:number|null,entrada:unknown){const f=consultaParticipantesVisitaSchema.parse(entrada);return prisma.$transaction(async tx=>{
 await conferirVisita(tx,id,propriedadeId);const a=await conferirAtividade(tx,id,atividadeId);const where=filtroParticipantesVisita(atividadeId,f);
 // A busca é resolvida no banco, sem baixar os animais ou participantes da atividade.
 if(f.busca||f.motivos.length){
  const busca=`%${f.busca.replace(/[\\%_]/g,"\\$&")}%`;
  const motivos=Prisma.sql`CASE WHEN jsonb_typeof(p.snapshot->'motivos')='array' AND jsonb_array_length(p.snapshot->'motivos')>0 THEN ARRAY(SELECT jsonb_array_elements_text(p.snapshot->'motivos')) ELSE COALESCE(NULLIF(array_remove(ARRAY[
   CASE WHEN p."tarefaId" IS NOT NULL AND ${a.tipo}!='TAREFA_IATF' THEN 'Tarefa sanitária pendente' END,
   CASE WHEN p."tarefaId" IS NOT NULL AND ${a.tipo}='TAREFA_IATF' THEN 'Etapa IATF pendente' END,
   CASE WHEN p.snapshot->'gestacao' IS NOT NULL AND p.snapshot->'gestacao'!='null'::jsonb THEN 'Gestação conhecida' END,
   CASE WHEN (p.snapshot->'gestacao' IS NULL OR p.snapshot->'gestacao'='null'::jsonb) AND p.snapshot->'tentativa' IS NOT NULL AND p.snapshot->'tentativa'!='null'::jsonb AND (p.snapshot->'ultimoParto' IS NULL OR p.snapshot->'ultimoParto'='null'::jsonb OR p.snapshot#>>'{tentativa,data}'>p.snapshot#>>'{ultimoParto,data}') THEN 'Diagnóstico pós-tentativa' END,
   CASE WHEN jsonb_typeof(p.snapshot->'restricoes')='array' AND jsonb_array_length(p.snapshot->'restricoes')>0 THEN 'Restrição reprodutiva' END
  ]::text[],NULL),'{}'::text[]),ARRAY['Avaliação / atividade extra']) END`;
  const filtro=Prisma.sql`p."atividadeId"=${atividadeId} ${f.busca?Prisma.sql`AND (p.snapshot->>'brinco' ILIKE ${busca} OR p.snapshot->>'nome' ILIKE ${busca})`:Prisma.empty} ${f.status?Prisma.sql`AND p.status=${f.status==="RASCUNHO"?"PENDENTE":f.status}`:Prisma.empty} ${f.status==="RASCUNHO"?Prisma.sql`AND p."versaoRascunho">0`:Prisma.empty} ${f.motivos.length?Prisma.sql`AND (${motivos}) && ARRAY[${Prisma.join(f.motivos)}]::text[]`:Prisma.empty}`;
  const cont=await tx.$queryRaw<{total:bigint}[]>(Prisma.sql`SELECT COUNT(*) AS total FROM pecuaria."ParticipanteVisita" p WHERE ${filtro}`);
  const total=Number(cont[0]?.total??0),pagina=Math.min(f.pagina,Math.max(1,Math.ceil(total/f.porPagina)));
  const ids=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT p.id FROM pecuaria."ParticipanteVisita" p WHERE ${filtro} ORDER BY p.ordem,p.id LIMIT ${f.porPagina} OFFSET ${(pagina-1)*f.porPagina}`);
  const itens=await tx.participanteVisita.findMany({where:{id:{in:ids.map(p=>p.id)}},orderBy:[{ordem:"asc"},{id:"asc"}]});
  return{itens:itens.map(p=>apresentarParticipante(p,a.tipo)),total,pagina,porPagina:f.porPagina};
 }
 const total=await tx.participanteVisita.count({where}),pagina=Math.min(f.pagina,Math.max(1,Math.ceil(total/f.porPagina)));
 const itens=await tx.participanteVisita.findMany({where,orderBy:[{ordem:"asc"},{id:"asc"}],skip:(pagina-1)*f.porPagina,take:f.porPagina});
 return{itens:itens.map(p=>apresentarParticipante(p,a.tipo)),total,pagina,porPagina:f.porPagina};
},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});}
export async function obterParticipanteVisita(id:string,participanteId:string,propriedadeId:number|null){return prisma.$transaction(async tx=>{await conferirVisita(tx,id,propriedadeId);const p=await tx.participanteVisita.findUnique({where:{id:participanteId}});if(!p)throw new RebanhoError("NAO_ENCONTRADO","Participante não encontrado");const a=await conferirAtividade(tx,id,p.atividadeId);return apresentarParticipante(p,a.tipo);},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});}
export async function obterImpressaoVisita(id:string,impressaoId:string,propriedadeId:number|null){return prisma.$transaction(async tx=>{await conferirVisita(tx,id,propriedadeId);const impressao=await tx.impressaoVisita.findFirst({where:{id:impressaoId,visitaId:id}});if(!impressao)throw new RebanhoError("NAO_ENCONTRADO","Impressão não encontrada nesta visita");return impressao;},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});}
