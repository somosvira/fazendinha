import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data inválida");
export const periodoRelatorioPartosSchema = z.object({ inicio: dia, fim: dia }).strict().refine(v => v.inicio <= v.fim, { message: "O fim não pode anteceder o início", path: ["fim"] });

/** A propriedade é o sítio do parto, não a localização atual da matriz. */
export async function emitirRelatorioPartosTx(tx: Prisma.TransactionClient, input: { propriedadeId: number; inicio: string; fim: string }) {
  const periodo = periodoRelatorioPartosSchema.parse({ inicio: input.inicio, fim: input.fim });
  if (!Number.isInteger(input.propriedadeId) || input.propriedadeId <= 0) throw new RebanhoError("VALIDACAO", "Selecione um sítio para emitir o relatório");
    const partos = await tx.partoAnimal.findMany({
      where: { propriedadeId: input.propriedadeId, status: "VALIDO", data: { gte: new Date(periodo.inicio), lte: new Date(periodo.fim) } },
      orderBy: [{ data: "asc" }, { id: "asc" }],
      include: {
        animal: { select: { id: true, brinco: true, nome: true } },
        vinculosPesagem: { where: { revogadoEm: null }, include: { pesagem: true }, orderBy: { criadoEm: "asc" } },
        examesPosParto: { where: { propriedadeId: input.propriedadeId, status: "VALIDO", finalidadePrincipal: "ESCORE_CORPORAL" }, include: { resultados: { where: { vigente: true }, select: { campo: true, valor: true } } }, orderBy: { data: "asc" } },
        ocorrenciasRetencaoPlacenta: { where: { propriedadeId: input.propriedadeId, status: "VALIDO" }, select: { id: true, inicio: true, fim: true }, orderBy: { inicio: "asc" } },
      },
    });
    const ids = partos.map(p => p.id);
    const crias = ids.length ? await tx.criaParto.findMany({
      where: { partoId: { in: ids } }, orderBy: [{ partoId: "asc" }, { ordem: "asc" }],
      include: { fornecimentosColostro: { where: { propriedadeId: input.propriedadeId, status: "VALIDO" }, orderBy: [{ data: "asc" }, { criadoEm: "asc" }], select: { id: true, data: true, ocorridoEm: true, horarioEstimado: true, quantidadeLitros: true, unidadeInformada: true, metodoQualidade: true, qualidadeBrix: true, qualidadeClassificacao: true, tipo: true, forma: true, responsavel: true, observacao: true } } },
    }) : [];
    const autoresIds = [...new Set(partos.flatMap(p => p.criadoPorId == null ? [] : [p.criadoPorId]))];
    const autores = autoresIds.length ? await tx.usuario.findMany({ where: { id: { in: autoresIds } }, select: { id: true, nome: true } }) : [];
    const autoresPorId = new Map(autores.map(a => [a.id, a.nome]));
    const criasPorParto = new Map<string, typeof crias>();
    for (const cria of crias) criasPorParto.set(cria.partoId, [...(criasPorParto.get(cria.partoId) ?? []), cria]);
    const linhas = partos.map(p => ({
      id: p.id, versao: p.versao, matriz: p.animal, data: p.data.toISOString().slice(0, 10), ocorridoEm: p.ocorridoEm?.toISOString() ?? null,
      horarioEstimado: p.horarioEstimado, desfecho: p.desfecho, tipo: p.tipo, induzido: p.induzido,
      dificuldade: p.dificuldade, assistenciaDescricao: p.assistenciaDescricao, retencaoPlacenta: p.retencaoPlacenta,
      responsavel: p.responsavel, observacao: p.observacao, lancador: p.criadoPorId == null ? null : { id: p.criadoPorId, nome: autoresPorId.get(p.criadoPorId) ?? null },
      criadoEm: p.criadoEm.toISOString(), ocorrenciasRetencaoPlacenta: p.ocorrenciasRetencaoPlacenta,
      pesosMatriz: p.vinculosPesagem.filter(v => v.sujeito === "MATRIZ" && !v.criaId).map(v => ({ id: v.pesagem.id, data: v.pesagem.data.toISOString().slice(0, 10), pesoKg: v.pesagem.pesoKg.toString() })),
      escoresMatriz: p.examesPosParto.map(e => ({ id: e.id, data: e.data.toISOString().slice(0, 10), responsavel: e.responsavel, resultados: e.resultados })),
      crias: (criasPorParto.get(p.id) ?? []).map(c => ({
        id: c.id, animalId: c.animalId, ordem: c.ordem, sexo: c.sexo, viva: c.viva, filiacaoSnapshot: c.filiacaoSnapshot,
        pesos: p.vinculosPesagem.filter(v => v.sujeito === "CRIA" && v.criaId === c.id).map(v => ({ id: v.pesagem.id, data: v.pesagem.data.toISOString().slice(0, 10), pesoKg: v.pesagem.pesoKg.toString() })),
        colostro: c.fornecimentosColostro.map(f => ({ ...f, data: f.data.toISOString().slice(0, 10), ocorridoEm: f.ocorridoEm?.toISOString() ?? null, quantidadeLitros: f.quantidadeLitros?.toString() ?? null, qualidadeBrix: f.qualidadeBrix?.toString() ?? null })),
      })),
    }));
    // Retorna uma emissão autocontida. Reimpressão/exportação usa o mesmo objeto, sem novas consultas.
    return { versao: 1 as const, emitidoEm: new Date().toISOString(), propriedadeId: input.propriedadeId, periodo, totalPartos: linhas.length, partos: linhas };
}

export async function emitirRelatorioPartos(input: { propriedadeId: number; inicio: string; fim: string }) {
  return prisma.$transaction(tx => emitirRelatorioPartosTx(tx, input), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
