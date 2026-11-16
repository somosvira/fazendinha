import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

export const momentoAcaoSchema = z.object({ nome: z.string().trim().min(1).max(120), ordem: z.number().int().positive().max(100), instrucoesGerais: z.string().trim().max(2000).nullish(), modoAtendimento: z.enum(["AUTOMATIZADA", "MANUAL"]).nullish(), politicaExecucao: z.enum(["CONFIRMACAO_OBRIGATORIA", "AUTOMATICA_EXCECAO"]).optional(), horarioPadrao: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(), fusoHorario: z.string().refine(v => { try { new Intl.DateTimeFormat("pt-BR", { timeZone: v }); return true; } catch { return false; } }, "Fuso horário inválido").nullish() }).strict();
export type MomentoAcao = z.input<typeof momentoAcaoSchema>;

/** Agrupamento é explícito. Mesma data/intervalo nunca cria um momento. */
export function momentosDasAcoes(acoes: Array<{ tipo?: string; momento?: MomentoAcao | null }>) {
  const momentos = new Map<number, MomentoAcao>();
  for (const [i, acao] of acoes.entries()) {
    if (!acao.momento) continue;
    const parsed = momentoAcaoSchema.parse(acao.momento);
    const momento = { ...parsed, politicaExecucao: parsed.politicaExecucao ?? "CONFIRMACAO_OBRIGATORIA" as const };
    if (momento.politicaExecucao === "AUTOMATICA_EXCECAO" && (!momento.horarioPadrao || !momento.fusoHorario)) throw new RebanhoError("VALIDACAO", "Etapa automática exige horário padrão e fuso horário", `etapas.${i}.momento`);
    if (momento.politicaExecucao === "AUTOMATICA_EXCECAO" && momento.fusoHorario !== "America/Sao_Paulo") throw new RebanhoError("VALIDACAO", "A automação utiliza o fuso de Brasília (America/Sao_Paulo)", `etapas.${i}.momento.fusoHorario`);
    if (momento.politicaExecucao === "AUTOMATICA_EXCECAO" && acao.tipo && !["APLICACAO", "RETIRADA"].includes(acao.tipo)) throw new RebanhoError("VALIDACAO", "Somente aplicações e dispositivos permitem execução automática", `etapas.${i}.momento.politicaExecucao`);
    const anterior = momentos.get(momento.ordem);
    if (anterior && (anterior.nome !== momento.nome || (anterior.instrucoesGerais ?? null) !== (momento.instrucoesGerais ?? null) || (anterior.modoAtendimento ?? null) !== (momento.modoAtendimento ?? null) || anterior.politicaExecucao !== momento.politicaExecucao || anterior.horarioPadrao !== momento.horarioPadrao || anterior.fusoHorario !== momento.fusoHorario)) throw new RebanhoError("VALIDACAO", "A mesma ordem de momento precisa conservar nome, instruções e modo de atendimento", `etapas.${i}.momento`);
    momentos.set(momento.ordem, momento);
  }
  return [...momentos.values()].sort((a, b) => a.ordem - b.ordem);
}

export async function associarMomentosAcoesTx(tx: Prisma.TransactionClient, protocoloId: string, acoes: Array<{ tipo?: string; momento?: MomentoAcao | null }>) {
  const momentos = momentosDasAcoes(acoes);
  if (momentos.some(m => m.politicaExecucao === "AUTOMATICA_EXCECAO")) {
    const protocolo = await tx.protocolo.findUniqueOrThrow({ where: { id: protocoloId }, select: { tipo: true } });
    if (protocolo.tipo !== "REPRODUTIVO") throw new RebanhoError("VALIDACAO", "Execução automática programada está disponível somente em Reprodução");
  }
  for (const momento of momentos) {
    const criado = await tx.momentoProtocolo.create({ data: { protocoloId, ...momento } });
    const ordens = acoes.flatMap((a, i) => a.momento?.ordem === momento.ordem ? [i + 1] : []);
    await tx.etapaProtocolo.updateMany({ where: { protocoloId, ordem: { in: ordens } }, data: { momentoId: criado.id } });
  }
}
export function snapshotMomento(momento: { id: string; nome: string; ordem: number; instrucoesGerais?: string | null; modoAtendimento?: string | null; politicaExecucao?: string; horarioPadrao?: string | null; fusoHorario?: string | null } | null | undefined) {
  return momento ? { id: momento.id, politicaExecucao: momento.politicaExecucao ?? "CONFIRMACAO_OBRIGATORIA", ...(momento.horarioPadrao ? { horarioPadrao: momento.horarioPadrao } : {}), ...(momento.fusoHorario ? { fusoHorario: momento.fusoHorario } : {}), nome: momento.nome, ordem: momento.ordem, ...(momento.instrucoesGerais != null ? { instrucoesGerais: momento.instrucoesGerais } : {}), ...(momento.modoAtendimento != null ? { modoAtendimento: momento.modoAtendimento } : {}) } : undefined;
}
