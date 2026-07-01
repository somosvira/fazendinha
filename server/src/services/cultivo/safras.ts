import { prisma } from "../../db.js";
import { toSafraCultivoDTO } from "./mappers.js";
import type { CriarSafraCultivoInput, EditarSafraCultivoInput, ListSafraCultivoFiltros } from "./schemas.js";

export class SafraCultivoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "SAFRA_FECHADA", message: string) {
    super(message);
  }
}

const include = { resumo: true } as const;
// dataInicio é obrigatória (nunca null) — só dataFim aceita null (limpar).
const d = (s?: string) => (s ? new Date(s) : undefined);
const dn = (s?: string | null) => (s ? new Date(s) : s === null ? null : undefined);

export async function listarSafrasCultivo(f: ListSafraCultivoFiltros) {
  const where: any = {};
  if (f.cultura) where.cultura = f.cultura;
  if (f.fechada !== undefined) where.fechada = f.fechada;
  if (f.ano !== undefined) where.ano = f.ano;
  const rows = await prisma.safraCultivo.findMany({ where, include, orderBy: [{ ano: "desc" }, { nome: "asc" }] });
  return rows.map(toSafraCultivoDTO);
}

export async function obterSafraCultivo(id: number) {
  const row = await prisma.safraCultivo.findUnique({ where: { id }, include });
  return row ? toSafraCultivoDTO(row) : null;
}

export async function criarSafraCultivo(input: CriarSafraCultivoInput) {
  const row = await prisma.safraCultivo.create({
    data: {
      cultura: input.cultura,
      nome: input.nome,
      ano: input.ano,
      dataInicio: new Date(input.dataInicio),
      dataFim: dn(input.dataFim) ?? undefined,
      areaHaTotal: input.areaHaTotal ?? undefined,
      observacao: input.observacao ?? undefined,
    },
    include,
  });
  return toSafraCultivoDTO(row);
}

async function assertExiste(id: number) {
  const existing = await prisma.safraCultivo.findUnique({ where: { id } });
  if (!existing) throw new SafraCultivoError("NAO_ENCONTRADO", "safra de cultivo não encontrada");
  return existing;
}

export async function editarSafraCultivo(id: number, input: EditarSafraCultivoInput) {
  await assertExiste(id);
  const row = await prisma.safraCultivo.update({
    where: { id },
    data: {
      cultura: input.cultura,
      nome: input.nome,
      ano: input.ano,
      dataInicio: d(input.dataInicio),
      dataFim: dn(input.dataFim),
      areaHaTotal: input.areaHaTotal,
      observacao: input.observacao,
    },
    include,
  });
  return toSafraCultivoDTO(row);
}

export async function excluirSafraCultivo(id: number) {
  await assertExiste(id);
  await prisma.safraCultivo.delete({ where: { id } });
}

export async function fecharSafraCultivo(id: number) {
  await assertExiste(id);
  const row = await prisma.safraCultivo.update({ where: { id }, data: { fechada: true }, include });
  return toSafraCultivoDTO(row);
}

export async function reabrirSafraCultivo(id: number) {
  await assertExiste(id);
  const row = await prisma.safraCultivo.update({ where: { id }, data: { fechada: false }, include });
  return toSafraCultivoDTO(row);
}

// Resumo (read-model) — usado por GET /cultivo/safras/:id/resumo.
export async function obterResumoSafraCultivo(id: number) {
  await assertExiste(id);
  const resumo = await prisma.resumoSafraCultivo.findUnique({ where: { safraCultivoId: id } });
  return resumo;
}

// Guarda de fechamento (§6.3) — chamada pelos serviços de LancamentoCusto/
// ProducaoCultivo antes de criar/editar/excluir. Espelha MES_FECHADO.
export async function assertSafraAberta(safraCultivoId: number) {
  const safra = await prisma.safraCultivo.findUnique({ where: { id: safraCultivoId } });
  if (!safra) throw new SafraCultivoError("NAO_ENCONTRADO", "safra de cultivo não encontrada");
  if (safra.fechada) throw new SafraCultivoError("SAFRA_FECHADA", "safra fechada — operação não pode ser registrada");
}
