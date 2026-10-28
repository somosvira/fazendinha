import { reconciliarExameProtocoladoTx } from "./alertas/protocolos.js";
import { marcarReavaliacaoDestinoTx } from "./alertas/avaliador.js";
import { vincularExameProgramacaoTx, revisarFatoProgramacaoTx } from "./programacoes/atendimento.js";
import type { OrigemAlertaAplicacao } from "./alertas/atendimento.js";
import { hashFormatoExame } from "../exames/formato-snapshot.js";
import { vincularFatoTarefaTx } from "../protocolos/vinculos.js";
import { camposExameSchema, validarObservacoesExame, conferirFormatoReprodutivo, formatoReprodutivoCompativel, type CampoExame, type ObservacaoExame } from "../exames/formatos.js";
import { marcarRegularizacaoFatoTx } from "../reproducao/marcacao-regularizacao.js";
import { confirmarColetivo } from "./coletivos.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarFato } from "../idempotencia.js";
import { filtrosFatos, limites, type ConsultaSanitaria } from "./consulta.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { conferirTarefaProtocoloTx, type DesvioInput } from "./desvios.js";

type TipoResultado = "TEXTO" | "NUMERO" | "OPCAO" | "MULTIPLO";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);


export async function listarTiposExame(incluirInativos = false, contexto?: "SANITARIO" | "REPRODUTIVO") {
  const tipos = await prisma.tipoExame.findMany({ where: { formatoQualidadeLeite: null, ...(incluirInativos ? {} : { ativo: true }), ...(contexto ? { contexto: { in: [contexto, "COMPARTILHADO"] } } : {}) }, orderBy: { nome: "asc" },
    include: { formatoQualidadeLeite: { select: { _count: { select: { amostras: true } } } }, _count: { select: { exames: true, etapas: { where: { protocolo: { OR: [{ publicado: true }, { execucoes: { some: {} } }] } } } } } } });
  return tipos.filter(tipo => contexto !== "REPRODUTIVO" || formatoReprodutivoCompativel(tipo.tipoResultado, tipo.campos)).map(({ _count, formatoQualidadeLeite, ...tipo }) => ({ ...tipo, formatoExameHash: hashFormatoExame(tipo), padraoReprodutivo: tipo.id === "b0400000-0000-4000-8000-000000000001", formatoBloqueado: _count.exames > 0 || _count.etapas > 0 || (formatoQualidadeLeite?._count.amostras ?? 0) > 0 }));
}

