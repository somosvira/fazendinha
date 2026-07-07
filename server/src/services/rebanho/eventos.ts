import { prisma } from "../../db.js";
import { toTimeline, type EventoTimelineDTO } from "./eventos.mappers.js";
import type { CriarEventoInput } from "./eventos.schemas.js";
import { reconstruirLactacoes, recomputarResumoReproducao, type EvtRepro } from "./reproducao.recompute.js";
import { calcularTaxaConcepcao, type TaxaConcepcaoMetodo } from "./reproducao.concepcao.js";
import { getNumero } from "./parametros.js";

export class EventoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}
const d = (s?: string) => (s ? new Date(s) : undefined);
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

export async function recomputarAnimal(animalId: number): Promise<void> {
  const animal = await prisma.animal.findUnique({ where: { id: animalId }, include: { eventosReprodutivos: true } });
  if (!animal) return;
  const evs: EvtRepro[] = animal.eventosReprodutivos.map((e) => ({ tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado, dtPartoPrevista: iso(e.dtPartoPrevista), reprodutor: e.reprodutor }));
  const lacts = reconstruirLactacoes(evs, animal.numPartosEntrada);
  // rebuild Lactacao rows
  await prisma.lactacao.deleteMany({ where: { animalId } });
  if (lacts.length) await prisma.lactacao.createMany({ data: lacts.map((l) => ({ animalId, numero: l.numero, dtInicio: new Date(l.dtInicio), dtFim: l.dtFim ? new Date(l.dtFim) : null })) });
  const [pevDias, gestacaoDias, secagemAntec] = await Promise.all([
    getNumero("PEV_DIAS"),
    getNumero("GESTACAO_DIAS"),
    getNumero("SECAGEM_ANTEC"),
  ]);
  const r = recomputarResumoReproducao(evs, lacts, animal.numPartosEntrada, new Date().toISOString().slice(0, 10), {
    pevDias:      pevDias      ?? undefined,
    gestacaoDias: gestacaoDias ?? undefined,
    secagemAntec: secagemAntec ?? undefined,
  });
  await prisma.resumoAnimal.upsert({
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
  const e = await prisma.eventoReprodutivo.create({
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
  if (input.tipo === "TRANSFERENCIA_EMBRIAO") await prisma.animal.update({ where: { id: animalId }, data: { ehReceptora: true } });
  await recomputarAnimal(animalId);
  return toTimeline(e);
}

export async function excluirEvento(eventoId: number): Promise<void> {
  const e = await prisma.eventoReprodutivo.findUnique({ where: { id: eventoId } });
  if (!e) throw new EventoError("NAO_ENCONTRADO", "evento não encontrado");
  await prisma.eventoReprodutivo.delete({ where: { id: eventoId } });
  await recomputarAnimal(e.animalId);
}
