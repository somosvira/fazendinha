import { validarReferenciasCusto, type ReferenciasCusto } from "../custos/referencias-planejadas.js";
import { associarMomentosAcoesTx, snapshotMomento, type MomentoAcao } from "../protocolos/momentos.js";
import crypto from "node:crypto";
import { registrarEventoTarefaTx } from "../protocolos/eventos.js";
import { condicaoSituacaoTarefa, situacaoTarefaComum, propriedadeRegularizacao, vinculoRegularizacaoSelect } from "../protocolos/situacao.js";
import { deslocarCalendario } from "../protocolos/calendario.calc.js";
import { carregarVersaoTx, reservarVersaoTx, publicarVersaoTx, inativarVersaoTx } from "../protocolos/versoes.js";
import { confirmarColetivo } from "./coletivos.js";
import { buscaAnimal, intervalo, limites, type ConsultaSanitaria } from "./consulta.js";
import { Prisma, type FinalidadeAplicacao } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, hojeFazenda, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarFato } from "../idempotencia.js";
import { travarUsosProduto } from "../../estoque/usos.js";

type Etapa = {
  referenciasCusto?: ReferenciasCusto;
  momento?: MomentoAcao | null; subtipo?: "APLICACAO" | "INSERCAO_DISPOSITIVO";
  diaRelativo: number; tipo: "APLICACAO" | "EXAME" | "MANEJO" | "RETIRADA"; produtoId?: string | null; tipoExameId?: string | null;
  finalidade?: FinalidadeAplicacao | null; dose?: number | null; unidade?: string | null; via?: string | null;
  tipoAplicacaoId?: string | null;
};
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const somarDias = (data: Date, n: number) => deslocarCalendario(data, n, "DIAS", "DIA");

async function validarEtapas(tx: Prisma.TransactionClient, etapas: Etapa[]) {
  if (!etapas.length) throw new RebanhoError("VALIDACAO", "O protocolo precisa de ao menos uma etapa", "etapas");
  await travarUsosProduto(tx, etapas.flatMap((e) => e.produtoId ? [e.produtoId] : []));
  for (const [indice, e] of etapas.entries()) {
    e.referenciasCusto = validarReferenciasCusto(e.referenciasCusto, e.unidade ?? null, e.tipo === "APLICACAO");
    if (!Number.isInteger(e.diaRelativo) || e.diaRelativo < 0) throw new RebanhoError("VALIDACAO", "Dia relativo inválido", `etapas.${indice}.diaRelativo`);
    if (e.tipo === "APLICACAO") {
      if (!e.produtoId || (!e.finalidade && !e.tipoAplicacaoId) || !e.dose || e.dose <= 0 || !e.unidade || e.tipoExameId) {
        throw new RebanhoError("VALIDACAO", "Etapa de aplicação precisa de Produto, finalidade, dose e unidade", `etapas.${indice}`);
      }
      if (!(await tx.produto.findFirst({ where: { id: e.produtoId, ativo: true, usoSanitario: true } }))) throw new RebanhoError("VALIDACAO", "Selecione um produto ativo com uso sanitário", `etapas.${indice}.produtoId`);
      const tipo = await tx.tipoAplicacaoSanitaria.findFirst({ where: { id: e.tipoAplicacaoId ?? (e.finalidade === "VACINA" ? "a0300000-0000-4000-8000-000000000002" : e.finalidade === "VERMIFUGO" ? "a0300000-0000-4000-8000-000000000003" : "a0300000-0000-4000-8000-000000000001"), ativo: true } });
      if (!tipo) throw new RebanhoError("VALIDACAO", "Tipo de aplicação inativo ou inexistente", `etapas.${indice}.tipoAplicacaoId`);
      e.tipoAplicacaoId = tipo.id;
    } else if (e.tipo === "MANEJO" || e.tipo === "RETIRADA") {
      if(e.produtoId||e.tipoExameId||e.dose)throw new RebanhoError("VALIDACAO","Manejo não consome produto: configure aplicação separada",`etapas.${indice}`);
    } else if (e.tipo === "EXAME") {
      if (!e.tipoExameId || e.produtoId || e.dose) throw new RebanhoError("VALIDACAO", "Etapa de exame precisa de Tipo de exame, sem Produto", `etapas.${indice}`);
      if (!(await tx.tipoExame.findFirst({ where: { id: e.tipoExameId, ativo: true, contexto: { not: "REPRODUTIVO" } } }))) throw new RebanhoError("VALIDACAO", "Tipo de exame não encontrado", `etapas.${indice}.tipoExameId`);
    }
  }
}

