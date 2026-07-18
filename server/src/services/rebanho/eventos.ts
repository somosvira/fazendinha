import { prisma } from "../../db.js";
import type { Prisma } from "@prisma/client";
import { toTimeline, type EventoTimelineDTO } from "./eventos.mappers.js";
import type { CriarEventoInput } from "./eventos.schemas.js";
import {
  reconstruirLactacoes,
  recomputarResumoReproducao,
  planejarSincronizacaoLactacoes,
  type EvtRepro,
  type LactacaoEstrutural,
  type MutacaoEvento,
} from "./reproducao.recompute.js";
import { calcularTaxaConcepcao, type TaxaConcepcaoMetodo } from "./reproducao.concepcao.js";
import { getNumero } from "./parametros.js";

export { ConflitoLactacaoError } from "./reproducao.recompute.js";

export class EventoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}
const d = (s?: string) => (s ? new Date(s) : undefined);
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

// Cliente de transação Prisma (mesma superfície do PrismaClient p/ os models usados aqui).
type Tx = Prisma.TransactionClient;

// Recomputa o read-model do animal SEM destruir o histórico enriquecido de lactações.
// A `mutacao` (evento recém-criado/excluído) guia quais ciclos criar/encerrar/reabrir;
// os demais campos (producaoTotal, producao305, tipoAleitamento, induzida, duracaoDias)
// nunca são tocados. Roda dentro da transação do chamador — um conflito estrutural
// (ConflitoLactacaoError) aborta a mutação inteira em vez de apagar dados.
export async function recomputarAnimal(tx: Tx, animalId: number, mutacao: MutacaoEvento): Promise<void> {
  const animal = await tx.animal.findUnique({ where: { id: animalId }, include: { eventosReprodutivos: true } });
  if (!animal) return;
  const evs: EvtRepro[] = animal.eventosReprodutivos.map((e) => ({ id: e.id, tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado, dtPartoPrevista: iso(e.dtPartoPrevista), reprodutor: e.reprodutor, motivoSecagem: e.motivoSecagem }));

  // Sincronização pontual das lactações persistidas (não destrutiva).
  const persistidas: LactacaoEstrutural[] = (await tx.lactacao.findMany({ where: { animalId }, select: { id: true, numero: true, dtInicio: true, dtFim: true, motivoSecagem: true } }))
    .map((l) => ({ id: l.id, numero: l.numero, dtInicio: iso(l.dtInicio)!, dtFim: iso(l.dtFim), motivoSecagem: l.motivoSecagem }));
  const operacoes = planejarSincronizacaoLactacoes(persistidas, mutacao, animal.numPartosEntrada);
  for (const op of operacoes) {
    if (op.tipo === "CRIAR") await tx.lactacao.create({ data: { animalId, numero: op.numero, dtInicio: new Date(op.dtInicio) } });
    else if (op.tipo === "ENCERRAR") await tx.lactacao.update({ where: { id: op.lactacaoId }, data: { dtFim: new Date(op.dtFim), motivoSecagem: op.motivoSecagem } });
    else await tx.lactacao.update({ where: { id: op.lactacaoId }, data: { dtFim: null, motivoSecagem: null } });
  }

  // O resumo reprodutivo deriva dos eventos (cálculo puro), independente da persistência acima.
  const lactsDerivadas = reconstruirLactacoes(evs, animal.numPartosEntrada);
  const [pevDias, gestacaoDias, secagemAntec] = await Promise.all([
    getNumero("PEV_DIAS"),
    getNumero("GESTACAO_DIAS"),
    getNumero("SECAGEM_ANTEC"),
  ]);
  const r = recomputarResumoReproducao(evs, lactsDerivadas, animal.numPartosEntrada, new Date().toISOString().slice(0, 10), {
    pevDias:      pevDias      ?? undefined,
    gestacaoDias: gestacaoDias ?? undefined,
    secagemAntec: secagemAntec ?? undefined,
  });
  await tx.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: d(r.ultimoDgData ?? undefined), ultimoDgResultado: r.ultimoDgResultado, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: d(r.previsaoSecagem ?? undefined) },
    update: { statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: d(r.ultimoDgData ?? undefined) ?? null, ultimoDgResultado: r.ultimoDgResultado, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: d(r.previsaoSecagem ?? undefined) ?? null },
  });
}

// KPI de reprodução: taxa de concepção por método (IA × TE) em todo o rebanho.
// Lê os eventos e delega ao cálculo puro (que pareia diagnóstico → cobertura).
export async function taxaConcepcaoRebanho(): Promise<TaxaConcepcaoMetodo[]> {
  const evs = await prisma.eventoReprodutivo.findMany({
    where: { tipo: { in: ["INSEMINACAO", "TRANSFERENCIA_EMBRIAO", "DIAGNOSTICO"] } },
    select: { animalId: true, tipo: true, data: true, resultado: true },
  });
  return calcularTaxaConcepcao(evs.map((e) => ({ animalId: e.animalId, tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado })));
}

export async function listarEventos(animalId: number): Promise<EventoTimelineDTO[]> {
  const evs = await prisma.eventoReprodutivo.findMany({ where: { animalId }, orderBy: { data: "desc" } });
  return evs.map(toTimeline);
}

export async function registrarEvento(animalId: number, input: CriarEventoInput): Promise<EventoTimelineDTO> {
  if (!(await prisma.animal.findUnique({ where: { id: animalId } }))) throw new EventoError("NAO_ENCONTRADO", "animal não encontrado");
  const doadoraId = (input as any).doadoraId as number | undefined;
  if (doadoraId != null && !(await prisma.animal.findUnique({ where: { id: doadoraId } }))) throw new EventoError("NAO_ENCONTRADO", "doadora não encontrada");
  // Evento + sincronização de lactações + resumo na mesma transação: se a sincronização
  // recusar (conflito estrutural), nada é gravado — o evento não vaza sem read-model coerente.
  return prisma.$transaction(async (tx) => {
    const e = await tx.eventoReprodutivo.create({
      data: {
        animalId, tipo: input.tipo, data: new Date(input.data), observacao: (input as any).observacao,
        reprodutor: (input as any).reprodutor, protocolo: (input as any).protocolo,
        resultado: (input as any).resultado, dtPartoPrevista: d((input as any).dtPartoPrevista),
        tipoParto: (input as any).tipoParto, numCrias: (input as any).numCrias, sexoCria: (input as any).sexoCria,
        motivoSecagem: (input as any).motivoSecagem, doadoraId,
      },
    });
    // Uma transferência de embrião marca o papel de receptora do animal que recebe
    // (barriga de aluguel). Flag sticky: fica marcada mesmo que o evento seja excluído.
    if (input.tipo === "TRANSFERENCIA_EMBRIAO") await tx.animal.update({ where: { id: animalId }, data: { ehReceptora: true } });
    await recomputarAnimal(tx, animalId, { tipo: "CRIACAO", evento: { id: e.id, tipo: e.tipo, data: iso(e.data)!, motivoSecagem: e.motivoSecagem } });
    return toTimeline(e);
  });
}

export async function excluirEvento(eventoId: number): Promise<void> {
  const e = await prisma.eventoReprodutivo.findUnique({ where: { id: eventoId } });
  if (!e) throw new EventoError("NAO_ENCONTRADO", "evento não encontrado");
  await prisma.$transaction(async (tx) => {
    await tx.eventoReprodutivo.delete({ where: { id: eventoId } });
    await recomputarAnimal(tx, e.animalId, { tipo: "EXCLUSAO", evento: { id: e.id, tipo: e.tipo, data: iso(e.data)!, motivoSecagem: e.motivoSecagem } });
  });
}
