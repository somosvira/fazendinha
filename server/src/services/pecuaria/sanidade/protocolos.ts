import { confirmarColetivo } from "./coletivos.js";
import { intervalo, limites, type ConsultaSanitaria } from "./consulta.js";
import { Prisma, type FinalidadeAplicacao } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, hojeFazenda, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarFato } from "../idempotencia.js";
import { travarUsosProduto } from "../../estoque/usos.js";

type Etapa = {
  diaRelativo: number; tipo: "APLICACAO" | "EXAME"; produtoId?: string | null; tipoExameId?: string | null;
  finalidade?: FinalidadeAplicacao | null; dose?: number | null; unidade?: string | null; via?: string | null;
  tipoAplicacaoId?: string | null;
};
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const somarDias = (data: Date, n: number) => new Date(data.getTime() + n * 86_400_000);

async function validarEtapas(tx: Prisma.TransactionClient, etapas: Etapa[]) {
  if (!etapas.length) throw new RebanhoError("VALIDACAO", "O protocolo precisa de ao menos uma etapa", "etapas");
  await travarUsosProduto(tx, etapas.flatMap((e) => e.produtoId ? [e.produtoId] : []));
  for (const [indice, e] of etapas.entries()) {
    if (!Number.isInteger(e.diaRelativo) || e.diaRelativo < 0) throw new RebanhoError("VALIDACAO", "Dia relativo inválido", `etapas.${indice}.diaRelativo`);
    if (e.tipo === "APLICACAO") {
      if (!e.produtoId || (!e.finalidade && !e.tipoAplicacaoId) || !e.dose || e.dose <= 0 || !e.unidade || e.tipoExameId) {
        throw new RebanhoError("VALIDACAO", "Etapa de aplicação precisa de Produto, finalidade, dose e unidade", `etapas.${indice}`);
      }
      if (!(await tx.produto.findFirst({ where: { id: e.produtoId, ativo: true, usoSanitario: true } }))) throw new RebanhoError("VALIDACAO", "Selecione um produto ativo com uso sanitário", `etapas.${indice}.produtoId`);
      const tipo = await tx.tipoAplicacaoSanitaria.findFirst({ where: { id: e.tipoAplicacaoId ?? (e.finalidade === "VACINA" ? "a0300000-0000-4000-8000-000000000002" : e.finalidade === "VERMIFUGO" ? "a0300000-0000-4000-8000-000000000003" : "a0300000-0000-4000-8000-000000000001"), ativo: true } });
      if (!tipo) throw new RebanhoError("VALIDACAO", "Tipo de aplicação inativo ou inexistente", `etapas.${indice}.tipoAplicacaoId`);
      e.tipoAplicacaoId = tipo.id;
    } else if (e.tipo === "EXAME") {
      if (!e.tipoExameId || e.produtoId || e.dose) throw new RebanhoError("VALIDACAO", "Etapa de exame precisa de Tipo de exame, sem Produto", `etapas.${indice}`);
      if (!(await tx.tipoExame.findFirst({ where: { id: e.tipoExameId, ativo: true } }))) throw new RebanhoError("VALIDACAO", "Tipo de exame não encontrado", `etapas.${indice}.tipoExameId`);
    }
  }
}

export async function listarProtocolos() {
  return prisma.protocoloSanitario.findMany({ include: { etapas: { orderBy: { ordem: "asc" } } }, orderBy: [{ nome: "asc" }, { versao: "desc" }] });
}