export async function listarProtocolos() {
  return prisma.protocolo.findMany({ where: { tipo: "SANITARIO" }, include: { etapas: { include: { momento: true }, orderBy: { ordem: "asc" } } }, orderBy: [{ nome: "asc" }, { versao: "desc" }] });
}

export async function criarProtocolo(input: { nome: string; descricao?: string | null; etapas: Etapa[] }, usuarioId: number | null, id?: string) {
  return prisma.$transaction(async (tx) => {
    await validarEtapas(tx, input.etapas);
    const existente = id ? await carregarVersaoTx(tx, id, "SANITARIO", true) : null;
    if (id && !existente) throw new RebanhoError("NAO_ENCONTRADO", "Protocolo não encontrado");
    if (existente?.publicadoEm) throw new RebanhoError("CONFLITO", "Protocolo publicado é imutável; crie nova versão");
    const versao = existente?.versao ?? await reservarVersaoTx(tx, "SANITARIO", input.nome.trim());
    const dados = { nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      etapas: { create: input.etapas.map((e, i) => ({ ordem: i + 1, diaRelativo: e.diaRelativo, tipo: e.tipo, configuracao: { subtipo: e.subtipo ?? "APLICACAO", ...(e.referenciasCusto ? {referenciasCusto:e.referenciasCusto} : {}) },
        produtoId: e.tipo === "APLICACAO" ? e.produtoId : null, tipoExameId: e.tipo === "EXAME" ? e.tipoExameId : null,
        finalidade: e.tipo === "APLICACAO" ? e.finalidade : null, dose: e.tipo === "APLICACAO" ? e.dose : null,
        tipoAplicacaoId: e.tipo === "APLICACAO" ? e.tipoAplicacaoId : null,
        unidade: e.tipo === "APLICACAO" ? e.unidade : null, via: e.via?.trim() || null })) },
    };
    if (existente) {
      await tx.etapaProtocolo.deleteMany({ where: { protocoloId: existente.id } });
      await tx.momentoProtocolo.deleteMany({ where: { protocoloId: existente.id } });
    }
    const novo = existente ? await tx.protocolo.update({ where: { tipo: "SANITARIO", id: existente.id }, data: { ...dados, etapas: { deleteMany: {}, ...dados.etapas } }, include: { etapas: { include: { momento: true }, orderBy: { ordem: "asc" } } } }) : await tx.protocolo.create({ data: { ...dados, versao }, include: { etapas: { include: { momento: true }, orderBy: { ordem: "asc" } } } });
    await associarMomentosAcoesTx(tx, novo.id, input.etapas);
    const atualizado = await tx.protocolo.findUniqueOrThrow({ where: { id: novo.id }, include: { etapas: { include: { momento: true }, orderBy: { ordem: "asc" } } } });
    await auditar(tx, { entidade: "ProtocoloSanitario", entidadeId: novo.id, acao: existente ? "RASCUNHO_EDITADO" : "VERSAO_CRIADA", usuarioId, ...(existente ? { antes: existente } : {}), depois: atualizado });
    return atualizado;
  });
}

export async function publicarProtocolo(id: string, usuarioId: number | null) {
  return prisma.$transaction(async tx => publicarVersaoTx(tx, id, "SANITARIO", usuarioId, async protocolo => {
    await validarEtapas(tx, protocolo.etapas.map(e => ({ ...e, referenciasCusto: (e.configuracao as {referenciasCusto?:ReferenciasCusto}|null)?.referenciasCusto, dose: e.dose?.toNumber() ?? null, tipo: e.tipo as Etapa["tipo"] })));
    for (const etapa of protocolo.etapas) if (etapa.tipoAplicacaoId) {
      const tipo = await tx.tipoAplicacaoSanitaria.findUniqueOrThrow({ where: { id: etapa.tipoAplicacaoId } });
      await tx.etapaProtocolo.update({ where: { id: etapa.id }, data: { tipoAplicacaoNomeSnapshot: tipo.nome } });
    }
  }));
}

