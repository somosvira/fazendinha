import { Prisma, type FinalidadeAplicacao } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";

type Etapa = {
  diaRelativo: number; tipo: "APLICACAO" | "EXAME"; produtoId?: string | null; tipoExameId?: string | null;
  finalidade?: FinalidadeAplicacao | null; dose?: number | null; unidade?: string | null; via?: string | null;
};
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const somarDias = (data: Date, n: number) => new Date(data.getTime() + n * 86_400_000);

async function validarEtapas(tx: Prisma.TransactionClient, etapas: Etapa[]) {
  if (!etapas.length) throw new RebanhoError("VALIDACAO", "O protocolo precisa de ao menos uma etapa", "etapas");
  for (const [indice, e] of etapas.entries()) {
    if (!Number.isInteger(e.diaRelativo) || e.diaRelativo < 0) throw new RebanhoError("VALIDACAO", "Dia relativo inválido", `etapas.${indice}.diaRelativo`);
    if (e.tipo === "APLICACAO") {
      if (!e.produtoId || !e.finalidade || !e.dose || e.dose <= 0 || !e.unidade || e.tipoExameId) {
        throw new RebanhoError("VALIDACAO", "Etapa de aplicação precisa de Produto, finalidade, dose e unidade", `etapas.${indice}`);
      }
      if (!(await tx.produto.findFirst({ where: { id: e.produtoId, ativo: true } }))) throw new RebanhoError("VALIDACAO", "Produto da etapa não encontrado", `etapas.${indice}.produtoId`);
    } else if (e.tipo === "EXAME") {
      if (!e.tipoExameId || e.produtoId || e.dose) throw new RebanhoError("VALIDACAO", "Etapa de exame precisa de Tipo de exame, sem Produto", `etapas.${indice}`);
      if (!(await tx.tipoExame.findFirst({ where: { id: e.tipoExameId, ativo: true } }))) throw new RebanhoError("VALIDACAO", "Tipo de exame não encontrado", `etapas.${indice}.tipoExameId`);
    }
  }
}

export async function listarProtocolos() {
  return prisma.protocoloSanitario.findMany({ include: { etapas: { orderBy: { ordem: "asc" } } }, orderBy: [{ nome: "asc" }, { versao: "desc" }] });
}

export async function criarProtocolo(input: { nome: string; descricao?: string | null; etapas: Etapa[] }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await validarEtapas(tx, input.etapas);
    const ultima = await tx.protocoloSanitario.findFirst({ where: { nome: input.nome.trim() }, orderBy: { versao: "desc" } });
    const novo = await tx.protocoloSanitario.create({ data: { nome: input.nome.trim(), versao: (ultima?.versao ?? 0) + 1,
      descricao: input.descricao?.trim() || null,
      etapas: { create: input.etapas.map((e, i) => ({ ordem: i + 1, diaRelativo: e.diaRelativo, tipo: e.tipo,
        produtoId: e.tipo === "APLICACAO" ? e.produtoId : null, tipoExameId: e.tipo === "EXAME" ? e.tipoExameId : null,
        finalidade: e.tipo === "APLICACAO" ? e.finalidade : null, dose: e.tipo === "APLICACAO" ? e.dose : null,
        unidade: e.tipo === "APLICACAO" ? e.unidade : null, via: e.via?.trim() || null })) },
    }, include: { etapas: { orderBy: { ordem: "asc" } } } });
    await auditar(tx, { entidade: "ProtocoloSanitario", entidadeId: novo.id, acao: "VERSAO_CRIADA", usuarioId, depois: novo });
    return novo;
  });
}

export async function publicarProtocolo(id: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const protocolo = await tx.protocoloSanitario.findUnique({ where: { id }, include: { etapas: true } });
    if (!protocolo) throw new RebanhoError("NAO_ENCONTRADO", "Protocolo não encontrado");
    if (protocolo.publicadoEm) throw new RebanhoError("CONFLITO", "Esta versão já foi publicada");
    await validarEtapas(tx, protocolo.etapas.map((e) => ({ ...e, dose: e.dose?.toNumber() ?? null, tipo: e.tipo as Etapa["tipo"] })));
    const publicado = await tx.protocoloSanitario.update({ where: { id }, data: { publicadoEm: new Date() } });
    await auditar(tx, { entidade: "ProtocoloSanitario", entidadeId: id, acao: "PUBLICACAO", usuarioId, antes: protocolo, depois: publicado });
    return publicado;
  });
}

