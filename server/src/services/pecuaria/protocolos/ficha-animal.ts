import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { participacaoNoEscopoOperacao, sqlTarefaNoEscopoOperacao } from "./operacao.escopo.js";
import { sqlSituacaoOperacional } from "./situacao.js";
import { sqlDemandaPendenteTarefa } from "../reproducao/acompanhamento.js";
import { diaIatf } from "../reproducao/horarios.calc.js";

export const consultaProtocolosAnimalSchema = z.object({
  animalId: z.string().uuid(), participacaoId: z.string().uuid().optional(), busca: z.string().trim().max(160).optional(),
  inicio: z.string().date().optional(), fim: z.string().date().optional(),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(10).default(10),
}).strict().refine(v => !v.inicio || !v.fim || v.inicio <= v.fim, "Período inválido");

type EtapaFicha = { id: string; nome: string; ordem: number; situacao: string; acompanhamentoPendente?: boolean };
export function faseProtocoloAnimal(etapas: EtapaFicha[], encerrado: boolean, escopoCompleto = true) {
  const ordenadas = [...etapas].sort((a,b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  const atendidas = ordenadas.filter(e => e.situacao === "ATENDIDO").length;
  const aberta = ordenadas.find(e => e.acompanhamentoPendente || !["ATENDIDO", "DISPENSADO", "ENCERRADO", "RETIRADO"].includes(e.situacao));
  return { escopoCompleto, total: ordenadas.length, atendidas, atual: encerrado ? null : aberta ? { nome: aberta.nome, numero: ordenadas.indexOf(aberta) + 1, situacao: aberta.acompanhamentoPendente ? "ACOMPANHAMENTO_PENDENTE" : aberta.situacao } : null,
    situacao: !escopoCompleto ? "ESCOPO_PARCIAL" : encerrado ? "ENCERRADO" : !ordenadas.length ? "SEM_ETAPAS" : aberta ? "EM_ANDAMENTO" : atendidas === ordenadas.length ? "CONCLUIDO" : "ETAPAS_ENCERRADAS" };
}

export function filtroPeriodoProtocolosAnimal(inicio?: string, fim?: string): Prisma.ParticipacaoProtocoloWhereInput {
  if (!inicio && !fim) return {};
  const limites=(precisao:"DIA"|"HORA")=>{const sufixo=precisao==="DIA"?"T00:00:00Z":"T00:00:00-03:00";return {...(inicio?{gte:new Date(`${inicio}${sufixo}`)}:{}),...(fim?{lt:new Date(new Date(`${fim}${sufixo}`).getTime()+86400000)}:{})};};
  return { OR: [
    { inicioEfetivo: limites("DIA"), precisaoInicioEfetivo: "DIA" },
    { inicioEfetivo: limites("HORA"), OR: [{precisaoInicioEfetivo:"HORA"},{precisaoInicioEfetivo:null,precisaoTemporal:"HORA"}] },
    { inicioEfetivo: limites("DIA"), precisaoInicioEfetivo:null,precisaoTemporal:"DIA" },
    { inicioEfetivo: null, inicio: limites("DIA"), precisaoTemporal: "DIA" },
    { inicioEfetivo: null, inicio: limites("HORA"), precisaoTemporal: "HORA" },
  ] };
}

/** A ficha mistura modos, mas conserva a participação e a prova histórica de sítio. */
export async function listarProtocolosAnimal(propriedadeId: number | null, entrada: z.infer<typeof consultaProtocolosAnimalSchema>) {
  const f = consultaProtocolosAnimalSchema.parse(entrada);
  return prisma.$transaction(async tx => {
    const where: Prisma.ParticipacaoProtocoloWhereInput = { animalId: f.animalId, ...(f.participacaoId ? {id:f.participacaoId} : {}), protocolo: { tipo: "REPRODUTIVO", ...(f.busca ? { nome: { contains: f.busca, mode: "insensitive" } } : {}) },
      AND: [participacaoNoEscopoOperacao(propriedadeId), filtroPeriodoProtocolosAnimal(f.inicio,f.fim)] };
    const total = await tx.participacaoProtocolo.count({ where });
    const pagina = Math.min(f.pagina, Math.max(1, Math.ceil(total / f.porPagina)));
    const participacoes = await tx.participacaoProtocolo.findMany({ where, include: { protocolo: { select: { id: true, nome: true, versao: true } }, rodada: { select: { id: true, nome: true } } }, orderBy: [{ inicio: "desc" }, { id: "asc" }], skip: (pagina - 1) * f.porPagina, take: f.porPagina });
    const agora = new Date();
    const itens = await Promise.all(participacoes.map(async p => {
      const etapas = await tx.$queryRaw<EtapaFicha[]>(Prisma.sql`SELECT t.id,coalesce(t."nomeSnapshot",e.nome) AS nome,e.ordem,${sqlSituacaoOperacional(agora)} AS situacao,${sqlDemandaPendenteTarefa()} AS "acompanhamentoPendente" FROM pecuaria."TarefaProtocolo" t JOIN pecuaria."ParticipacaoProtocolo" p ON p.id=t."participacaoId" JOIN pecuaria."EtapaProtocolo" e ON e.id=t."etapaId" WHERE p.id=${p.id} AND ${sqlTarefaNoEscopoOperacao(propriedadeId)}`);
      return { id: p.id, animalId: p.animalId, propriedadeId: p.propriedadeId, protocolo: p.protocolo, programacao: p.rodada,
        inicioReferencia: p.inicio.toISOString(), inicioEfetivo: p.inicioEfetivo?.toISOString() ?? null, dataInicio: diaIatf(p.inicioEfetivo??p.inicio,p.inicioEfetivo?p.precisaoInicioEfetivo??p.precisaoTemporal:p.precisaoTemporal), precisaoInicio: p.precisaoInicioEfetivo ?? p.precisaoTemporal,
        encerradoEm: p.canceladaEm?diaIatf(p.canceladaEm):null, motivoEncerramento: p.motivoCancelamento,
        fase: faseProtocoloAnimal(etapas, !!p.canceladaEm, propriedadeId == null || propriedadeId === p.propriedadeId) };
    }));
    return { itens, total, pagina, porPagina: f.porPagina };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