export async function iniciarExecucaoTx(tx: Prisma.TransactionClient, input: { chave?: string; protocoloId: string; animalId: string; propriedadeId: number; inicio: string;
  ocorrenciaId?: string | null; operacaoServicoId?: string | null; confirmarSobreposicao?: boolean; justificativaSobreposicao?: string | null }, usuarioId: number | null) {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.inicio);
    // Início futuro continua permitido no planejamento, exigindo localização comprovada.
    if (data > new Date()) {
      const local = await tx.localizacaoAnimal.findFirst({ where: { animalId: input.animalId, propriedadeId: input.propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] }, include: { animal: { select: { baixas: { where: { estornadaEm: null } } } } } });
      if (!local || local.animal.baixas.length) throw new RebanhoError("VALIDACAO", "Animal indisponível neste sítio no início do protocolo", "inicio");
    } else await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, data, "inicio");
    const protocolo = await tx.protocolo.findFirst({ where: { tipo: "SANITARIO", id: input.protocoloId, ativo: true, publicadoEm: { not: null } },
      include: { etapas: { orderBy: { ordem: "asc" }, include: { momento: true, produto: { select: { nome: true } }, tipoExame: { select: { nome: true } } } } } });
    if (!protocolo) throw new RebanhoError("VALIDACAO", "Selecione uma versão publicada do protocolo", "protocoloId");
    const simultaneas = await tx.participacaoProtocolo.findMany({ where: { animalId: input.animalId, canceladaEm: null,
      protocolo: { nome: { equals: protocolo.nome, mode: "insensitive" } },
      tarefas: { some: { OR: [condicaoSituacaoTarefa("PENDENTE"), { regularizacaoPendente: true }] } },
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
    const execucao = await tx.participacaoProtocolo.create({ data: { protocoloId: protocolo.id,
      animalId: input.animalId, propriedadeId: input.propriedadeId, inicio: data, origemCalendario: "REFERENCIA_PROGRAMADA", criadoPorId: usuarioId,
      ocorrenciaId: input.ocorrenciaId ?? null, operacaoServicoId: input.operacaoServicoId ?? null,
      tarefas: { create: protocolo.etapas.map((e) => ({ etapaId: e.id, momentoSnapshot: snapshotMomento(e.momento), previstaPara: somarDias(data, e.diaRelativo),
        parametros: { tipo: e.tipo, configuracao: e.configuracao, produtoId: e.produtoId, tipoExameId: e.tipoExameId, finalidade: e.finalidade,
          produtoNomeSnapshot: e.produto?.nome ?? null, tipoExameNomeSnapshot: e.tipoExame?.nome ?? null,
          tipoAplicacaoId: e.tipoAplicacaoId, tipoAplicacaoNomeSnapshot: e.tipoAplicacaoNomeSnapshot,
          dose: e.dose?.toString() ?? null, unidade: e.unidade, via: e.via } })) },
    }, include: { tarefas: { orderBy: { previstaPara: "asc" } } } });
    await auditar(tx, { entidade: "ExecucaoProtocoloSanitario", entidadeId: execucao.id, animalId: input.animalId,
      propriedadeId: input.propriedadeId, acao: "INICIO", usuarioId, depois: { ...execucao,
        ...(simultaneas.length ? { sobreposicao: { execucaoIds: simultaneas.map((e) => e.id), justificativa: input.justificativaSobreposicao!.trim(), confirmada: true } } : {}) } });
    return execucao;
}

export async function iniciarExecucao(input: Parameters<typeof iniciarExecucaoTx>[1], usuarioId: number | null) {
  return confirmarFato(input, usuarioId, "PROTOCOLO", iniciarExecucaoTx, (tx, id) => tx.participacaoProtocolo.findUniqueOrThrow({ where: { id }, include: { tarefas: { orderBy: { previstaPara: "asc" } } } }));
}
export async function iniciarExecucaoColetivo(input: { chave: string; propriedadeId: number; itens: Parameters<typeof iniciarExecucaoTx>[1][] }, usuarioId: number | null) {
  return confirmarColetivo(input, usuarioId, "PROTOCOLO_COLETIVO", iniciarExecucaoTx);
}

const tarefaPendente: Prisma.TarefaProtocoloWhereInput = condicaoSituacaoTarefa("PENDENTE");
function whereTarefas(propriedadeId: number | null, animalId?: string, filtro?: ConsultaSanitaria) {
  const where: Prisma.TarefaProtocoloWhereInput = { execucao: { protocolo: { tipo: "SANITARIO" }, ...(animalId ? { animalId } : {}),
    ...(filtro?.rodadaId ? { rodadaId: filtro.rodadaId } : filtro?.semRodada === "true" ? { rodadaId: null } : {}),
    ...(propriedadeId != null || filtro?.loteId || filtro?.buscaAnimal ? { animal: { ...buscaAnimal(filtro), ...(propriedadeId != null || filtro?.loteId ? { localizacoes: { some: { ate: null,
      ...(propriedadeId == null ? {} : { propriedadeId }), ...(filtro?.loteId ? { loteId: filtro.loteId } : {}) } } } : {}) } } : {}) },
    ...(filtro?.de || filtro?.ate ? { previstaPara: intervalo(filtro) } : {}) };
  Object.assign(where, condicaoSituacaoTarefa(filtro?.situacao, dia(hojeFazenda())));
  return where;
}
export async function listarTarefasPaginadas(propriedadeId: number | null, animalId: string | undefined, filtro: ConsultaSanitaria) {
  const [itens, total] = await Promise.all([listarTarefas(propriedadeId, animalId, filtro), prisma.tarefaProtocolo.count({ where: whereTarefas(propriedadeId, animalId, filtro) })]);
  return { itens, total, pagina: filtro.pagina, porPagina: filtro.porPagina };
}
export async function listarTarefas(propriedadeId: number | null, animalId?: string, filtro?: ConsultaSanitaria) {
  const where = whereTarefas(propriedadeId, animalId, filtro);
  const include = { vinculos: vinculoRegularizacaoSelect,
    execucao: { select: { animalId: true, propriedadeId: true, rodadaId: true, rodada: { select: { id: true, nome: true } }, canceladaEm: true, protocolo: { select: { nome: true, versao: true } }, animal: { select: { id: true, brinco: true, nome: true, localizacoes: { where: { ate: null }, select: { propriedadeId: true } } } } } },
    aplicacoes: { select: { id: true, status: true, propriedadeId: true }, orderBy: { criadoEm: "desc" } }, exames: { select: { id: true, status: true, propriedadeId: true }, orderBy: { criadoEm: "desc" } },
  } satisfies Prisma.TarefaProtocoloInclude;
  const orderBy: Prisma.TarefaProtocoloOrderByWithRelationInput[] = [{ previstaPara: "asc" }, { id: "asc" }];
  const { skip, take } = limites(filtro);
  const tarefas = filtro?.ordenacaoTarefas === "prioridade"
    ? await prisma.$transaction(async (tx) => {
      // A ordem é global, antes de paginar: pendentes por previsão (atrasadas
      // primeiro), depois histórico. Não carregamos todas as tarefas em memória.
      const wherePendentes: Prisma.TarefaProtocoloWhereInput = { AND: [where, tarefaPendente] };
      const totalPendentes = await tx.tarefaProtocolo.count({ where: wherePendentes });
      const pendentes = skip < totalPendentes
        ? await tx.tarefaProtocolo.findMany({ where: wherePendentes, include, orderBy, skip, take }) : [];
      const historico = pendentes.length < take
        ? await tx.tarefaProtocolo.findMany({ where: { AND: [where, { NOT: tarefaPendente }] }, include, orderBy, skip: Math.max(0, skip - totalPendentes), take: take - pendentes.length }) : [];
      return [...pendentes, ...historico];
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
    : await prisma.tarefaProtocolo.findMany({ where, include, orderBy, skip, take });
  return tarefas.map((t) => {
    const aplicacao = t.aplicacoes.find((a) => a.status === "VALIDO") ?? null;
    const exame = t.exames.find((e) => e.status === "VALIDO") ?? null;
    const { animal, ...execucao } = t.execucao;
    return { ...t, execucao: { ...execucao, animal: { id: animal.id, brinco: animal.brinco, nome: animal.nome } }, propriedadeAtualId: animal.localizacoes[0]?.propriedadeId ?? null, aplicacao, exame,
      situacao: situacaoTarefaComum(t), propriedadeRegularizacaoId: propriedadeRegularizacao(t) };
  });
}

export async function dispensarTarefa(id: string, motivo: string, usuarioId: number | null, propriedadeId?: number) {
  return transacaoPecuaria(async (tx) => {
    const previa = await tx.tarefaProtocolo.findUnique({ where: { id, execucao: { protocolo: { tipo: "SANITARIO" } } }, select: { execucao: { select: { animalId: true } } } });
    if (!previa) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
    await travarAnimais(tx, [previa.execucao.animalId]);
    const original = await tx.tarefaProtocolo.findUnique({ where: { id }, include: { execucao: true, aplicacoes: { where: { status: "VALIDO" } }, exames: { where: { status: "VALIDO" } } } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada");
    if (propriedadeId != null && !(await tx.localizacaoAnimal.findFirst({ where: { animalId: original.execucao.animalId, propriedadeId, ate: null } }))) throw new RebanhoError("NAO_ENCONTRADO", "Tarefa não encontrada neste sítio");
    if (original.regularizacaoPendente || original.realizadaEm || original.dispensadaEm || original.execucao.canceladaEm || original.aplicacoes.length || original.exames.length) {
      throw new RebanhoError("CONFLITO", "A tarefa já foi realizada, dispensada ou cancelada");
    }
    const salva = await tx.tarefaProtocolo.update({ where: { id }, data: { dispensadaEm: new Date(), motivoDispensa: motivo } });
    await auditar(tx, { entidade: "TarefaSanitaria", entidadeId: id, animalId: original.execucao.animalId, acao: "DISPENSA", usuarioId,
      propriedadeId: propriedadeId ?? original.execucao.propriedadeId, antes: original, depois: salva });
    return salva;
  });
}

export async function cancelarExecucao(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const previa = await tx.participacaoProtocolo.findUnique({ where: { id, protocolo: { tipo: "SANITARIO" } }, select: { animalId: true } });
    if (!previa) throw new RebanhoError("NAO_ENCONTRADO", "Execução não encontrada");
    await travarAnimais(tx, [previa.animalId]);
    const original = await tx.participacaoProtocolo.findFirst({ where: { id, canceladaEm: null } });
    if (!original) throw new RebanhoError("CONFLITO", "Execução já cancelada");
    if (!(await tx.localizacaoAnimal.findFirst({ where: { animalId: original.animalId, propriedadeId, ate: null } }))) throw new RebanhoError("NAO_ENCONTRADO", "Execução não encontrada neste sítio");
    const salva = await tx.participacaoProtocolo.update({ where: { id }, data: { canceladaEm: new Date(), motivoCancelamento: motivo } });
    await auditar(tx, { entidade: "ExecucaoProtocoloSanitario", entidadeId: id, animalId: original.animalId, propriedadeId, acao: "CANCELAMENTO", usuarioId, antes: original, depois: salva });
    return salva;
  });
}

export async function inativarProtocolo(id: string, usuarioId: number | null) {
  return transacaoPecuaria(tx => inativarVersaoTx(tx, id, "SANITARIO", usuarioId));
}

export async function adiarTarefa(id: string, input: { previstaPara: string; motivo: string; chave?: string }, usuarioId: number | null, propriedadeId: number) {
  const data = dia(input.previstaPara);
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== input.previstaPara)
    throw new RebanhoError("VALIDACAO", "Informe uma data válida para a nova previsão", "previstaPara");
  if (input.motivo.trim().length < 5 || input.motivo.trim().length > 1000)
    throw new RebanhoError("VALIDACAO", "Informe o motivo do adiamento com 5 a 1000 caracteres", "motivo");
  return transacaoPecuaria(async tx => {
    await registrarEventoTarefaTx(tx, id, { chave: input.chave ?? crypto.randomUUID(), propriedadeId, tipo: "ADIAMENTO",
      ocorridaEm: new Date().toISOString(), motivo: input.motivo, previstaPara: input.previstaPara }, usuarioId, "SANITARIO");
    return tx.tarefaProtocolo.findUniqueOrThrow({ where: { id } });
  });
}