export async function criarProtocolo(input: { nome: string; descricao?: string | null; etapas: Etapa[] }, usuarioId: number | null, id?: string) {
  return prisma.$transaction(async (tx) => {
    await validarEtapas(tx, input.etapas);
    const existente = id ? await tx.protocoloSanitario.findUnique({ where: { id }, include: { etapas: true } }) : null;
    if (id && !existente) throw new RebanhoError("NAO_ENCONTRADO", "Protocolo não encontrado");
    if (existente?.publicadoEm) throw new RebanhoError("CONFLITO", "Protocolo publicado é imutável; crie nova versão");
    const ultima = await tx.protocoloSanitario.findFirst({ where: { nome: input.nome.trim() }, orderBy: { versao: "desc" } });
    const dados = { nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      etapas: { create: input.etapas.map((e, i) => ({ ordem: i + 1, diaRelativo: e.diaRelativo, tipo: e.tipo,
        produtoId: e.tipo === "APLICACAO" ? e.produtoId : null, tipoExameId: e.tipo === "EXAME" ? e.tipoExameId : null,
        finalidade: e.tipo === "APLICACAO" ? e.finalidade : null, dose: e.tipo === "APLICACAO" ? e.dose : null,
        tipoAplicacaoId: e.tipo === "APLICACAO" ? e.tipoAplicacaoId : null,
        unidade: e.tipo === "APLICACAO" ? e.unidade : null, via: e.via?.trim() || null })) },
    };
    const novo = existente ? await tx.protocoloSanitario.update({ where: { id: existente.id }, data: { ...dados, etapas: { deleteMany: {}, ...dados.etapas } }, include: { etapas: { orderBy: { ordem: "asc" } } } }) : await tx.protocoloSanitario.create({ data: { ...dados, versao: (ultima?.versao ?? 0) + 1 }, include: { etapas: { orderBy: { ordem: "asc" } } } });
    await auditar(tx, { entidade: "ProtocoloSanitario", entidadeId: novo.id, acao: existente ? "RASCUNHO_EDITADO" : "VERSAO_CRIADA", usuarioId, ...(existente ? { antes: existente } : {}), depois: novo });
    return novo;
  });
}

export async function publicarProtocolo(id: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const protocolo = await tx.protocoloSanitario.findUnique({ where: { id }, include: { etapas: true } });
    if (!protocolo) throw new RebanhoError("NAO_ENCONTRADO", "Protocolo não encontrado");
    if (protocolo.publicadoEm) throw new RebanhoError("CONFLITO", "Esta versão já foi publicada");
    await validarEtapas(tx, protocolo.etapas.map((e) => ({ ...e, dose: e.dose?.toNumber() ?? null, tipo: e.tipo as Etapa["tipo"] })));
    for (const etapa of protocolo.etapas) if (etapa.tipoAplicacaoId) {
      const tipo = await tx.tipoAplicacaoSanitaria.findUniqueOrThrow({ where: { id: etapa.tipoAplicacaoId } });
      await tx.etapaProtocoloSanitario.update({ where: { id: etapa.id }, data: { tipoAplicacaoNomeSnapshot: tipo.nome } });
    }
    const publicado = await tx.protocoloSanitario.update({ where: { id }, data: { publicadoEm: new Date() } });
    await auditar(tx, { entidade: "ProtocoloSanitario", entidadeId: id, acao: "PUBLICACAO", usuarioId, antes: protocolo, depois: publicado });
    return publicado;
  });
}

async function iniciarExecucaoTx(tx: Prisma.TransactionClient, input: { chave?: string; protocoloId: string; animalId: string; propriedadeId: number; inicio: string;
  ocorrenciaId?: string | null; operacaoServicoId?: string | null; confirmarSobreposicao?: boolean; justificativaSobreposicao?: string | null }, usuarioId: number | null) {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.inicio);
    // Início futuro continua permitido no planejamento, exigindo localização comprovada.
    if (data > new Date()) {
      const local = await tx.localizacaoAnimal.findFirst({ where: { animalId: input.animalId, propriedadeId: input.propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }, include: { animal: { select: { baixas: { where: { estornadaEm: null } } } } } });
      if (!local || local.animal.baixas.length) throw new RebanhoError("VALIDACAO", "Animal indisponível neste sítio no início do protocolo", "inicio");
    } else await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, data, "inicio");
    const protocolo = await tx.protocoloSanitario.findFirst({ where: { id: input.protocoloId, ativo: true, publicadoEm: { not: null } },
      include: { etapas: { orderBy: { ordem: "asc" } } } });
    if (!protocolo) throw new RebanhoError("VALIDACAO", "Selecione uma versão publicada do protocolo", "protocoloId");
    const simultaneas = await tx.execucaoProtocoloSanitario.findMany({ where: { animalId: input.animalId, canceladaEm: null,
      protocolo: { nome: { equals: protocolo.nome, mode: "insensitive" } },
      tarefas: { some: { dispensadaEm: null, aplicacoes: { none: { status: "VALIDO" } }, exames: { none: { status: "VALIDO" } } } },
    }, select: { id: true } });
    if (simultaneas.length && (!input.confirmarSobreposicao || (input.justificativaSobreposicao?.trim().length ?? 0) < 5)) {
      throw new RebanhoError("CONFLITO", "O animal já tem este protocolo pendente. Confirme a sobreposição com justificativa", "confirmarSobreposicao");
    }
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
          tipoAplicacaoId: e.tipoAplicacaoId, tipoAplicacaoNomeSnapshot: e.tipoAplicacaoNomeSnapshot,
          dose: e.dose?.toString() ?? null, unidade: e.unidade, via: e.via } })) },
    }, include: { tarefas: { orderBy: { previstaPara: "asc" } } } });
    await auditar(tx, { entidade: "ExecucaoProtocoloSanitario", entidadeId: execucao.id, animalId: input.animalId,
      propriedadeId: input.propriedadeId, acao: "INICIO", usuarioId, depois: { ...execucao,
        ...(simultaneas.length ? { sobreposicao: { execucaoIds: simultaneas.map((e) => e.id), justificativa: input.justificativaSobreposicao!.trim(), confirmada: true } } : {}) } });
    return execucao;
}

