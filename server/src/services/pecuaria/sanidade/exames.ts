import { confirmarColetivo } from "./coletivos.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarFato } from "../idempotencia.js";
import { filtrosFatos, filtrarSituacoes, statusSituacao, limites, type ConsultaSanitaria } from "./consulta.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { conferirTarefaProtocoloTx, type DesvioInput } from "./desvios.js";

type TipoResultado = "TEXTO" | "NUMERO" | "OPCAO";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);

export async function listarTiposExame(incluirInativos = false) {
  const tipos = await prisma.tipoExame.findMany({ where: incluirInativos ? {} : { ativo: true }, orderBy: { nome: "asc" },
    include: { _count: { select: { exames: true } } } });
  return tipos.map(({ _count, ...tipo }) => ({ ...tipo, formatoBloqueado: _count.exames > 0 }));
}

export async function travarTiposExame(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return;
  const chaves = [...new Set(ids)].map((id) => `pec-tipo-exame:${id}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${chaves}::text[]) AS k) AS chaves ORDER BY h`;
}

export async function editarTipoExame(id: string, input: { nome?: string; ativo?: boolean; tipoResultado?: TipoResultado; unidade?: string | null; opcoes?: string[] | null }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    await travarTiposExame(tx, [id]);
    const antes = await tx.tipoExame.findUnique({ where: { id } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Tipo de exame não encontrado");
    const tipoResultado = input.tipoResultado ?? antes.tipoResultado;
    const opcoes = input.opcoes !== undefined ? input.opcoes : tipoResultado === "OPCAO" ? antes.opcoes : null;
    const unidade = input.unidade !== undefined ? input.unidade?.trim() || null : antes.unidade;
    const formatoBloqueado = Boolean(await tx.exameAnimal.findFirst({ where: { tipoExameId: id }, select: { id: true } }));
    if (formatoBloqueado && (tipoResultado !== antes.tipoResultado || unidade !== antes.unidade || JSON.stringify(opcoes) !== JSON.stringify(antes.opcoes))) {
      throw new RebanhoError("CONFLITO", "Tipo de exame com coleta não permite mudar formato, unidade ou opções. Crie outro tipo de exame.", "tipoResultado");
    }
    if (tipoResultado === "OPCAO" && (!Array.isArray(opcoes) || !opcoes.length)) throw new RebanhoError("VALIDACAO", "Informe as opções possíveis", "opcoes");
    if (tipoResultado !== "OPCAO" && Array.isArray(opcoes) && opcoes.length) throw new RebanhoError("VALIDACAO", "Opções só cabem em resultado por escolha", "opcoes");
    await tx.$executeRaw`UPDATE "pecuaria"."ExameAnimal" SET "formatoSnapshot" = "formatoSnapshot" || jsonb_build_object('nome', ${antes.nome}::text) WHERE "tipoExameId" = ${id} AND NOT ("formatoSnapshot" ? 'nome')`;
    const depois = await tx.tipoExame.update({ where: { id }, data: {
      ...input, tipoResultado, ...(input.nome ? { nome: input.nome.trim() } : {}),
      ...(input.unidade !== undefined ? { unidade: input.unidade?.trim() || null } : {}),
      opcoes: opcoes == null ? Prisma.JsonNull : opcoes as Prisma.InputJsonValue,
    } });
    await auditar(tx, { entidade: "TipoExame", entidadeId: id, acao: "EDICAO", usuarioId, antes, depois });
    return { ...depois, formatoBloqueado };
  });
}

export async function criarTipoExame(input: { nome: string; tipoResultado: TipoResultado; unidade?: string | null; opcoes?: string[] | null }, usuarioId: number | null) {
  if (input.tipoResultado === "OPCAO" && !input.opcoes?.length) throw new RebanhoError("VALIDACAO", "Informe as opções possíveis", "opcoes");
  if (input.tipoResultado !== "OPCAO" && input.opcoes?.length) throw new RebanhoError("VALIDACAO", "Opções só cabem em resultado por escolha", "opcoes");
  return prisma.$transaction(async (tx) => {
    const criado = await tx.tipoExame.create({ data: { nome: input.nome.trim(), tipoResultado: input.tipoResultado,
      unidade: input.unidade?.trim() || null, opcoes: input.opcoes ?? Prisma.JsonNull } });
    await auditar(tx, { entidade: "TipoExame", entidadeId: criado.id, acao: "CADASTRO", usuarioId, depois: criado });
    return { ...criado, formatoBloqueado: false };
  });
}

export async function listarExames(animalId: string | undefined, propriedadeId: number | null, filtro?: ConsultaSanitaria) {
  const lista = await prisma.exameAnimal.findMany({ where: { ...filtrosFatos(filtro), ...filtrarSituacoes(filtro, (s): Prisma.ExameAnimalWhereInput => ({ ...statusSituacao(s), ...(s === "AGUARDANDO_RESULTADO" ? { resultadoTexto: null, resultadoNumero: null, resultadoOpcao: null } : s === "RESULTADO_INFORMADO" ? { OR: [{ resultadoTexto: { not: null } }, { resultadoNumero: { not: null } }, { resultadoOpcao: { not: null } }] } : {}) })), ...(animalId && !filtro?.animalIds ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { tipoExame: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], ...limites(filtro) });
  return lista.map((e) => ({ ...e, tipoExame: { nome: nomeExameHistorico(e.formatoSnapshot, e.tipoExame.nome) } }));
}

export function nomeExameHistorico(formato: Prisma.JsonValue, nomeAtual: string) {
  return formato && typeof formato === "object" && !Array.isArray(formato) && typeof formato.nome === "string" ? formato.nome : nomeAtual;
}

export type ExameInput = { chave?: string; animalId: string; propriedadeId: number; tipoExameId: string; data: string;
  resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null;
  responsavel?: string | null; ocorrenciaId?: string | null; tarefaId?: string | null; operacaoServicoId?: string | null; desvio?: DesvioInput };

export async function prepararExameTx(tx: Prisma.TransactionClient, input: ExameInput, usuarioId: number | null, previa = false) {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.data);
    await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, data);
    await travarTiposExame(tx, [input.tipoExameId]);
    const tipo = await tx.tipoExame.findFirst({ where: { id: input.tipoExameId, ativo: true } });
    if (!tipo) throw new RebanhoError("VALIDACAO", "Tipo de exame não encontrado", "tipoExameId");
    const preenchidos = [input.resultadoTexto, input.resultadoNumero, input.resultadoOpcao].filter((v) => v !== undefined && v !== null && v !== "");
    if (preenchidos.length > 0 && (preenchidos.length !== 1 || (tipo.tipoResultado === "TEXTO" && !input.resultadoTexto?.trim())
      || (tipo.tipoResultado === "NUMERO" && input.resultadoNumero == null)
      || (tipo.tipoResultado === "OPCAO" && !input.resultadoOpcao))) {
      throw new RebanhoError("VALIDACAO", "Informe um único resultado no formato deste exame", "resultado");
    }
    const opcoes = Array.isArray(tipo.opcoes) ? tipo.opcoes : [];
    if (input.resultadoOpcao && !opcoes.some((opcao) => opcao === input.resultadoOpcao)) throw new RebanhoError("VALIDACAO", "Resultado fora das opções do exame", "resultadoOpcao");
    if (input.resultadoNumero != null && !Number.isFinite(input.resultadoNumero)) throw new RebanhoError("VALIDACAO", "Resultado numérico inválido", "resultadoNumero");
    if (input.ocorrenciaId && !(await tx.ocorrenciaSanitaria.findFirst({ where: { id: input.ocorrenciaId, animalId: input.animalId, status: "VALIDO" } }))) {
      throw new RebanhoError("VALIDACAO", "Ocorrência não pertence ao animal", "ocorrenciaId");
    }
    let operacaoServicoId = input.operacaoServicoId ?? null;
    let desvioProtocoloSnapshot: Awaited<ReturnType<typeof conferirTarefaProtocoloTx>>["desvioProtocoloSnapshot"] | null = null;
    if (input.tarefaId) {
      const conferida = await conferirTarefaProtocoloTx(tx, input.tarefaId, input.animalId, { tipo: "EXAME", data: input.data, tipoExameId: input.tipoExameId }, input.desvio, !previa);
      const tarefa = conferida.tarefa;
      desvioProtocoloSnapshot = conferida.desvioProtocoloSnapshot;
      desvioProtocoloSnapshot.exibicao.realizado.tipoExameId = tipo.nome;
      const servicoDoSitio = tarefa.execucao.propriedadeId === input.propriedadeId ? tarefa.execucao.operacaoServicoId : null;
      if (servicoDoSitio && operacaoServicoId && servicoDoSitio !== operacaoServicoId) {
        throw new RebanhoError("VALIDACAO", "Serviço diverge do protocolo", "operacaoServicoId");
      }
      operacaoServicoId ??= servicoDoSitio;
    }
    if (operacaoServicoId && !(await tx.operacao.findFirst({ where: { id: operacaoServicoId, propriedadeId: input.propriedadeId, tipo: "SERVICO", status: "CONFIRMADA" } }))) {
      throw new RebanhoError("VALIDACAO", "Serviço inválido para este sítio", "operacaoServicoId");
    }
    const dadosCriacao: Prisma.ExameAnimalUncheckedCreateInput = { animalId: input.animalId, propriedadeId: input.propriedadeId,
      tipoExameId: tipo.id, data, resultadoTexto: input.resultadoTexto?.trim() || null,
      resultadoNumero: input.resultadoNumero ?? null, resultadoOpcao: input.resultadoOpcao ?? null,
      formatoSnapshot: { nome: tipo.nome, tipoResultado: tipo.tipoResultado, unidade: tipo.unidade, opcoes: tipo.opcoes },
      responsavel: input.responsavel?.trim() || null, ocorrenciaId: input.ocorrenciaId ?? null,
      tarefaId: input.tarefaId ?? null, operacaoServicoId, ...(desvioProtocoloSnapshot ? { desvioProtocoloSnapshot } : {}) };
    return { dadosCriacao, desvioProtocoloSnapshot };
}

export async function registrarExameTx(tx: Prisma.TransactionClient, input: ExameInput, usuarioId: number | null) {
    const { dadosCriacao } = await prepararExameTx(tx, input, usuarioId);
    const criado = await tx.exameAnimal.create({ data: dadosCriacao });
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: criado.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId, depois: criado });
    return criado;
}

