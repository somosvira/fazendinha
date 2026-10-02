import { confirmarColetivo } from "./coletivos.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarFato } from "../idempotencia.js";
import { filtrosFatos, limites, type ConsultaSanitaria } from "./consulta.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";

type TipoResultado = "TEXTO" | "NUMERO" | "OPCAO";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);

export async function listarTiposExame(incluirInativos = false) {
  return prisma.tipoExame.findMany({ where: incluirInativos ? {} : { ativo: true }, orderBy: { nome: "asc" } });
}

export async function editarTipoExame(id: string, input: { nome?: string; ativo?: boolean; tipoResultado?: TipoResultado; unidade?: string | null; opcoes?: string[] | null }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const antes = await tx.tipoExame.findUnique({ where: { id } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Tipo de exame não encontrado");
    const tipoResultado = input.tipoResultado ?? antes.tipoResultado;
    const opcoes = input.opcoes !== undefined ? input.opcoes : tipoResultado === "OPCAO" ? antes.opcoes : null;
    if (tipoResultado === "OPCAO" && (!Array.isArray(opcoes) || !opcoes.length)) throw new RebanhoError("VALIDACAO", "Informe as opções possíveis", "opcoes");
    if (tipoResultado !== "OPCAO" && Array.isArray(opcoes) && opcoes.length) throw new RebanhoError("VALIDACAO", "Opções só cabem em resultado por escolha", "opcoes");
    await tx.$executeRaw`UPDATE "pecuaria"."ExameAnimal" SET "formatoSnapshot" = "formatoSnapshot" || jsonb_build_object('nome', ${antes.nome}::text) WHERE "tipoExameId" = ${id} AND NOT ("formatoSnapshot" ? 'nome')`;
    const depois = await tx.tipoExame.update({ where: { id }, data: {
      ...input, tipoResultado, ...(input.nome ? { nome: input.nome.trim() } : {}),
      ...(input.unidade !== undefined ? { unidade: input.unidade?.trim() || null } : {}),
      opcoes: opcoes == null ? Prisma.JsonNull : opcoes as Prisma.InputJsonValue,
    } });
    await auditar(tx, { entidade: "TipoExame", entidadeId: id, acao: "EDICAO", usuarioId, antes, depois });
    return depois;
  });
}

export async function criarTipoExame(input: { nome: string; tipoResultado: TipoResultado; unidade?: string | null; opcoes?: string[] | null }, usuarioId: number | null) {
  if (input.tipoResultado === "OPCAO" && !input.opcoes?.length) throw new RebanhoError("VALIDACAO", "Informe as opções possíveis", "opcoes");
  if (input.tipoResultado !== "OPCAO" && input.opcoes?.length) throw new RebanhoError("VALIDACAO", "Opções só cabem em resultado por escolha", "opcoes");
  return prisma.$transaction(async (tx) => {
    const criado = await tx.tipoExame.create({ data: { nome: input.nome.trim(), tipoResultado: input.tipoResultado,
      unidade: input.unidade?.trim() || null, opcoes: input.opcoes ?? Prisma.JsonNull } });
    await auditar(tx, { entidade: "TipoExame", entidadeId: criado.id, acao: "CADASTRO", usuarioId, depois: criado });
    return criado;
  });
}

