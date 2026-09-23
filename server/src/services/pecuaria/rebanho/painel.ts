import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { listar } from "./animais.js";

export interface EventoPainel {
  tipo: "CADASTRO" | "SAIDA" | "ESTORNO";
  animalId: string;
  brinco: string;
  data: string;
}

export interface PainelGeralDTO {
  ativos: number;
  porCategoria: Array<{ categoria: string; qtd: number }>;
  porSitio: Array<{ propriedadeId: number | null; nome: string; qtd: number }>;
  receptorasPct: number;
  saidas30d: number;
  ultimosEventos: EventoPainel[];
}

/** Visão geral do rebanho: contagens + últimos eventos, escopados por sítio quando aplicável. */
export async function buscarPainelGeral(escopo: number | null): Promise<PainelGeralDTO> {
  const { painel } = await listar({ situacao: "TODOS", page: 1, pageSize: 100000 }, escopo);

  const receptorasPct = painel.femeasAtivas > 0 ? Math.round((painel.receptorasAtivas / painel.femeasAtivas) * 1000) / 10 : 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const whereAnimalNoEscopo: Prisma.AnimalWhereInput = escopo != null ? { localizacoes: { some: { propriedadeId: escopo } } } : {};

  const [saidas30d, cadastros, saidas, estornos] = await Promise.all([
    prisma.saidaAnimal.count({ where: { data: { gte: cutoff }, animal: whereAnimalNoEscopo } }),
    prisma.animal.findMany({ where: whereAnimalNoEscopo, orderBy: { criadoEm: "desc" }, take: 10, select: { id: true, brinco: true, criadoEm: true } }),
    prisma.saidaAnimal.findMany({ where: { animal: whereAnimalNoEscopo }, orderBy: { data: "desc" }, take: 10, select: { animalId: true, data: true, animal: { select: { brinco: true } } } }),
    prisma.saidaAnimal.findMany({ where: { animal: whereAnimalNoEscopo, estornadaEm: { not: null } }, orderBy: { estornadaEm: "desc" }, take: 10, select: { animalId: true, estornadaEm: true, animal: { select: { brinco: true } } } }),
  ]);

  const eventos: Array<EventoPainel & { ordenacao: Date }> = [
    ...cadastros.map((a) => ({ tipo: "CADASTRO" as const, animalId: a.id, brinco: a.brinco, ordenacao: a.criadoEm, data: a.criadoEm.toISOString().slice(0, 10) })),
    ...saidas.map((s) => ({ tipo: "SAIDA" as const, animalId: s.animalId, brinco: s.animal.brinco, ordenacao: s.data, data: s.data.toISOString().slice(0, 10) })),
    ...estornos.map((s) => ({ tipo: "ESTORNO" as const, animalId: s.animalId, brinco: s.animal.brinco, ordenacao: s.estornadaEm!, data: s.estornadaEm!.toISOString().slice(0, 10) })),
  ];
  eventos.sort((a, b) => b.ordenacao.getTime() - a.ordenacao.getTime());

  return {
    ativos: painel.totalAtivos,
    porCategoria: painel.porCategoria.map((c) => ({ categoria: c.categoria, qtd: c.total })),
    porSitio: painel.porSitio.map((s) => ({ propriedadeId: s.propriedadeId, nome: s.nome, qtd: s.total })),
    receptorasPct,
    saidas30d,
    ultimosEventos: eventos.slice(0, 10).map(({ tipo, animalId, brinco, data }) => ({ tipo, animalId, brinco, data })),
  };
}
