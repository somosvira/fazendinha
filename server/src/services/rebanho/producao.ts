import { prisma } from "../../db.js";
import { obterConfig } from "./config.js";
import { recomputarProducaoAnimal, ratearProducao, producao305De, selecionarProducao305, type ControleIn } from "./producao.recompute.js";
import { type ControleInput, type ProducaoLoteInput } from "./producao.schemas.js";
import { toTimelineControle } from "./producao.mappers.js";
import { carenciaAtiva as calcCarenciaAtiva } from "./carencia.calc.js";

const iso = (x: Date) => x.toISOString().slice(0, 10);

// Correção 305 oficial da lactação corrente: a aberta, ou — se todas secas — a mais recente
// por dtInicio (é a que carrega produção, conforme o schema). Retorna o valor importado do
// Ideagri para preferir sobre a estimativa linear; null quando o animal não tem esse dado.
function producao305Oficial(lactacoes: { dtInicio: Date; dtFim: Date | null; producao305: unknown }[]): number | null {
  const aberta = lactacoes.find((l) => l.dtFim == null);
  const corrente = aberta ?? lactacoes.slice().sort((a, b) => b.dtInicio.getTime() - a.dtInicio.getTime())[0];
  return corrente?.producao305 != null ? Number(corrente.producao305) : null;
}

export class ProducaoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", m: string) { super(m); }
}

export async function recomputarProducaoDoAnimal(animalId: number): Promise<void> {
  const animal = await prisma.animal.findUnique({ where: { id: animalId }, include: { lactacoes: true } });
  if (!animal) return;
  const temLact = animal.lactacoes.some((l) => l.dtFim == null);
  const oficial305 = producao305Oficial(animal.lactacoes);
  const { producaoModo } = await obterConfig();
  let r: { producaoMediaDia: number | null; producao305: number | null; producaoTendencia: string | null };
  if (producaoModo === "TANQUE_LOTE") {
    // último ProducaoLote do grupo do animal; senão da fazenda (grupoId null)
    const doGrupo = animal.grupoId != null ? await prisma.producaoLote.findFirst({ where: { grupoId: animal.grupoId }, orderBy: { data: "desc" } }) : null;
    const lote = doGrupo ?? (await prisma.producaoLote.findFirst({ where: { grupoId: null, propriedadeId: animal.propriedadeId }, orderBy: { data: "desc" } }));
    let mediaDia: number | null = null;
    if (lote) {
      const escopo = lote.grupoId != null ? { grupoId: lote.grupoId } : {};
      const vacas = await prisma.animal.count({ where: { status: "ATIVO", ...escopo, propriedadeId: animal.propriedadeId, resumo: { del: { not: null } } } });
      mediaDia = ratearProducao(Number(lote.litros), vacas);
    }
    r = { producaoMediaDia: mediaDia, producao305: producao305De(mediaDia, temLact), producaoTendencia: null };
  } else {
    const ctrls = await prisma.controleLeiteiro.findMany({ where: { animalId }, orderBy: { data: "desc" } });
    const arr: ControleIn[] = ctrls.map((c) => ({ data: iso(c.data), pesoTotal: Number(c.pesoTotal) }));
    r = recomputarProducaoAnimal(arr, temLact);
  }
  // A Correção 305 oficial (importada do Ideagri) prevalece sobre a projeção linear.
  r.producao305 = selecionarProducao305(oficial305, r.producao305);
  await prisma.resumoAnimal.upsert({
    where: { animalId },
    create: { animalId, producaoMediaDia: r.producaoMediaDia, producao305: r.producao305, producaoTendencia: r.producaoTendencia },
    update: { producaoMediaDia: r.producaoMediaDia, producao305: r.producao305, producaoTendencia: r.producaoTendencia },
  });
}

export async function recomputarProducaoTodos(): Promise<void> {
  const ids = (await prisma.animal.findMany({ where: { status: "ATIVO" }, select: { id: true } })).map((a) => a.id);
  for (const id of ids) await recomputarProducaoDoAnimal(id);
}

export async function registrarControle(animalId: number, input: ControleInput, propriedadeId: number | null = null) {
  if (!(await prisma.animal.findFirst({ where: { id: animalId, ...(propriedadeId != null ? { propriedadeId } : {}) } }))) throw new ProducaoError("NAO_ENCONTRADO", "animal não encontrado");
  const total = input.pesoTotal ?? (Number(input.peso1 ?? 0) + Number(input.peso2 ?? 0) + Number(input.peso3 ?? 0));
  const c = await prisma.controleLeiteiro.create({
    data: { animalId, data: new Date(input.data), peso1: input.peso1, peso2: input.peso2, peso3: input.peso3, pesoTotal: total },
  });
  await recomputarProducaoDoAnimal(animalId);
  return toTimelineControle(c);
}

export async function excluirControle(id: number, propriedadeId: number | null = null) {
  const c = await prisma.controleLeiteiro.findFirst({ where: { id, ...(propriedadeId != null ? { animal: { propriedadeId } } : {}) } });
  if (!c) throw new ProducaoError("NAO_ENCONTRADO", "controle não encontrado");
  await prisma.controleLeiteiro.delete({ where: { id } });
  await recomputarProducaoDoAnimal(c.animalId);
}

