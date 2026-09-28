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

export async function listarExames(animalId: string | undefined, propriedadeId: number | null) {
  return prisma.exameAnimal.findMany({ where: { ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { tipoExame: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], take: 100 });
}

export async function registrarExame(input: { animalId: string; propriedadeId: number; tipoExameId: string; data: string;
  resultadoTexto?: string | null; resultadoNumero?: number | null; resultadoOpcao?: string | null;
  responsavel?: string | null; ocorrenciaId?: string | null; tarefaId?: string | null; operacaoServicoId?: string | null }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    const data = dia(input.data);
    const local = await tx.localizacaoAnimal.findFirst({ where: { animalId: input.animalId, propriedadeId: input.propriedadeId,
      desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } });
    if (!local) throw new RebanhoError("VALIDACAO", "Animal não estava neste sítio na data do exame", "data");
    const tipo = await tx.tipoExame.findFirst({ where: { id: input.tipoExameId, ativo: true } });
    if (!tipo) throw new RebanhoError("VALIDACAO", "Tipo de exame não encontrado", "tipoExameId");
    const preenchidos = [input.resultadoTexto, input.resultadoNumero, input.resultadoOpcao].filter((v) => v !== undefined && v !== null && v !== "");
    if (preenchidos.length !== 1 || (tipo.tipoResultado === "TEXTO" && !input.resultadoTexto?.trim())
      || (tipo.tipoResultado === "NUMERO" && input.resultadoNumero == null)
      || (tipo.tipoResultado === "OPCAO" && !input.resultadoOpcao)) {
      throw new RebanhoError("VALIDACAO", "Informe um único resultado no formato deste exame", "resultado");
    }
    const opcoes = Array.isArray(tipo.opcoes) ? tipo.opcoes : [];
    if (tipo.tipoResultado === "OPCAO" && !opcoes.some((opcao) => opcao === input.resultadoOpcao)) throw new RebanhoError("VALIDACAO", "Resultado fora das opções do exame", "resultadoOpcao");
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