export async function iniciarExecucao(input: Parameters<typeof iniciarExecucaoTx>[1], usuarioId: number | null) {
  return confirmarFato(input, usuarioId, "PROTOCOLO", iniciarExecucaoTx, (tx, id) => tx.execucaoProtocoloSanitario.findUniqueOrThrow({ where: { id }, include: { tarefas: { orderBy: { previstaPara: "asc" } } } }));
}
export async function iniciarExecucaoColetivo(input: { chave: string; propriedadeId: number; itens: Parameters<typeof iniciarExecucaoTx>[1][] }, usuarioId: number | null) {
  return confirmarColetivo(input, usuarioId, "PROTOCOLO_COLETIVO", iniciarExecucaoTx);
}

export async function listarTarefas(propriedadeId: number | null, animalId?: string, filtro?: ConsultaSanitaria) {
  const where: Prisma.TarefaSanitariaWhereInput = { execucao: { ...(animalId ? { animalId } : {}),
    ...(propriedadeId != null || filtro?.loteId ? { animal: { localizacoes: { some: { ate: null,
      ...(propriedadeId == null ? {} : { propriedadeId }), ...(filtro?.loteId ? { loteId: filtro.loteId } : {}) } } } } : {}) },
    ...(filtro?.de || filtro?.ate ? { previstaPara: intervalo(filtro) } : {}) };
  const realizada: Prisma.TarefaSanitariaWhereInput = { OR: [{ aplicacoes: { some: { status: "VALIDO" } } }, { exames: { some: { status: "VALIDO" } } }] };
  if (filtro?.situacao === "EXECUCAO_CANCELADA") where.AND = [{ execucao: { canceladaEm: { not: null } } }];
  else if (filtro?.situacao === "DISPENSADA") where.AND = [{ execucao: { canceladaEm: null } }, { dispensadaEm: { not: null } }];
  else if (filtro?.situacao === "REALIZADA") where.AND = [{ execucao: { canceladaEm: null } }, { dispensadaEm: null }, realizada];
  else if (filtro?.situacao === "PENDENTE" || filtro?.situacao === "ATRASADA") where.AND = [{ execucao: { canceladaEm: null } }, { dispensadaEm: null }, { NOT: realizada }, ...(filtro.situacao === "ATRASADA" ? [{ previstaPara: { lt: dia(hojeFazenda()) } }] : [])];
  const tarefas = await prisma.tarefaSanitaria.findMany({ where, include: {
    execucao: { select: { animalId: true, propriedadeId: true, canceladaEm: true, protocolo: { select: { nome: true, versao: true } }, animal: { select: { localizacoes: { where: { ate: null }, select: { propriedadeId: true } } } } } },
    aplicacoes: { select: { id: true, status: true }, orderBy: { criadoEm: "desc" } }, exames: { select: { id: true, status: true }, orderBy: { criadoEm: "desc" } },
  }, orderBy: [{ previstaPara: "asc" }, { id: "asc" }], ...limites(filtro) });
  return tarefas.map((t) => {
    const aplicacao = t.aplicacoes.find((a) => a.status === "VALIDO") ?? null;
    const exame = t.exames.find((e) => e.status === "VALIDO") ?? null;
    const { animal, ...execucao } = t.execucao;
    return { ...t, execucao, propriedadeAtualId: animal.localizacoes[0]?.propriedadeId ?? null, aplicacao, exame,
      situacao: t.execucao.canceladaEm ? "EXECUCAO_CANCELADA" : t.dispensadaEm ? "DISPENSADA" : aplicacao || exame ? "REALIZADA" : "PENDENTE" };
  });
}