export async function registrarExame(input: Parameters<typeof registrarExameTx>[1], usuarioId: number | null) {
  return confirmarFato(input, usuarioId, "EXAME", registrarExameTx, (tx, id) => tx.exameAnimal.findUniqueOrThrow({ where: { id } }));
}
export async function registrarExameColetivo(input: { chave: string; propriedadeId: number; itens: Parameters<typeof registrarExameTx>[1][] }, usuarioId: number | null) {
  return confirmarColetivo(input, usuarioId, "EXAME_COLETIVO", async (tx, item, autor) => {
    // Todos os tipos do conjunto entram na mesma ordem, depois das travas dos animais.
    await travarTiposExame(tx, input.itens.map((exame) => exame.tipoExameId));
    return registrarExameTx(tx, item, autor);
  });
}

export async function corrigirExame(id: string, propriedadeId: number, input: { motivo: string; resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null; anular?: boolean }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await tx.exameAnimal.findFirst({ where: { id, propriedadeId }, select: { animalId: true } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado ou anulado");
    await travarAnimais(tx, [referencia.animalId]);
    const original = await tx.exameAnimal.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado ou anulado");
    const formato = original.formatoSnapshot as { tipoResultado: string; opcoes?: string[] };
    if (!input.anular) {
      if (input.resultadoNumero != null && !Number.isFinite(input.resultadoNumero)) throw new RebanhoError("VALIDACAO", "Resultado numérico inválido", "resultadoNumero");
      const preenchidos = [input.resultadoTexto, input.resultadoNumero, input.resultadoOpcao].filter((v) => v != null && v !== "");
      if (preenchidos.length !== 1 || (formato.tipoResultado === "TEXTO" && !input.resultadoTexto?.trim()) || (formato.tipoResultado === "NUMERO" && input.resultadoNumero == null) || (formato.tipoResultado === "OPCAO" && !formato.opcoes?.includes(input.resultadoOpcao ?? ""))) throw new RebanhoError("VALIDACAO", "Informe resultado no formato preservado na coleta", "resultado");
    }
    const salvo = await tx.exameAnimal.update({ where: { id }, data: input.anular ? { status: "ANULADO", motivoAnulacao: input.motivo, anuladoEm: new Date() } : { resultadoTexto: input.resultadoTexto?.trim() || null, resultadoNumero: input.resultadoNumero ?? null, resultadoOpcao: input.resultadoOpcao ?? null } });
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: id, animalId: original.animalId, propriedadeId, acao: input.anular ? "ANULACAO" : "RESULTADO_CORRIGIDO", usuarioId, antes: original, depois: { ...salvo, motivo: input.motivo } });
    return salvo;
  });
}

