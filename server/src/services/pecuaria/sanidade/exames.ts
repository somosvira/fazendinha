import { confirmarColetivo } from "./coletivos.js";
import { filtrosFatos, limites, type ConsultaSanitaria } from "./consulta.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";

type TipoResultado = "TEXTO" | "NUMERO" | "OPCAO";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);

export async function listarTiposExame() {
  return prisma.tipoExame.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
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
  return prisma.exameAnimal.findMany({ where: { ...filtrosFatos(filtro), ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { tipoExame: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], ...limites(filtro) });
}

async function registrarExameTx(tx: Prisma.TransactionClient, input: { animalId: string; propriedadeId: number; tipoExameId: string; data: string;
  resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null;
  responsavel?: string | null; ocorrenciaId?: string | null; tarefaId?: string | null; operacaoServicoId?: string | null }, usuarioId: number | null) {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.data);
    const local = await tx.localizacaoAnimal.findFirst({ where: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } });
    if (!local) throw new RebanhoError("VALIDACAO", "Animal não estava neste sítio na data do exame", "data");
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
      const tarefa = await tx.tarefaSanitaria.findUnique({ where: { id: input.tarefaId }, include: { etapa: true, execucao: true, exame: true, aplicacao: true } });
      if (!tarefa || tarefa.execucao.animalId !== input.animalId || tarefa.execucao.canceladaEm || tarefa.dispensadaEm || tarefa.exame || tarefa.aplicacao
        || tarefa.etapa.tipo !== "EXAME" || tarefa.etapa.tipoExameId !== tipo.id) {
        throw new RebanhoError("VALIDACAO", "Tarefa de exame inválida ou já realizada", "tarefaId");
      }
      if (tarefa.execucao.operacaoServicoId && operacaoServicoId && tarefa.execucao.operacaoServicoId !== operacaoServicoId) {
        throw new RebanhoError("VALIDACAO", "Serviço diverge do protocolo", "operacaoServicoId");
      }
      operacaoServicoId ??= tarefa.execucao.operacaoServicoId;
    }
    if (operacaoServicoId && !(await tx.operacao.findFirst({ where: { id: operacaoServicoId, propriedadeId: input.propriedadeId, tipo: "SERVICO", status: "CONFIRMADA" } }))) {
      throw new RebanhoError("VALIDACAO", "Serviço inválido para este sítio", "operacaoServicoId");
    }
    const criado = await tx.exameAnimal.create({ data: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      tipoExameId: tipo.id, data, resultadoTexto: input.resultadoTexto?.trim() || null,
      resultadoNumero: input.resultadoNumero ?? null, resultadoOpcao: input.resultadoOpcao ?? null,
      formatoSnapshot: { tipoResultado: tipo.tipoResultado, unidade: tipo.unidade, opcoes: tipo.opcoes },
      responsavel: input.responsavel?.trim() || null, ocorrenciaId: input.ocorrenciaId ?? null,
      tarefaId: input.tarefaId ?? null, operacaoServicoId } });
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: criado.id, animalId: input.animalId, acao: "REGISTRO", usuarioId, depois: criado });
    return criado;
}

export async function registrarExame(input: Parameters<typeof registrarExameTx>[1], usuarioId: number | null) {
  return prisma.$transaction((tx) => registrarExameTx(tx, input, usuarioId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export async function registrarExameColetivo(input: { chave: string; propriedadeId: number; itens: Parameters<typeof registrarExameTx>[1][] }, usuarioId: number | null) {
  return confirmarColetivo(input, usuarioId, "EXAME_COLETIVO", registrarExameTx);
}

export async function corrigirExame(id: string, propriedadeId: number, input: { motivo: string; resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null; anular?: boolean }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
