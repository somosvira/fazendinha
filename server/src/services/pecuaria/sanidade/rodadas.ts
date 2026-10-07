import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, hojeFazenda, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { iniciarExecucaoTx } from "./protocolos.js";
import { buscaAnimal, intervalo, limites, type ConsultaSanitaria } from "./consulta.js";
import { criarRodadaSchema, adicionarParticipantesSchema, associarExecucoesSchema, retirarParticipanteSchema, renomearRodadaSchema, type CriarRodadaInput, type ParticipanteInput } from "./rodadas.schemas.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const animal = { select: { id: true, brinco: true, nome: true, localizacoes: { where: { ate: null }, select: { propriedadeId: true, propriedade: { select: { id: true, nome: true } } } }, baixas: { where: { estornadaEm: null }, select: { localizacaoFechada: { select: { propriedadeId: true } } } } } } as const;
const includeTarefa = { execucao: { include: { animal, protocolo: { select: { nome: true, versao: true } } } }, aplicacoes: { select: { id: true, status: true, data: true, aplicadaEm: true, dose: true, unidadeDose: true, nomeProdutoAplicado: true, propriedadeId: true } }, exames: { select: { id: true, status: true, data: true, propriedadeId: true, formatoSnapshot: true } } } as const;
type Tarefa = Prisma.TarefaSanitariaGetPayload<{ include: typeof includeTarefa }>;
export function situacaoTarefa(t: Pick<Tarefa, "execucao" | "dispensadaEm" | "aplicacoes" | "exames">) {
  // A retirada encerra pendências, nunca invalida um fato realizado.
  return t.aplicacoes.some(a => a.status === "VALIDO") || t.exames.some(e => e.status === "VALIDO") ? "REALIZADA" : t.execucao.canceladaEm ? "EXECUCAO_CANCELADA" : t.dispensadaEm ? "DISPENSADA" : "PENDENTE";
}
function contar(ts: Tarefa[]) {
  return { total: ts.length, pendentes: ts.filter(t => situacaoTarefa(t) === "PENDENTE").length, atrasadas: ts.filter(t => situacaoTarefa(t) === "PENDENTE" && iso(t.previstaPara) < hojeFazenda()).length, realizadas: ts.filter(t => situacaoTarefa(t) === "REALIZADA").length, dispensadas: ts.filter(t => situacaoTarefa(t) === "DISPENSADA").length, canceladas: ts.filter(t => situacaoTarefa(t) === "EXECUCAO_CANCELADA").length };
}
function whereParticipante(sitio: number | null, f?: ConsultaSanitaria): Prisma.ExecucaoProtocoloSanitarioWhereInput {
  const local = { ...(sitio == null ? {} : { propriedadeId: sitio }), ...(f?.loteId ? { loteId: f.loteId } : {}) };
  // A baixa fecha a localização; a participação e seus fatos continuam consultáveis no sítio da baixa.
  const contexto: Prisma.AnimalWhereInput = sitio != null || f?.loteId ? { OR: [
    { localizacoes: { some: { ate: null, ...local } } },
    { baixas: { some: { estornadaEm: null, localizacaoFechada: { is: local } } } },
  ] } : {};
  return { ...(f?.animalId ? { animalId: f.animalId } : {}), ...(sitio != null || f?.buscaAnimal || f?.loteId ? { animal: { AND: [buscaAnimal(f), contexto] } } : {}) };
}
function estadoTarefa(f: ConsultaSanitaria): Prisma.TarefaSanitariaWhereInput {
  const realizada: Prisma.TarefaSanitariaWhereInput = { OR: [{ aplicacoes: { some: { status: "VALIDO" } } }, { exames: { some: { status: "VALIDO" } } }] };
  if (f.situacao === "REALIZADA") return realizada;
  if (f.situacao === "EXECUCAO_CANCELADA") return { AND: [{ NOT: realizada }, { execucao: { canceladaEm: { not: null } } }] };
  if (f.situacao === "DISPENSADA") return { AND: [{ NOT: realizada }, { execucao: { canceladaEm: null } }, { dispensadaEm: { not: null } }] };
  if (f.situacao === "PENDENTE" || f.situacao === "ATRASADA") return { AND: [{ NOT: realizada }, { execucao: { canceladaEm: null } }, { dispensadaEm: null }, ...(f.situacao === "ATRASADA" ? [{ previstaPara: { lt: dia(hojeFazenda()) } }] : [])] };
  return {};
}
async function buscarRodada(tx: Prisma.TransactionClient, id: string, sitio: number | null) {
  const r = await tx.rodadaProtocoloSanitario.findFirst({ where: { id, ...(sitio == null ? {} : { OR: [{ propriedadeId: sitio }, { execucoes: { some: whereParticipante(sitio) } }] }) }, include: { protocolo: { select: { id: true, nome: true, versao: true } } } });
  if (!r) throw new RebanhoError("NAO_ENCONTRADO", "Rodada não encontrada neste sítio");
  return r;
}
function ordenar(v: unknown): unknown { return Array.isArray(v) ? v.map(ordenar) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,x])=>[k,ordenar(x)])) : v; }
async function confirmar<T extends { chave: string; propriedadeId: number }>(input: T, usuarioId: number | null, acao: string, animais: string[], fn: (tx: Prisma.TransactionClient) => Promise<{ id: string }>) {
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify(ordenar(input))).digest("hex");
  return transacaoPecuaria(async tx => {
    await travarAnimais(tx, animais);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chave}`}))`;
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chave } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.usuarioId !== usuarioId || anterior.operacao !== acao || anterior.propriedadeId !== input.propriedadeId) throw new RebanhoError("CONFLITO", "Chave de reenvio usada com outros dados");
      const ids = anterior.resultadoIds;
      if (!ids || typeof ids !== "object" || Array.isArray(ids) || typeof ids.id !== "string") throw new RebanhoError("CONFLITO", "Não foi possível recuperar a confirmação");
      return { id: ids.id };
    }
    const salvo = await fn(tx);
    await tx.requisicaoPecuaria.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao: acao, hashPayload, resultadoIds: { id: salvo.id } } });
    return salvo;
  });
}
async function conferirParticipantes(tx: Prisma.TransactionClient, protocoloId: string, propriedadeId: number, inicioReferencia: string, itens: ParticipanteInput[], rodadaId?: string) {
  if (new Set(itens.map(i=>i.animalId)).size !== itens.length) throw new RebanhoError("VALIDACAO", "Selecione cada animal uma única vez", "itens");
  const protocolo = await tx.protocoloSanitario.findFirst({ where: { id: protocoloId, ativo: true, publicadoEm: { not: null } }, include: { etapas: { orderBy: { ordem: "asc" }, include: { produto: { select: { nome: true } }, tipoExame: { select: { nome: true } } } } } });
  if (!protocolo) throw new RebanhoError("VALIDACAO", "Selecione uma versão publicada ativa", "protocoloId");
  const resultado = [];
  for (const [indice,i] of itens.entries()) {
    const inicio = i.inicio ?? inicioReferencia;
    if (inicio !== inicioReferencia && !i.justificativaInicio?.trim()) throw new RebanhoError("VALIDACAO", "Explique a data inicial diferente da rodada", `itens.${indice}.justificativaInicio`);
    if (inicio <= hojeFazenda()) await conferirAnimalNoFato(tx, i.animalId, propriedadeId, dia(inicio), `itens.${indice}.inicio`);
    else if (!await tx.localizacaoAnimal.findFirst({ where: { animalId: i.animalId, propriedadeId, desde: { lte: dia(inicio) }, OR: [{ ate: null }, { ate: { gt: dia(inicio) } }], animal: { baixas: { none: { estornadaEm: null } } } } })) throw new RebanhoError("VALIDACAO", "Animal indisponível neste sítio no início", `itens.${indice}.animalId`);
    const anteriores = rodadaId ? await tx.execucaoProtocoloSanitario.findMany({ where: { rodadaId, animalId: i.animalId }, select: { id: true, canceladaEm: true } }) : [];
    if (anteriores.some(e=>!e.canceladaEm)) throw new RebanhoError("CONFLITO", "Animal já participa desta rodada", `itens.${indice}.animalId`);
    const tarefas = protocolo.etapas.map(e=>({ etapaId: e.id, previstaPara: iso(new Date(dia(inicio).getTime()+e.diaRelativo*86400000)), parametros: { tipo:e.tipo, produtoId:e.produtoId,produtoNomeSnapshot:e.produto?.nome,tipoExameId:e.tipoExameId,tipoExameNomeSnapshot:e.tipoExame?.nome,tipoAplicacaoId:e.tipoAplicacaoId,tipoAplicacaoNomeSnapshot:e.tipoAplicacaoNomeSnapshot,dose:e.dose?.toString()??null,unidade:e.unidade,via:e.via } }));
    resultado.push({ animalId:i.animalId,inicio,tarefas,avisos:[...(anteriores.length?["Reentrada: a participação anterior e seus fatos serão preservados."]:[]),...(tarefas.some(t=>t.previstaPara<hojeFazenda())?["Etapas passadas serão criadas como pendentes/atrasadas, sem realização automática."]:[])] });
  }
  return { itens: resultado, avisos: [] };
}
export async function preverRodada(input: CriarRodadaInput, rodadaId?: string) {
  input = criarRodadaSchema.parse(input);
  return transacaoPecuaria(async tx => {
    if (rodadaId) { const r=await buscarRodada(tx,rodadaId,input.propriedadeId); if(r.protocoloId!==input.protocoloId || iso(r.inicioReferencia)!==input.inicioReferencia) throw new RebanhoError("CONFLITO","A rodada mudou; atualize o calendário"); }
    return conferirParticipantes(tx,input.protocoloId,input.propriedadeId,input.inicioReferencia,input.itens,rodadaId);
  });
}
async function incluir(tx: Prisma.TransactionClient, r: { id:string;protocoloId:string;propriedadeId:number;inicioReferencia:Date }, itens: ParticipanteInput[], usuarioId:number|null) {
  await conferirParticipantes(tx,r.protocoloId,r.propriedadeId,iso(r.inicioReferencia),itens,r.id);
  for (const i of itens) {
    const e=await iniciarExecucaoTx(tx,{...i,protocoloId:r.protocoloId,propriedadeId:r.propriedadeId,inicio:i.inicio??iso(r.inicioReferencia)},usuarioId);
    await tx.execucaoProtocoloSanitario.update({where:{id:e.id},data:{rodadaId:r.id}});
    await auditar(tx,{entidade:"ExecucaoProtocoloSanitario",entidadeId:e.id,animalId:i.animalId,propriedadeId:r.propriedadeId,acao:"INCLUSAO_RODADA",usuarioId,depois:{rodadaId:r.id,inicio:e.inicio,justificativaInicio:i.justificativaInicio??null}});
  }
}
export async function criarRodada(input:CriarRodadaInput,usuarioId:number|null) {
  input=criarRodadaSchema.parse(input);
  const salvo=await confirmar(input,usuarioId,"RODADA_CRIAR",input.itens.map(i=>i.animalId),async tx=>{
    if(!await tx.propriedade.findFirst({where:{id:input.propriedadeId,ativo:true}}))throw new RebanhoError("VALIDACAO","Selecione um sítio ativo","propriedadeId");
    await conferirParticipantes(tx,input.protocoloId,input.propriedadeId,input.inicioReferencia,input.itens);
    const r=await tx.rodadaProtocoloSanitario.create({data:{nome:input.nome,protocoloId:input.protocoloId,propriedadeId:input.propriedadeId,inicioReferencia:dia(input.inicioReferencia)}});
    await incluir(tx,r,input.itens,usuarioId);
    await auditar(tx,{entidade:"RodadaProtocoloSanitario",entidadeId:r.id,propriedadeId:r.propriedadeId,acao:"CRIACAO",usuarioId,depois:r}); return r;
  }); return obterRodada(salvo.id,input.propriedadeId);
}
export async function adicionarParticipantes(id:string,input:unknown,usuarioId:number|null) {
  const b=adicionarParticipantesSchema.parse(input);
  return confirmar({...b,id},usuarioId,"RODADA_INCLUIR",b.itens.map(i=>i.animalId),async tx=>{ const r=await buscarRodada(tx,id,b.propriedadeId); if(r.propriedadeId!==b.propriedadeId)throw new RebanhoError("VALIDACAO","Inclua animais pelo sítio de origem da rodada","propriedadeId"); await incluir(tx,r,b.itens,usuarioId); return r; });
}
export async function retirarParticipante(id:string,execucaoId:string,input:unknown,usuarioId:number|null) {
  const b=retirarParticipanteSchema.parse(input);
  const previa=await prisma.execucaoProtocoloSanitario.findUnique({where:{id:execucaoId},select:{animalId:true}});
  if(!previa)throw new RebanhoError("NAO_ENCONTRADO","Participação não encontrada");
  return confirmar({...b,id,execucaoId},usuarioId,"RODADA_RETIRAR",[previa.animalId],async tx=>{
    await buscarRodada(tx,id,b.propriedadeId);
    const e=await tx.execucaoProtocoloSanitario.findFirst({where:{id:execucaoId,rodadaId:id}});
    if(!e||e.canceladaEm)throw new RebanhoError("CONFLITO","Participação já retirada ou indisponível");
    if(!await tx.execucaoProtocoloSanitario.findFirst({where:{id:e.id,...whereParticipante(b.propriedadeId)}}))throw new RebanhoError("NAO_ENCONTRADO","Participação não encontrada neste sítio");
    const salva=await tx.execucaoProtocoloSanitario.update({where:{id:execucaoId},data:{canceladaEm:new Date(),motivoCancelamento:b.motivo}});
    await auditar(tx,{entidade:"ExecucaoProtocoloSanitario",entidadeId:e.id,animalId:e.animalId,propriedadeId:b.propriedadeId,acao:"RETIRADA_RODADA",usuarioId,antes:e,depois:salva});return {id};
  });
}
export async function associarExecucoes(id:string,input:unknown,usuarioId:number|null) {
  const b=associarExecucoesSchema.parse(input);
  if(new Set(b.execucaoIds).size!==b.execucaoIds.length)throw new RebanhoError("VALIDACAO","Não repita participações","execucaoIds");
  const previas=await prisma.execucaoProtocoloSanitario.findMany({where:{id:{in:b.execucaoIds}},select:{animalId:true}});
  return confirmar({...b,id},usuarioId,"RODADA_ASSOCIAR",previas.map(e=>e.animalId),async tx=>{
    const r=await buscarRodada(tx,id,b.propriedadeId);
    if(r.propriedadeId!==b.propriedadeId)throw new RebanhoError("VALIDACAO","Associe execuções pelo sítio de origem da rodada","propriedadeId");
    for(const eid of b.execucaoIds){
      const e=await tx.execucaoProtocoloSanitario.findUnique({where:{id:eid}});
      if(!e||e.rodadaId||e.protocoloId!==r.protocoloId||e.propriedadeId!==r.propriedadeId)throw new RebanhoError("CONFLITO","Associe apenas execuções sem rodada da mesma versão e sítio","execucaoIds");
      if(!e.canceladaEm&&await tx.execucaoProtocoloSanitario.findFirst({where:{rodadaId:id,animalId:e.animalId,canceladaEm:null}}))throw new RebanhoError("CONFLITO","Animal já tem participação ativa nesta rodada","execucaoIds");
      await tx.execucaoProtocoloSanitario.update({where:{id:e.id},data:{rodadaId:id}});
      await auditar(tx,{entidade:"ExecucaoProtocoloSanitario",entidadeId:e.id,animalId:e.animalId,propriedadeId:b.propriedadeId,acao:"ASSOCIACAO_RODADA",usuarioId,antes:{rodadaId:null},depois:{rodadaId:id}});
    }return {id};
  });
}
export async function renomearRodada(id:string,input:unknown,usuarioId:number|null){
  const b=renomearRodadaSchema.parse(input);
  return confirmar({...b,id},usuarioId,"RODADA_RENOMEAR",[],async tx=>{const antes=await buscarRodada(tx,id,b.propriedadeId);if(antes.propriedadeId!==b.propriedadeId)throw new RebanhoError("VALIDACAO","Renomeie pelo sítio de origem da rodada","propriedadeId");const depois=await tx.rodadaProtocoloSanitario.update({where:{id},data:{nome:b.nome}});await auditar(tx,{entidade:"RodadaProtocoloSanitario",entidadeId:id,propriedadeId:b.propriedadeId,acao:"RENOMEACAO",usuarioId,antes,depois});return depois;});
}
export async function obterRodada(id:string,sitio:number|null){
  const r=await buscarRodada(prisma,id,sitio);
  const ts=await prisma.tarefaSanitaria.findMany({where:{execucao:{rodadaId:id,...whereParticipante(sitio)}},include:includeTarefa});
  return {...r,participantes:await prisma.execucaoProtocoloSanitario.count({where:{rodadaId:id,...whereParticipante(sitio)}}),contagens:contar(ts)};
}
export async function listarRodadas(sitio:number|null,f:ConsultaSanitaria){
  const where:Prisma.RodadaProtocoloSanitarioWhereInput={...(f.animalId||f.buscaAnimal||f.loteId||f.de||f.ate||f.situacao?{execucoes:{some:{...whereParticipante(sitio,f),...(f.de||f.ate||f.situacao?{tarefas:{some:{...(f.de||f.ate?{previstaPara:intervalo(f)}:{}),AND:[estadoTarefa(f)]}}}:{})}}}:sitio==null?{}:{OR:[{propriedadeId:sitio},{execucoes:{some:whereParticipante(sitio)}}]})};
  const [rs,total]=await Promise.all([prisma.rodadaProtocoloSanitario.findMany({where,orderBy:[{inicioReferencia:"desc"},{id:"asc"}],...limites(f)}),prisma.rodadaProtocoloSanitario.count({where})]);
  return {itens:await Promise.all(rs.map(r=>obterRodada(r.id,sitio))),total,pagina:f.pagina,porPagina:f.porPagina};
}
export async function listarParticipantes(id:string,sitio:number|null,f:ConsultaSanitaria){
  await buscarRodada(prisma,id,sitio);const where={rodadaId:id,...whereParticipante(sitio,f)};
  const [itens,total]=await Promise.all([prisma.execucaoProtocoloSanitario.findMany({where,include:{animal},orderBy:[{inicio:"asc"},{id:"asc"}],...limites(f)}),prisma.execucaoProtocoloSanitario.count({where})]);return {itens:itens.map(e=>({...e,propriedadeAtualId:e.animal.localizacoes[0]?.propriedadeId??null,propriedadeAtual:e.animal.localizacoes[0]?.propriedade??null,propriedadeContextoId:e.animal.localizacoes[0]?.propriedadeId??e.animal.baixas[0]?.localizacaoFechada?.propriedadeId??null})),total,pagina:f.pagina,porPagina:f.porPagina};
}
function filtrarTarefas(ts:Tarefa[],f:ConsultaSanitaria){return ts.filter(t=>{
  if(f.de&&iso(t.previstaPara)<f.de||f.ate&&iso(t.previstaPara)>f.ate)return false;
  if(!f.situacao)return true;
  return f.situacao==="ATRASADA"?situacaoTarefa(t)==="PENDENTE"&&iso(t.previstaPara)<hojeFazenda():situacaoTarefa(t)===f.situacao;
});}
export async function listarEtapas(id:string,sitio:number|null,f:ConsultaSanitaria){
  const r=await buscarRodada(prisma,id,sitio);
  const etapas=await prisma.etapaProtocoloSanitario.findMany({where:{protocoloId:r.protocoloId},orderBy:{ordem:"asc"}});
  const ts=await prisma.tarefaSanitaria.findMany({where:{execucao:{rodadaId:id,...whereParticipante(sitio)}},include:includeTarefa});
  const filtradas=await prisma.tarefaSanitaria.findMany({where:{execucao:{rodadaId:id,...whereParticipante(sitio,f)}},include:includeTarefa});
  return {itens:etapas.slice((f.pagina-1)*f.porPagina,f.pagina*f.porPagina).map(e=>({...e,dose:e.dose?.toString()??null,parametros:ts.find(t=>t.etapaId===e.id)?.parametros??{tipo:e.tipo},contagens:contar(ts.filter(t=>t.etapaId===e.id)),contagensFiltradas:contar(filtrarTarefas(filtradas.filter(t=>t.etapaId===e.id),f))})),total:etapas.length,pagina:f.pagina,porPagina:f.porPagina};
}
export async function listarTarefasEtapa(id:string,etapaId:string,sitio:number|null,f:ConsultaSanitaria){
  await buscarRodada(prisma,id,sitio);
  const where:Prisma.TarefaSanitariaWhereInput={etapaId,execucao:{rodadaId:id,...whereParticipante(sitio,f)},...(f.de||f.ate?{previstaPara:intervalo(f)}:{}),AND:[estadoTarefa(f)]};
  const [ts,total]=await Promise.all([prisma.tarefaSanitaria.findMany({where,include:includeTarefa,orderBy:[{previstaPara:"asc"},{id:"asc"}],...limites(f)}),prisma.tarefaSanitaria.count({where})]);
  const localizacoes=await prisma.localizacaoAnimal.findMany({where:{animalId:{in:ts.map(t=>t.execucao.animalId)}},select:{animalId:true,desde:true,ate:true,propriedade:{select:{id:true,nome:true}}},orderBy:{desde:"desc"}});
  return {itens:ts.map(t=>({...t,propriedadePrevista:localizacoes.find(l=>l.animalId===t.execucao.animalId&&l.desde<=t.previstaPara&&(!l.ate||l.ate>t.previstaPara))?.propriedade??null,propriedadeAtualId:t.execucao.animal.localizacoes[0]?.propriedadeId??null,propriedadeAtual:t.execucao.animal.localizacoes[0]?.propriedade??null,situacao:situacaoTarefa(t),aplicacao:t.aplicacoes.find(a=>a.status==="VALIDO")??null,exame:t.exames.find(e=>e.status==="VALIDO")??null})),total,pagina:f.pagina,porPagina:f.porPagina};
}
export async function listarSemRodada(sitio:number|null,f:ConsultaSanitaria,protocoloId?:string){
  const where={rodadaId:null,...whereParticipante(sitio,f),...(protocoloId?{protocoloId}:{})};
  const [itens,total]=await Promise.all([prisma.execucaoProtocoloSanitario.findMany({where,include:{animal,protocolo:{select:{id:true,nome:true,versao:true}}},orderBy:[{inicio:"desc"},{id:"asc"}],...limites(f)}),prisma.execucaoProtocoloSanitario.count({where})]);return {itens,total,pagina:f.pagina,porPagina:f.porPagina};
}