export async function iniciarExecucao(input: { protocoloId: string; animalId: string; propriedadeId: number; inicio: string;
  ocorrenciaId?: string | null; operacaoServicoId?: string | null }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.inicio);
    const local = await tx.localizacaoAnimal.findFirst({ where: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } });
    if (!local) throw new RebanhoError("VALIDACAO", "Animal não estava neste sítio no início do protocolo", "inicio");
    const protocolo = await tx.protocoloSanitario.findFirst({ where: { id: input.protocoloId, ativo: true, publicadoEm: { not: null } },
      include: { etapas: { orderBy: { ordem: "asc" } } } });
    if (!protocolo) throw new RebanhoError("VALIDACAO", "Selecione uma versão publicada do protocolo", "protocoloId");
    if (input.ocorrenciaId && !(await tx.ocorrenciaSanitaria.findFirst({ where: { id: input.ocorrenciaId, animalId: input.animalId, status: "VALIDO" } }))) {
      throw new RebanhoError("VALIDACAO", "Ocorrência não pertence ao animal", "ocorrenciaId");
    }
    if (input.operacaoServicoId && !(await tx.operacao.findFirst({ where: { id: input.operacaoServicoId, propriedadeId: input.propriedadeId, tipo: "SERVICO", status: "CONFIRMADA" } }))) {
      throw new RebanhoError("VALIDACAO", "Serviço inválido para este sítio", "operacaoServicoId");
    }
    const execucao = await tx.execucaoProtocoloSanitario.create({ data: { protocoloId: protocolo.id,
      animalId: input.animalId, propriedadeId: input.propriedadeId, inicio: data,
      ocorrenciaId: input.ocorrenciaId ?? null, operacaoServicoId: input.operacaoServicoId ?? null,
      tarefas: { create: protocolo.etapas.map((e) => ({ etapaId: e.id, previstaPara: somarDias(data, e.diaRelativo),
        parametros: { tipo: e.tipo, produtoId: e.produtoId, tipoExameId: e.tipoExameId, finalidade: e.finalidade,
          dose: e.dose?.toString() ?? null, unidade: e.unidade, via: e.via } })) },
    }, include: { tarefas: { orderBy: { previstaPara: "asc" } } } });
    await auditar(tx, { entidade: "ExecucaoProtocoloSanitario", entidadeId: execucao.id, animalId: input.animalId,
      acao: "INICIO", usuarioId, depois: execucao });
    return execucao;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listarTarefas(propriedadeId: number | null, animalId?: string) {
  const tarefas = await prisma.tarefaSanitaria.findMany({ where: {
    ...(animalId ? { execucao: { animalId } } : {}),
    ...(propriedadeId == null ? {} : { execucao: { ...(animalId ? { animalId } : {}), propriedadeId } }),
  }, include: { execucao: { select: { animalId: true, propriedadeId: true, canceladaEm: true, protocolo: { select: { nome: true, versao: true } } } },
    aplicacao: { select: { id: true, status: true } }, exame: { select: { id: true, status: true } } },
  orderBy: [{ previstaPara: "asc" }, { id: "asc" }], take: 200 });
  return tarefas.map((t) => ({ ...t, situacao: t.execucao.canceladaEm ? "EXECUCAO_CANCELADA" : t.dispensadaEm ? "DISPENSADA"
    : t.aplicacao?.status === "VALIDO" || t.exame?.status === "VALIDO" ? "REALIZADA" : "PENDENTE" }));
}

export async function dispensarTarefa(id: string, motivo: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.tarefaSanitaria.findUnique({ where: { id }, include: { execucao: true, aplicacao: true, exame: true } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
    await travarAnimais(tx, [original.execucao.animalId]);
    if (original.dispensadaEm || original.execucao.canceladaEm || original.aplicacao?.status === "VALIDO" || original.exame?.status === "VALIDO") {
      throw new RebanhoError("CONFLITO", "A tarefa já foi realizada, dispensada ou cancelada");
    }
    const salva = await tx.tarefaSanitaria.update({ where: { id }, data: { dispensadaEm: new Date(), motivoDispensa: motivo } });
    await auditar(tx, { entidade: "TarefaSanitaria", entidadeId: id, animalId: original.execucao.animalId, acao: "DISPENSA", usuarioId,
      antes: original, depois: salva });
    return salva;
  });
}