export async function travarTiposExame(tx: Prisma.TransactionClient, ids: string[]) {
  if (!ids.length) return;
  const chaves = [...new Set(ids)].map((id) => `pec-tipo-exame:${id}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${chaves}::text[]) AS k) AS chaves ORDER BY h`;
}

export async function editarTipoExame(id: string, input: { nome?: string; ativo?: boolean; tipoResultado?: TipoResultado; unidade?: string | null; opcoes?: string[] | null; campos?: CampoExame[] | null }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    await travarTiposExame(tx, [id]);
    const antes = await tx.tipoExame.findUnique({ where: { id }, include: { formatoQualidadeLeite: { select: { _count: { select: { amostras: true } } } } } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Tipo de exame não encontrado");
    const tipoResultado = input.tipoResultado ?? antes.tipoResultado;
    const opcoes = input.opcoes !== undefined ? input.opcoes : tipoResultado === "OPCAO" ? antes.opcoes : null;
    const unidade = input.unidade !== undefined ? input.unidade?.trim() || null : antes.unidade;
    const campos = tipoResultado === "MULTIPLO" ? camposExameSchema.parse(input.campos ?? antes.campos) : null;
    if (tipoResultado !== "MULTIPLO" && input.campos?.length) throw new RebanhoError("VALIDACAO", "Campos estruturados exigem formato de vários resultados", "campos");
    if (antes.contexto === "REPRODUTIVO") conferirFormatoReprodutivo(tipoResultado, campos);
    if (antes.formatoQualidadeLeite && tipoResultado !== "MULTIPLO") throw new RebanhoError("VALIDACAO", "Qualidade do leite exige formato de vários resultados", "tipoResultado");
    const camposAntes = antes.tipoResultado === "MULTIPLO" ? camposExameSchema.parse(antes.campos) : null;
    const formatoBloqueado = Boolean((antes.formatoQualidadeLeite?._count.amostras ?? 0) > 0 || await tx.exameAnimal.findFirst({ where: { tipoExameId: id }, select: { id: true } }) || await tx.etapaProtocolo.findFirst({ where: { tipoExameId: id, protocolo: { OR: [{ publicado: true }, { execucoes: { some: {} } }] } }, select: { id: true } }));
    if (formatoBloqueado && (tipoResultado !== antes.tipoResultado || unidade !== antes.unidade || JSON.stringify(opcoes) !== JSON.stringify(antes.opcoes) || JSON.stringify(campos) !== JSON.stringify(camposAntes))) {
      throw new RebanhoError("CONFLITO", "Tipo de exame com coleta não permite mudar formato, unidade ou opções. Crie uma nova versão do formato.", "tipoResultado");
    }
    if (tipoResultado === "OPCAO" && (!Array.isArray(opcoes) || !opcoes.length)) throw new RebanhoError("VALIDACAO", "Informe as opções possíveis", "opcoes");
    if (tipoResultado !== "OPCAO" && Array.isArray(opcoes) && opcoes.length) throw new RebanhoError("VALIDACAO", "Opções só cabem em resultado por escolha", "opcoes");
    await tx.$executeRaw`UPDATE "pecuaria"."ExameAnimal" SET "formatoSnapshot" = "formatoSnapshot" || jsonb_build_object('nome', ${antes.nome}::text) WHERE "tipoExameId" = ${id} AND NOT ("formatoSnapshot" ? 'nome')`;
    const depois = await tx.tipoExame.update({ where: { id }, data: {
      ...input, tipoResultado, ...(input.nome ? { nome: input.nome.trim() } : {}),
      ...(input.unidade !== undefined ? { unidade: input.unidade?.trim() || null } : {}),
      campos: campos == null ? Prisma.DbNull : campos,
      opcoes: opcoes == null ? Prisma.JsonNull : opcoes as Prisma.InputJsonValue,
    } });
    if (input.ativo === false && antes.ativo) await marcarReavaliacaoDestinoTx(tx, { tipoExameId: id }, usuarioId);
    await auditar(tx, { entidade: "TipoExame", entidadeId: id, acao: "EDICAO", usuarioId, antes, depois });
    return { ...depois, formatoBloqueado };
  });
}

export async function criarTipoExameTx(tx: Prisma.TransactionClient, input: { versaoAnteriorId?: string; nome: string; tipoResultado: TipoResultado; unidade?: string | null; opcoes?: string[] | null; campos?: CampoExame[] | null }, usuarioId: number | null, contexto: "SANITARIO" | "REPRODUTIVO" | "COMPARTILHADO" = "SANITARIO", qualidadeLeite = false) {
  const campos = input.tipoResultado === "MULTIPLO" ? camposExameSchema.parse(input.campos) : null;
  if (contexto === "REPRODUTIVO") conferirFormatoReprodutivo(input.tipoResultado, campos);
  if (input.tipoResultado !== "MULTIPLO" && input.campos?.length) throw new RebanhoError("VALIDACAO", "Campos estruturados exigem formato de vários resultados", "campos");
  if (input.tipoResultado === "OPCAO" && !input.opcoes?.length) throw new RebanhoError("VALIDACAO", "Informe as opções possíveis", "opcoes");
  if (input.tipoResultado !== "OPCAO" && input.opcoes?.length) throw new RebanhoError("VALIDACAO", "Opções só cabem em resultado por escolha", "opcoes");
    let versaoFormato = 1;
    if (input.versaoAnteriorId) {
      const anterior = await tx.tipoExame.findUnique({ where: { id: input.versaoAnteriorId }, include: { formatoQualidadeLeite: { select: { tipoExameId: true } } } });
      if (!anterior || anterior.contexto !== contexto) throw new RebanhoError("VALIDACAO", "Versão anterior incompatível com o cadastro", "versaoAnteriorId");
      if (anterior.formatoQualidadeLeite && !qualidadeLeite) throw new RebanhoError("CONFLITO", "Crie a nova versão pelo cadastro de qualidade do leite", "versaoAnteriorId");
      // Todas as derivações usam a mesma trava, inclusive duas criações simultâneas a partir de versões diferentes.
      let raiz: Pick<typeof anterior, "id" | "versaoAnteriorId"> = anterior;
      const visitados = new Set<string>([raiz.id]);
      while (raiz.versaoAnteriorId) {
        const pai = await tx.tipoExame.findUniqueOrThrow({ where: { id: raiz.versaoAnteriorId } });
        if (visitados.has(pai.id)) throw new RebanhoError("CONFLITO", "Ciclo no histórico de versões do formato");
        visitados.add(pai.id); raiz = pai;
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-versao-exame:${raiz.id}`}))`;
      const versoes = await tx.$queryRaw<{ versaoFormato: number }[]>`WITH RECURSIVE familia AS (SELECT id,"versaoFormato" FROM pecuaria."TipoExame" WHERE id=${raiz.id} UNION ALL SELECT t.id,t."versaoFormato" FROM pecuaria."TipoExame" t JOIN familia f ON t."versaoAnteriorId"=f.id) SELECT "versaoFormato" FROM familia`;
      versaoFormato = Math.max(...versoes.map(v => v.versaoFormato)) + 1;
    }
    const criado = await tx.tipoExame.create({ data: { versaoAnteriorId: input.versaoAnteriorId, versaoFormato, nome: input.nome.trim(), tipoResultado: input.tipoResultado,
      unidade: input.unidade?.trim() || null, contexto, campos: campos ?? Prisma.DbNull, opcoes: input.opcoes ?? Prisma.JsonNull } });
    await auditar(tx, { entidade: "TipoExame", entidadeId: criado.id, acao: "CADASTRO", usuarioId, depois: criado });
    return { ...criado, formatoBloqueado: false };
}

export async function criarTipoExame(input: Parameters<typeof criarTipoExameTx>[1], usuarioId: number | null, contexto: "SANITARIO" | "REPRODUTIVO" | "COMPARTILHADO" = "SANITARIO") {
  return transacaoPecuaria(tx => criarTipoExameTx(tx, input, usuarioId, contexto));
}

export async function listarExames(animalId: string | undefined, propriedadeId: number | null, filtro?: ConsultaSanitaria) {
  const aguardando = filtro?.situacao === "AGUARDANDO_RESULTADO";
  const informado = filtro?.situacao === "RESULTADO_INFORMADO";
  const lista = await prisma.exameAnimal.findMany({ where: { tipoExame: { contexto: { not: "REPRODUTIVO" } }, ...filtrosFatos(filtro), ...(aguardando ? { resultadoTexto: null, resultadoNumero: null, resultadoOpcao: null, resultados: { none: { vigente: true } } } : informado ? { OR: [{ resultadoTexto: { not: null } }, { resultadoNumero: { not: null } }, { resultadoOpcao: { not: null } }, { resultados: { some: { vigente: true } } }] } : {}), ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { resultados: { where: { vigente: true } }, tipoExame: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], ...limites(filtro) });
  return lista.map((e) => ({ ...e, tipoExame: { nome: nomeExameHistorico(e.formatoSnapshot, e.tipoExame.nome) } }));
}

export function nomeExameHistorico(formato: Prisma.JsonValue, nomeAtual: string) {
  return formato && typeof formato === "object" && !Array.isArray(formato) && typeof formato.nome === "string" ? formato.nome : nomeAtual;
}

export type ExameInput = OrigemAlertaAplicacao & { observacao?: string | null; formatoExameHash?: string; chave?: string; animalId: string; propriedadeId: number; tipoExameId: string; data: string;
  resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null; resultados?: ObservacaoExame[];
  responsavel?: string | null; ocorrenciaId?: string | null; tarefaId?: string | null; operacaoServicoId?: string | null; desvio?: DesvioInput };

export async function prepararExameTx(tx: Prisma.TransactionClient, input: ExameInput, usuarioId: number | null, previa = false, qualidadeLeite = false) {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.data);
    await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, data);
    await travarTiposExame(tx, [input.tipoExameId]);
    const tipo = await tx.tipoExame.findFirst({ where: { id: input.tipoExameId, ativo: true, contexto: { not: "REPRODUTIVO" } }, include: { formatoQualidadeLeite: { select: { tipoExameId: true } } } });
    if (!tipo) throw new RebanhoError("VALIDACAO", "Tipo de exame não encontrado", "tipoExameId");
    if (tipo.formatoQualidadeLeite && !qualidadeLeite) throw new RebanhoError("CONFLITO", "Registre este formato pelo fluxo de qualidade do leite", "tipoExameId");
    if (input.formatoExameHash && input.formatoExameHash !== hashFormatoExame(tipo)) throw new RebanhoError("CONFLITO", "O formato do exame mudou. Atualize e confira os resultados", "tipoExameId");
    const resultados = tipo.tipoResultado === "MULTIPLO" ? validarObservacoesExame(tipo.campos, input.resultados ?? [], (input.resultados?.length ?? 0) > 0) : [];
    if (tipo.tipoResultado !== "MULTIPLO" && input.resultados?.length) throw new RebanhoError("VALIDACAO", "Este exame usa o resultado simples do formato histórico", "resultados");
    const preenchidos = [input.resultadoTexto, input.resultadoNumero, input.resultadoOpcao].filter((v) => v !== undefined && v !== null && v !== "");
    if (preenchidos.length > 0 && (tipo.tipoResultado === "MULTIPLO" || preenchidos.length !== 1 || (tipo.tipoResultado === "TEXTO" && !input.resultadoTexto?.trim())
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
      tipoExameId: tipo.id, data, observacao: input.observacao?.trim() || null, resultadoTexto: input.resultadoTexto?.trim() || null,
      resultadoNumero: input.resultadoNumero ?? null, resultadoOpcao: input.resultadoOpcao ?? null,
      formatoSnapshot: { nome: tipo.nome, tipoResultado: tipo.tipoResultado, unidade: tipo.unidade, opcoes: tipo.opcoes },
      criadoPorId: usuarioId, realizacao: preenchidos.length || resultados.length ? "REALIZADO" : "COLETA_REGISTRADA",
      ...(tipo.tipoResultado === "MULTIPLO" ? { formatoSnapshot: { nome: tipo.nome, tipoResultado: tipo.tipoResultado, versao: tipo.versaoFormato, campos: tipo.campos }, resultados: { create: resultados.map(r => ({ ...r, criadoPorId: usuarioId })) } } : {}),
      responsavel: input.responsavel?.trim() || null, ocorrenciaId: input.ocorrenciaId ?? null,
      tarefaId: input.tarefaId ?? null, operacaoServicoId, ...(desvioProtocoloSnapshot ? { desvioProtocoloSnapshot } : {}) };
    return { dadosCriacao, desvioProtocoloSnapshot };
}

export async function registrarExameTx(tx: Prisma.TransactionClient, input: ExameInput, usuarioId: number | null, qualidadeLeite = false) {
    const { dadosCriacao } = await prepararExameTx(tx, input, usuarioId, false, qualidadeLeite);
    const criado = await tx.exameAnimal.create({ data: dadosCriacao });
    if (input.tarefaId) await vincularFatoTarefaTx(tx, input.tarefaId, { exameId: criado.id }, usuarioId);
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: criado.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId, depois: criado });
    await vincularExameProgramacaoTx(tx, input, criado, usuarioId);
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

export async function corrigirExameTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number, input: { motivo: string; resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null; resultados?: ObservacaoExame[]; anular?: boolean }, usuarioId: number | null, amostraQualidadeId?: string) {
    const referencia = await tx.exameAnimal.findFirst({ where: { id, propriedadeId }, select: { animalId: true } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado ou anulado");
    await travarAnimais(tx, [referencia.animalId]);
    const original = await tx.exameAnimal.findFirst({ where: { id, propriedadeId, status: "VALIDO" }, include: { amostraQualidadeLeite: { select: { id: true } }, interpretacao: { select: { id: true } }, resultados: { where: { vigente: true } } } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado ou anulado");
    if (original.amostraQualidadeLeite && original.amostraQualidadeLeite.id !== amostraQualidadeId) throw new RebanhoError("CONFLITO", "Corrija este laudo pelo fluxo de qualidade do leite", "exameId");
    if (amostraQualidadeId && original.amostraQualidadeLeite?.id !== amostraQualidadeId) throw new RebanhoError("CONFLITO", "Exame não pertence à amostra informada", "exameId");
    if (original.partoPosPartoId) throw new RebanhoError("CONFLITO", "Revise este escore pela correção do parto", "exameId");
    if (original.interpretacao) throw new RebanhoError("CONFLITO", "Este exame tem efeitos reprodutivos. Revise a avaliação e seus vínculos de gestação antes de corrigir ou anular", "exameId");
    const formato = original.formatoSnapshot as { tipoResultado: string; opcoes?: string[]; campos?: unknown };
    const multiplos = !input.anular && formato.tipoResultado === "MULTIPLO" ? validarObservacoesExame(formato.campos, input.resultados ?? []) : null;
    if (multiplos && !multiplos.length) throw new RebanhoError("VALIDACAO", "Informe os resultados do exame", "resultados");
    if (multiplos && [input.resultadoTexto, input.resultadoNumero, input.resultadoOpcao].some(v => v != null && v !== "")) throw new RebanhoError("VALIDACAO", "Este formato usa observações estruturadas", "resultados");
    if (!input.anular && !multiplos) {
      if (input.resultadoNumero != null && !Number.isFinite(input.resultadoNumero)) throw new RebanhoError("VALIDACAO", "Resultado numérico inválido", "resultadoNumero");
      const preenchidos = [input.resultadoTexto, input.resultadoNumero, input.resultadoOpcao].filter((v) => v != null && v !== "");
      if (preenchidos.length !== 1 || (formato.tipoResultado === "TEXTO" && !input.resultadoTexto?.trim()) || (formato.tipoResultado === "NUMERO" && input.resultadoNumero == null) || (formato.tipoResultado === "OPCAO" && !formato.opcoes?.includes(input.resultadoOpcao ?? ""))) throw new RebanhoError("VALIDACAO", "Informe resultado no formato preservado na coleta", "resultado");
    }
    if (multiplos) await tx.resultadoExame.updateMany({ where: { exameId: id, vigente: true }, data: { vigente: false, substituidoEm: new Date() } });
    const salvo = await tx.exameAnimal.update({ where: { id }, include: { resultados: { where: { vigente: true } } }, data: input.anular ? { status: "ANULADO", motivoAnulacao: input.motivo, anuladoEm: new Date() } : { realizacao: "REALIZADO", ...(multiplos ? { resultados: { create: multiplos.map(r => ({ ...r, criadoPorId: usuarioId })) } } : { resultadoTexto: input.resultadoTexto?.trim() || null, resultadoNumero: input.resultadoNumero ?? null, resultadoOpcao: input.resultadoOpcao ?? null }) } });
    await revisarFatoProgramacaoTx(tx, { exameId: id }, input.motivo, usuarioId);
    if (input.anular) await marcarRegularizacaoFatoTx(tx, { fatoTipo: "EXAME", fatoId: id, destinoConsumo: null, motivo: input.motivo, usuarioId });
    await reconciliarExameProtocoladoTx(tx,id,original.tarefaId,usuarioId);
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: id, animalId: original.animalId, propriedadeId, acao: input.anular ? "ANULACAO" : "RESULTADO_CORRIGIDO", usuarioId, antes: original, depois: { ...salvo, motivo: input.motivo } });
    return salvo;
}

export async function corrigirExame(id: string, propriedadeId: number, input: Parameters<typeof corrigirExameTx>[3], usuarioId: number | null) {
  return transacaoPecuaria(tx => corrigirExameTx(tx, id, propriedadeId, input, usuarioId));
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
