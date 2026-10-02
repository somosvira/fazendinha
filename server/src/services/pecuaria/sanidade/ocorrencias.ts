import { filtrosFatos, limites, type ConsultaSanitaria } from "./consulta.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

export async function listarDoencas(incluirInativos = false) {
  return prisma.doenca.findMany({ where: incluirInativos ? {} : { ativo: true }, orderBy: { nome: "asc" } });
}

export async function editarDoenca(id: string, input: { nome?: string; ativo?: boolean; motivoBaixaSugeridoId?: string | null }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const antes = await tx.doenca.findUnique({ where: { id } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Doença não encontrada");
    if (input.motivoBaixaSugeridoId && !(await tx.motivoBaixa.findUnique({ where: { id: input.motivoBaixaSugeridoId } }))) {
      throw new RebanhoError("VALIDACAO", "Motivo de baixa não encontrado", "motivoBaixaSugeridoId");
    }
    await tx.ocorrenciaSanitaria.updateMany({ where: { doencaId: id, doencaNomeSnapshot: null }, data: { doencaNomeSnapshot: antes.nome } });
    const depois = await tx.doenca.update({ where: { id }, data: { ...input, ...(input.nome ? { nome: input.nome.trim() } : {}) } });
    await auditar(tx, { entidade: "Doenca", entidadeId: id, acao: "EDICAO", usuarioId, antes, depois });
    return depois;
  });
}

export async function criarDoenca(nome: string, motivoBaixaSugeridoId: string | null, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    if (motivoBaixaSugeridoId && !(await tx.motivoBaixa.findUnique({ where: { id: motivoBaixaSugeridoId } }))) {
      throw new RebanhoError("VALIDACAO", "Motivo de baixa não encontrado", "motivoBaixaSugeridoId");
    }
    const doenca = await tx.doenca.create({ data: { nome: nome.trim(), motivoBaixaSugeridoId } });
    await auditar(tx, { entidade: "Doenca", entidadeId: doenca.id, acao: "CADASTRO", usuarioId, depois: doenca });
    return doenca;
  });
}

export async function listarOcorrencias(animalId: string | undefined, propriedadeId: number | null, filtro?: ConsultaSanitaria) {
  const lista = await prisma.ocorrenciaSanitaria.findMany({ where: { ...filtrosFatos(filtro, "inicio"), ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { doenca: { select: { id: true, nome: true } }, _count: { select: { aplicacoes: true, exames: true, execucoes: true } } },
    orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }], ...limites(filtro) });
  return lista.map((o) => ({ ...o, doenca: { ...o.doenca, nome: o.doencaNomeSnapshot ?? o.doenca.nome } }));
}

export async function criarOcorrencia(input: { animalId: string; propriedadeId: number; doencaId: string; inicio: string; observacao?: string | null }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    const inicio = dia(input.inicio);
    await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, inicio, "inicio");
    const doenca = await tx.doenca.findFirst({ where: { id: input.doencaId, ativo: true } });
    if (!doenca) throw new RebanhoError("VALIDACAO", "Selecione uma doença ativa", "doencaId");
    const criada = await tx.ocorrenciaSanitaria.create({ data: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      doencaId: input.doencaId, doencaNomeSnapshot: doenca.nome, inicio, observacao: input.observacao?.trim() || null } });
    await auditar(tx, { entidade: "OcorrenciaSanitaria", entidadeId: criada.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId, depois: criada });
    return criada;
  });
}

export async function encerrarOcorrencia(id: string, propriedadeId: number, input: { fim: string; desfecho: string }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const original = await tx.ocorrenciaSanitaria.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Ocorrência não encontrada");
    await travarAnimais(tx, [original.animalId]);
    const atual = await tx.ocorrenciaSanitaria.findUniqueOrThrow({ where: { id } });
    if (atual.fim) throw new RebanhoError("CONFLITO", "Ocorrência já encerrada");
    const fim = dia(input.fim);
    if (fim < atual.inicio) throw new RebanhoError("VALIDACAO", "O fim não pode anteceder o início", "fim");
    const baixa = await tx.baixaAnimal.findFirst({ where: { animalId: atual.animalId, estornadaEm: null } });
    if (fim > new Date() || (baixa && fim > baixa.data)) throw new RebanhoError("VALIDACAO", "O desfecho não pode ocorrer no futuro ou após a baixa", "fim");
    const salva = await tx.ocorrenciaSanitaria.update({ where: { id }, data: { fim, desfecho: input.desfecho.trim() } });
    await auditar(tx, { entidade: "OcorrenciaSanitaria", entidadeId: id, animalId: atual.animalId, propriedadeId, acao: "ENCERRAMENTO", usuarioId,
      antes: atual, depois: salva });
    return salva;
  });
}

export async function anularOcorrencia(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const original = await tx.ocorrenciaSanitaria.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Ocorrência não encontrada");
    await travarAnimais(tx, [original.animalId]);
    const fatos = await Promise.all([
      tx.aplicacaoProduto.count({ where: { ocorrenciaId: id, status: "VALIDO" } }),
      tx.exameAnimal.count({ where: { ocorrenciaId: id, status: "VALIDO" } }),
      tx.execucaoProtocoloSanitario.count({ where: { ocorrenciaId: id, canceladaEm: null } }),
    ]);
    if (fatos.some(Boolean)) throw new RebanhoError("CONFLITO", "A ocorrência tem fatos clínicos ativos; revise-os antes de anular");
    const salva = await tx.ocorrenciaSanitaria.update({ where: { id }, data: { status: "ANULADO", motivoAnulacao: motivo, anuladoEm: new Date() } });
    await auditar(tx, { entidade: "OcorrenciaSanitaria", entidadeId: id, animalId: original.animalId, propriedadeId, acao: "ANULACAO", usuarioId,
      antes: original, depois: { status: salva.status, motivo } });
    return salva;
  });
}