export async function dispensarTarefa(id: string, motivo: string, usuarioId: number | null, propriedadeId?: number) {
  return transacaoPecuaria(async (tx) => {
    const previa = await tx.tarefaSanitaria.findUnique({ where: { id }, select: { execucao: { select: { animalId: true } } } });
    if (!previa) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
    await travarAnimais(tx, [previa.execucao.animalId]);
    const original = await tx.tarefaSanitaria.findUnique({ where: { id }, include: { execucao: true, aplicacoes: { where: { status: "VALIDO" } }, exames: { where: { status: "VALIDO" } } } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
    if (propriedadeId != null && !(await tx.localizacaoAnimal.findFirst({ where: { animalId: original.execucao.animalId, propriedadeId, ate: null } }))) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada neste sítio");
    if (original.dispensadaEm || original.execucao.canceladaEm || original.aplicacoes.length || original.exames.length) {
      throw new RebanhoError("CONFLITO", "A tarefa já foi realizada, dispensada ou cancelada");
    }
    const salva = await tx.tarefaSanitaria.update({ where: { id }, data: { dispensadaEm: new Date(), motivoDispensa: motivo } });
    await auditar(tx, { entidade: "TarefaSanitaria", entidadeId: id, animalId: original.execucao.animalId, acao: "DISPENSA", usuarioId,
      propriedadeId: propriedadeId ?? original.execucao.propriedadeId, antes: original, depois: salva });
    return salva;
  });
}

export async function cancelarExecucao(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const original = await tx.execucaoProtocoloSanitario.findFirst({ where: { id, canceladaEm: null } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Execução não encontrada ou já cancelada");
    await travarAnimais(tx, [original.animalId]);
    if (!(await tx.localizacaoAnimal.findFirst({ where: { animalId: original.animalId, propriedadeId, ate: null } }))) throw new RebanhoError("NAO_ENCONTRADO", "Execução não encontrada neste sítio");
    const salva = await tx.execucaoProtocoloSanitario.update({ where: { id }, data: { canceladaEm: new Date(), motivoCancelamento: motivo } });
    await auditar(tx, { entidade: "ExecucaoProtocoloSanitario", entidadeId: id, animalId: original.animalId, propriedadeId, acao: "CANCELAMENTO", usuarioId, antes: original, depois: salva });
    return salva;
  });
}

export async function inativarProtocolo(id: string, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const antes = await tx.protocoloSanitario.findUnique({ where: { id } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Protocolo não encontrado");
    const depois = await tx.protocoloSanitario.update({ where: { id }, data: { ativo: false } });
    await auditar(tx, { entidade: "ProtocoloSanitario", entidadeId: id, acao: "INATIVACAO", usuarioId, antes, depois });
    return depois;
  });
}

export async function adiarTarefa(id: string, input: { previstaPara: string; motivo: string }, usuarioId: number | null, propriedadeId: number) {
  return transacaoPecuaria(async (tx) => {
    const previa = await tx.tarefaSanitaria.findUnique({ where: { id }, select: { execucao: { select: { animalId: true } } } });
    if (!previa) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
    await travarAnimais(tx, [previa.execucao.animalId]);
    const antes = await tx.tarefaSanitaria.findUnique({ where: { id }, include: { execucao: true, aplicacoes: { where: { status: "VALIDO" } }, exames: { where: { status: "VALIDO" } } } });
    if (!antes || !(await tx.localizacaoAnimal.findFirst({ where: { animalId: previa.execucao.animalId, propriedadeId, ate: null } }))) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada neste sítio");
    if (antes.dispensadaEm || antes.execucao.canceladaEm || antes.aplicacoes.length || antes.exames.length) throw new RebanhoError("CONFLITO", "Só uma tarefa pendente pode ser adiada");
    const previstaPara = dia(input.previstaPara);
    if (!Number.isFinite(previstaPara.getTime()) || previstaPara.toISOString().slice(0, 10) !== input.previstaPara || previstaPara <= antes.previstaPara) throw new RebanhoError("VALIDACAO", "Escolha uma data posterior à previsão atual", "previstaPara");
    if (input.motivo.trim().length < 5) throw new RebanhoError("VALIDACAO", "Informe o motivo do adiamento", "motivo");
    const depois = await tx.tarefaSanitaria.update({ where: { id }, data: { previstaPara } });
    await auditar(tx, { entidade: "TarefaSanitaria", entidadeId: id, animalId: antes.execucao.animalId, propriedadeId, acao: "ADIAMENTO", usuarioId, antes, depois: { ...depois, motivo: input.motivo.trim() } });
    return depois;
  });
}