export async function registrarProducaoLote(input: ProducaoLoteInput, propriedadeId: number) {
  if (input.grupoId != null && !(await prisma.grupo.findFirst({ where: { id: input.grupoId, propriedadeId } }))) {
    throw new ProducaoError("NAO_ENCONTRADO", "lote não encontrado");
  }
  const l = await prisma.producaoLote.create({ data: { grupoId: input.grupoId ?? null, propriedadeId, data: new Date(input.data), litros: input.litros } });
  // recomputa os animais afetados
  const where = { status: "ATIVO" as const, propriedadeId, ...(l.grupoId != null ? { grupoId: l.grupoId } : {}) };
  for (const a of await prisma.animal.findMany({ where, select: { id: true } })) await recomputarProducaoDoAnimal(a.id);
  return { id: l.id };
}

export async function excluirProducaoLote(id: number, propriedadeId: number | null = null) {
  const l = await prisma.producaoLote.findFirst({ where: { id, ...(propriedadeId != null ? { propriedadeId } : {}) } });
  if (!l) throw new ProducaoError("NAO_ENCONTRADO", "produção de lote não encontrada");
  await prisma.producaoLote.delete({ where: { id } });
  const where = { status: "ATIVO" as const, ...(l.propriedadeId != null ? { propriedadeId: l.propriedadeId } : {}), ...(l.grupoId != null ? { grupoId: l.grupoId } : {}) };
  for (const a of await prisma.animal.findMany({ where, select: { id: true } })) await recomputarProducaoDoAnimal(a.id);
}

export async function agregarProducao(propriedadeId: number | null = null) {
  const { producaoModo } = await obterConfig();
  const animais = await prisma.animal.findMany({ where: { status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) }, include: { resumo: true } });
  const emLact = animais.filter((a) => a.resumo?.del != null);
  const totalDia = Math.round(emLact.reduce((s, a) => s + (a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : 0), 0) * 10) / 10;
  const mediaVaca = emLact.length ? Math.round((totalDia / emLact.length) * 10) / 10 : null;
  if (producaoModo === "TANQUE_LOTE") {
    const grupos = await prisma.grupo.findMany({ where: propriedadeId != null ? { propriedadeId } : {}, include: { animais: { where: { status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) }, include: { resumo: true } } } });
    const producoes = await prisma.producaoLote.findMany({
      where: { grupoId: { in: grupos.map((g) => g.id) }, ...(propriedadeId != null ? { propriedadeId } : {}) },
      orderBy: [{ grupoId: "asc" }, { data: "desc" }, { id: "desc" }],
    });
    const ultimaPorGrupo = new Map<number, (typeof producoes)[number]>();
    for (const p of producoes) if (p.grupoId != null && !ultimaPorGrupo.has(p.grupoId)) ultimaPorGrupo.set(p.grupoId, p);
    const lotes = grupos.map((g) => {
      const ult = ultimaPorGrupo.get(g.id) ?? null;
      const vacas = g.animais.filter((a) => a.resumo?.del != null).length;
      return { grupo: g.nome, litros: ult ? Number(ult.litros) : null, vacas, rateio: ult && vacas ? Math.round((Number(ult.litros) / vacas) * 10) / 10 : null };
    });
    return { modo: producaoModo, totalDia, emLactacao: emLact.length, lotes };
  }
  // Carência de leite ativa por animal em lactação (uma query só, agregada por animalId —
  // evita N+1). O leite dessas vacas não deve ser vendido enquanto a janela estiver aberta.
  const agora = new Date();
  const idsLact = emLact.map((a) => a.id);
  const aplicsCarencia = idsLact.length
    ? await prisma.eventoSanitario.findMany({
        where: { animalId: { in: idsLact }, tipo: "APLICACAO", carencia: { gt: 0 }, ...(propriedadeId != null ? { animal: { propriedadeId } } : {}) },
        select: { animalId: true, data: true, carencia: true },
      })
    : [];
  const porAnimal = new Map<number, { data: Date; carencia: number | null }[]>();
  for (const e of aplicsCarencia) {
    const lista = porAnimal.get(e.animalId) ?? [];
    lista.push({ data: e.data, carencia: e.carencia });
    porAnimal.set(e.animalId, lista);
  }
  const ranking = emLact
    .map((a) => {
      const c = calcCarenciaAtiva(porAnimal.get(a.id) ?? [], agora);
      return {
        numero: a.numero,
        nome: a.nome,
        litros: a.resumo?.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : 0,
        carencia: c ? { fim: c.fim.toISOString(), horasRestantes: c.horasRestantes, diasRestantes: c.diasRestantes } : null,
      };
    })
    .sort((x, y) => y.litros - x.litros);
  return { modo: producaoModo, totalDia, mediaVaca, emLactacao: emLact.length, ranking };
}