function motivoAuditoria(depois: Prisma.JsonValue): string | null {
  if (!depois || typeof depois !== "object" || Array.isArray(depois)) return null;
  const motivo = depois.motivo ?? depois.motivoAnulacao;
  return typeof motivo === "string" ? motivo : null;
}

export async function obterHistoricoExame(id: string, propriedadeIds?: number[], pagina = 1, tamanho = 20) {
  if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamanho) || tamanho < 1 || tamanho > 100) {
    throw new RebanhoError("VALIDACAO", "Informe página e tamanho válidos para o histórico");
  }
  const exame = await prisma.exameAnimal.findFirst({ where: { id, ...(propriedadeIds === undefined ? {} : { propriedadeId: { in: propriedadeIds } }) }, select: { id: true } });
  if (!exame) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado neste sítio");
  const where: Prisma.AuditoriaPecuariaWhereInput = { entidade: "ExameAnimal", entidadeId: id,
    ...(propriedadeIds === undefined ? {} : { OR: [{ propriedadeId: { in: propriedadeIds } }, { propriedadeId: null }] }) };
  const [auditorias, total] = await prisma.$transaction(async (tx) => {
    const itens = await tx.auditoriaPecuaria.findMany({ where, orderBy: [{ em: "desc" }, { id: "desc" }], skip: (pagina - 1) * tamanho, take: tamanho,
      include: { usuario: { select: { id: true, nome: true } } } });
    return [itens, await tx.auditoriaPecuaria.count({ where })] as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const itens = auditorias.map((a) => ({ id: a.id, acao: a.acao, em: a.em.toISOString(), criadoEm: a.criadoEm.toISOString(),
    usuarioId: a.usuarioId, autor: a.usuario, motivo: motivoAuditoria(a.depois), antes: a.antes, depois: a.depois }));
  return { exameId: exame.id, itens, total, pagina, tamanho };
}
