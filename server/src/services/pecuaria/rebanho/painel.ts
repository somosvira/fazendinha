import { Prisma, type ClasseMotivoBaixa, type TipoBaixa } from "@prisma/client";
import { prisma } from "../../../db.js";
import { hojeFazendaDate } from "./regras.js";
import { listar, whereSituacao } from "./animais.js";

export interface EventoPainel {
  tipo: "CADASTRO" | "BAIXA" | "ESTORNO";
  animalId: string;
  brinco: string;
  data: string;
}

export interface PainelGeralDTO {
  ativos: number;
  /** `categoriaId` nulo = sem categoria */
  porCategoria: Array<{ categoriaId: string | null; categoria: string; qtd: number }>;
  porSitio: Array<{ propriedadeId: number | null; nome: string; qtd: number }>;
  receptorasPct: number;
  /** baixas em vigor (não estornadas) nos últimos `periodoDias` dias, sem CADASTRO_INDEVIDO */
  baixas30d: number;
  baixasPorTipo: Array<{ tipo: TipoBaixa; qtd: number }>;
  baixasPorClasse: Array<{ classe: ClasseMotivoBaixa | "SEM_MOTIVO"; qtd: number }>;
  periodoDias: number;
  ultimosEventos: EventoPainel[];
}

const ORDEM_TIPO_BAIXA: TipoBaixa[] = ["VENDA", "ABATE", "MORTE", "DOACAO", "EXTRAVIO"];
const ORDEM_CLASSE_BAIXA: Array<ClasseMotivoBaixa | "SEM_MOTIVO"> = ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO", "MORTE", "SEM_MOTIVO"];

/** Visão geral do rebanho: contagens + últimos eventos, escopados por sítio quando aplicável. */
export async function buscarPainelGeral(escopo: number | null, periodoDias = 30): Promise<PainelGeralDTO> {
  // o painel de `listar` é calculado sobre todo o conjunto filtrado; a página pedida é mínima
  const { painel } = await listar({ situacao: "ATIVO", page: 1, pageSize: 1 }, escopo);

  const receptorasPct = painel.femeasAtivas > 0 ? Math.round((painel.receptorasAtivas / painel.femeasAtivas) * 1000) / 10 : 0;

  // corte no fuso da fazenda, não em UTC (R3/R6)
  const cutoff = hojeFazendaDate();
  cutoff.setDate(cutoff.getDate() - periodoDias);

  // mesmo critério de sítio da lista: ativo pela localização aberta, quem foi baixado pela localização que a baixa fechou
  const animalNoEscopo = whereSituacao({ situacao: "TODOS", propriedadeId: escopo });
  const baixaNoEscopo: Prisma.BaixaAnimalWhereInput = escopo != null ? { localizacaoFechada: { propriedadeId: escopo } } : {};
  // CADASTRO_INDEVIDO é o "excluir cadastro" (interno), não uma baixa de verdade — não conta
  // no painel de baixas nem aparece nos últimos eventos, nem quando estornada (K6)
  const baixaSemCadastroIndevido: Prisma.BaixaAnimalWhereInput = { ...baixaNoEscopo, tipo: { not: "CADASTRO_INDEVIDO" } };
  const baixaNoPeriodo: Prisma.BaixaAnimalWhereInput = { estornadaEm: null, data: { gte: cutoff }, ...baixaSemCadastroIndevido };

  const [baixasNoPeriodo, cadastros, baixas, estornos] = await Promise.all([
    prisma.baixaAnimal.findMany({ where: baixaNoPeriodo, select: { tipo: true, motivo: { select: { classe: true } } } }),
    prisma.animal.findMany({ where: animalNoEscopo, orderBy: { criadoEm: "desc" }, take: 10, select: { id: true, brinco: true, criadoEm: true } }),
    prisma.baixaAnimal.findMany({ where: baixaSemCadastroIndevido, orderBy: { criadoEm: "desc" }, take: 10, select: { animalId: true, data: true, criadoEm: true, animal: { select: { brinco: true } } } }),
    prisma.baixaAnimal.findMany({ where: { ...baixaSemCadastroIndevido, estornadaEm: { not: null } }, orderBy: { estornadaEm: "desc" }, take: 10, select: { animalId: true, estornadaEm: true, animal: { select: { brinco: true } } } }),
  ]);

  const porTipo = new Map<TipoBaixa, number>();
  const porClasse = new Map<ClasseMotivoBaixa | "SEM_MOTIVO", number>();
  for (const b of baixasNoPeriodo) {
    porTipo.set(b.tipo, (porTipo.get(b.tipo) ?? 0) + 1);
    const classe = b.motivo?.classe ?? "SEM_MOTIVO";
    porClasse.set(classe, (porClasse.get(classe) ?? 0) + 1);
  }
  const baixasPorTipo = ORDEM_TIPO_BAIXA.filter((t) => porTipo.has(t)).map((tipo) => ({ tipo, qtd: porTipo.get(tipo)! }));
  const baixasPorClasse = ORDEM_CLASSE_BAIXA.filter((c) => porClasse.has(c)).map((classe) => ({ classe, qtd: porClasse.get(classe)! }));

  // ordena pelo momento do registro (timestamp); exibe a data do fato
  const eventos: Array<EventoPainel & { ordenacao: Date }> = [
    ...cadastros.map((a) => ({ tipo: "CADASTRO" as const, animalId: a.id, brinco: a.brinco, ordenacao: a.criadoEm, data: a.criadoEm.toISOString().slice(0, 10) })),
    ...baixas.map((s) => ({ tipo: "BAIXA" as const, animalId: s.animalId, brinco: s.animal.brinco, ordenacao: s.criadoEm, data: s.data.toISOString().slice(0, 10) })),
    ...estornos.map((s) => ({ tipo: "ESTORNO" as const, animalId: s.animalId, brinco: s.animal.brinco, ordenacao: s.estornadaEm!, data: s.estornadaEm!.toISOString().slice(0, 10) })),
  ];
  eventos.sort((a, b) => b.ordenacao.getTime() - a.ordenacao.getTime());

  return {
    ativos: painel.totalAtivos,
    porCategoria: painel.porCategoria.map((c) => ({ categoriaId: c.categoria?.id ?? null, categoria: c.categoria?.nome ?? "Sem categoria", qtd: c.total })),
    porSitio: painel.porSitio.map((s) => ({ propriedadeId: s.propriedadeId, nome: s.nome, qtd: s.total })),
    receptorasPct,
    baixas30d: baixasNoPeriodo.length,
    baixasPorTipo,
    baixasPorClasse,
    periodoDias,
    ultimosEventos: eventos.slice(0, 10).map(({ tipo, animalId, brinco, data }) => ({ tipo, animalId, brinco, data })),
  };
}