export async function listarExames(animalId: string | undefined, propriedadeId: number | null, filtro?: ConsultaSanitaria) {
  const aguardando = filtro?.situacao === "AGUARDANDO_RESULTADO";
  const informado = filtro?.situacao === "RESULTADO_INFORMADO";
  const lista = await prisma.exameAnimal.findMany({ where: { ...filtrosFatos(filtro), ...(aguardando ? { resultadoTexto: null, resultadoNumero: null, resultadoOpcao: null } : informado ? { OR: [{ resultadoTexto: { not: null } }, { resultadoNumero: { not: null } }, { resultadoOpcao: { not: null } }] } : {}), ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { tipoExame: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], ...limites(filtro) });
  return lista.map((e) => ({ ...e, tipoExame: { nome: nomeExameHistorico(e.formatoSnapshot, e.tipoExame.nome) } }));
}

export function nomeExameHistorico(formato: Prisma.JsonValue, nomeAtual: string) {
  return formato && typeof formato === "object" && !Array.isArray(formato) && typeof formato.nome === "string" ? formato.nome : nomeAtual;
}

async function registrarExameTx(tx: Prisma.TransactionClient, input: { chave?: string; animalId: string; propriedadeId: number; tipoExameId: string; data: string;
  resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null;
  responsavel?: string | null; ocorrenciaId?: string | null; tarefaId?: string | null; operacaoServicoId?: string | null }, usuarioId: number | null) {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.data);
    await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, data);
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
    if (input.tarefaId) {
      const tarefa = await tx.tarefaSanitaria.findUnique({ where: { id: input.tarefaId }, include: { etapa: true, execucao: true, exames: { where: { status: "VALIDO" } }, aplicacoes: { where: { status: "VALIDO" } } } });
      if (!tarefa || tarefa.execucao.animalId !== input.animalId || tarefa.execucao.canceladaEm || tarefa.dispensadaEm || tarefa.exames.length || tarefa.aplicacoes.length
        || tarefa.etapa.tipo !== "EXAME" || tarefa.etapa.tipoExameId !== tipo.id) {
        throw new RebanhoError("VALIDACAO", "Tarefa de exame inválida ou já realizada", "tarefaId");
      }
      const servicoDoSitio = tarefa.execucao.propriedadeId === input.propriedadeId ? tarefa.execucao.operacaoServicoId : null;
      if (servicoDoSitio && operacaoServicoId && servicoDoSitio !== operacaoServicoId) {
        throw new RebanhoError("VALIDACAO", "Serviço diverge do protocolo", "operacaoServicoId");
      }
      operacaoServicoId ??= servicoDoSitio;
    }
    if (operacaoServicoId && !(await tx.operacao.findFirst({ where: { id: operacaoServicoId, propriedadeId: input.propriedadeId, tipo: "SERVICO", status: "CONFIRMADA" } }))) {
      throw new RebanhoError("VALIDACAO", "Serviço inválido para este sítio", "operacaoServicoId");
    }
    const criado = await tx.exameAnimal.create({ data: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      tipoExameId: tipo.id, data, resultadoTexto: input.resultadoTexto?.trim() || null,
      resultadoNumero: input.resultadoNumero ?? null, resultadoOpcao: input.resultadoOpcao ?? null,
      formatoSnapshot: { nome: tipo.nome, tipoResultado: tipo.tipoResultado, unidade: tipo.unidade, opcoes: tipo.opcoes },
      responsavel: input.responsavel?.trim() || null, ocorrenciaId: input.ocorrenciaId ?? null,
      tarefaId: input.tarefaId ?? null, operacaoServicoId } });
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: criado.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId, depois: criado });
    return criado;
}

export async function registrarExame(input: Parameters<typeof registrarExameTx>[1], usuarioId: number | null) {
  return confirmarFato(input, usuarioId, "EXAME", registrarExameTx, (tx, id) => tx.exameAnimal.findUniqueOrThrow({ where: { id } }));
}
export async function registrarExameColetivo(input: { chave: string; propriedadeId: number; itens: Parameters<typeof registrarExameTx>[1][] }, usuarioId: number | null) {
  return confirmarColetivo(input, usuarioId, "EXAME_COLETIVO", registrarExameTx);
}

export async function corrigirExame(id: string, propriedadeId: number, input: { motivo: string; resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null; anular?: boolean }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const original = await tx.exameAnimal.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Exame não encontrado ou anulado");
    await travarAnimais(tx, [original.animalId]);
    const formato = original.formatoSnapshot as { tipoResultado: string; opcoes?: string[] };
    if (!input.anular) {
      const preenchidos = [input.resultadoTexto, input.resultadoNumero, input.resultadoOpcao].filter((v) => v != null && v !== "");
      if (preenchidos.length !== 1 || (formato.tipoResultado === "TEXTO" && !input.resultadoTexto?.trim()) || (formato.tipoResultado === "NUMERO" && input.resultadoNumero == null) || (formato.tipoResultado === "OPCAO" && !formato.opcoes?.includes(input.resultadoOpcao ?? ""))) throw new RebanhoError("VALIDACAO", "Informe resultado no formato preservado na coleta", "resultado");
    }
    const salvo = await tx.exameAnimal.update({ where: { id }, data: input.anular ? { status: "ANULADO", motivoAnulacao: input.motivo, anuladoEm: new Date() } : { resultadoTexto: input.resultadoTexto?.trim() || null, resultadoNumero: input.resultadoNumero ?? null, resultadoOpcao: input.resultadoOpcao ?? null } });
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: id, animalId: original.animalId, propriedadeId, acao: input.anular ? "ANULACAO" : "RESULTADO_CORRIGIDO", usuarioId, antes: original, depois: { ...salvo, motivo: input.motivo } });
    return salvo;
  });
}
