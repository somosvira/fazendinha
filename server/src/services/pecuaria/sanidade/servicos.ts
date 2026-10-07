import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { nomeExameHistorico } from "./exames.js";
import { confirmarProcedimentosServicoSchema, consultaProcedimentosServicoSchema, type ConsultaProcedimentosServico, type ConfirmarProcedimentosServico } from "./servicos.schemas.js";

const identidade = { animal: { select: { id: true, brinco: true, nome: true } }, propriedade: { select: { id: true, nome: true } } } as const;
const realizado = { tarefas: { some: { OR: [{ aplicacoes: { some: { status: "VALIDO" as const } } }, { exames: { some: { status: "VALIDO" as const } } }] } } };
type Db = Prisma.TransactionClient;
export type ProcedimentoServico = {
  id: string; tipo: "APLICACAO" | "EXAME" | "PROTOCOLO"; animalId: string;
  animal: { id: string; brinco: string; nome: string | null }; propriedade: { id: number; nome: string } | null;
  nome: string; dataHora: string; status: string; origem: string; valor: string | null;
  vinculado: boolean; podeEditar: boolean; execucaoId: string | null; operacaoServicoId: string | null;
};
async function servico(tx: Db, id: string, propriedadeId: number, confirmado = false) {
  const op = await tx.operacao.findFirst({ where: { id, propriedadeId, tipo: "SERVICO", ...(confirmado ? { status: "CONFIRMADA" } : {}) }, include: { propriedade: { select: { id: true, nome: true } } } });
  if (!op) throw new RebanhoError("NAO_ENCONTRADO", "Serviço não encontrado neste sítio");
  return op;
}
async function fatos(tx: Db, id: string, propriedadeId: number, filtro?: ConsultaProcedimentosServico, ids?: string[]) {
  const elegiveis = filtro?.grupo === "ELEGIVEIS";
  const base = { propriedadeId, ...(ids ? { id: { in: ids } } : {}),
    ...(!ids ? { operacaoServicoId: elegiveis ? null : id } : {}),
    ...(filtro?.animalBusca ? { animal: { OR: [{ brinco: { contains: filtro.animalBusca, mode: "insensitive" as const } }, { nome: { contains: filtro.animalBusca, mode: "insensitive" as const } }] } } : {}),
  };
  const data = { ...(filtro?.inicio ? { gte: new Date(`${filtro.inicio}T00:00:00Z`) } : {}), ...(filtro?.fim ? { lte: new Date(`${filtro.fim}T00:00:00Z`) } : {}) };
  const take = filtro ? filtro.pagina * filtro.limite : undefined;
  const aWhere = { ...base, ...(elegiveis ? { status: "VALIDO" as const } : {}), ...(Object.keys(data).length ? { data } : {}) };
  const pWhere = { ...base, ...(elegiveis ? { canceladaEm: null, ...realizado } : {}), ...(Object.keys(data).length ? { inicio: data } : {}) };
  const [aplicacoes, exames, protocolos, na, ne, np] = await Promise.all([
    filtro?.tipo && filtro.tipo !== "APLICACAO" ? [] : tx.aplicacaoProduto.findMany({ where: aWhere, include: { ...identidade, tarefa: { select: { execucaoId: true } } }, orderBy: [{ data: "desc" }, { id: "asc" }], take }),
    filtro?.tipo && filtro.tipo !== "EXAME" ? [] : tx.exameAnimal.findMany({ where: aWhere, include: { ...identidade, tarefa: { select: { execucaoId: true } }, tipoExame: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { id: "asc" }], take }),
    filtro?.tipo && filtro.tipo !== "PROTOCOLO" ? [] : tx.execucaoProtocoloSanitario.findMany({ where: pWhere, include: { ...identidade, protocolo: { select: { nome: true } }, tarefas: { where: realizado.tarefas.some, select: { id: true } } }, orderBy: [{ inicio: "desc" }, { id: "asc" }], take }),
    !filtro || filtro.tipo && filtro.tipo !== "APLICACAO" ? 0 : tx.aplicacaoProduto.count({ where: aWhere }),
    !filtro || filtro.tipo && filtro.tipo !== "EXAME" ? 0 : tx.exameAnimal.count({ where: aWhere }),
    !filtro || filtro.tipo && filtro.tipo !== "PROTOCOLO" ? 0 : tx.execucaoProtocoloSanitario.count({ where: pWhere }),
  ]);
  const comum = (f: typeof aplicacoes[number] | typeof exames[number] | typeof protocolos[number]) => ({ id: f.id, animalId: f.animalId, animal: f.animal, propriedade: f.propriedade, valor: f.valorServicoAtribuido?.toString() ?? null, vinculado: f.operacaoServicoId === id, operacaoServicoId: f.operacaoServicoId });
  const itens: ProcedimentoServico[] = [
    ...aplicacoes.map((a) => ({ ...comum(a), tipo: "APLICACAO" as const, nome: a.nomeProdutoAplicado, dataHora: (a.aplicadaEm ?? a.data).toISOString(), status: a.status, origem: a.origemInsumo, podeEditar: a.status === "VALIDO", execucaoId: a.tarefa?.execucaoId ?? null })),
    ...exames.map((e) => ({ ...comum(e), tipo: "EXAME" as const, nome: nomeExameHistorico(e.formatoSnapshot, e.tipoExame.nome), dataHora: e.data.toISOString(), status: e.status, origem: e.origem, podeEditar: e.status === "VALIDO", execucaoId: e.tarefa?.execucaoId ?? null })),
    ...protocolos.map((p) => ({ ...comum(p), tipo: "PROTOCOLO" as const, nome: p.protocolo.nome, dataHora: p.inicio.toISOString(), status: p.canceladaEm ? "CANCELADO" : p.tarefas.length ? "REALIZADO" : "PENDENTE", origem: "PROTOCOLO", podeEditar: !p.canceladaEm && p.tarefas.length > 0, execucaoId: p.id })),
  ];
  itens.sort((a, b) => b.dataHora.slice(0, 10).localeCompare(a.dataHora.slice(0, 10)) || a.id.localeCompare(b.id));
  return { itens, total: filtro ? na + ne + np : itens.length };
}
async function totalAtribuido(tx: Db, id: string, propriedadeId: number) {
  const [a, e, p] = await Promise.all([
    tx.aplicacaoProduto.aggregate({ where: { operacaoServicoId: id, propriedadeId, status: "VALIDO" }, _sum: { valorServicoAtribuido: true } }),
    tx.exameAnimal.aggregate({ where: { operacaoServicoId: id, propriedadeId, status: "VALIDO" }, _sum: { valorServicoAtribuido: true } }),
    tx.execucaoProtocoloSanitario.aggregate({ where: { operacaoServicoId: id, propriedadeId, canceladaEm: null }, _sum: { valorServicoAtribuido: true } }),
  ]);
  return new Prisma.Decimal(a._sum.valorServicoAtribuido ?? 0).plus(e._sum.valorServicoAtribuido ?? 0).plus(p._sum.valorServicoAtribuido ?? 0);
}
export async function listarProcedimentosServico(servicoId: string, propriedadeId: number, query: Partial<ConsultaProcedimentosServico> = {}, verValores = true) {
  const filtro = consultaProcedimentosServicoSchema.parse(query);
  return prisma.$transaction(async (tx) => {
    const op = await servico(tx, servicoId, propriedadeId);
    const [consulta, total] = await Promise.all([fatos(tx, servicoId, propriedadeId, filtro), totalAtribuido(tx, servicoId, propriedadeId)]);
    const itens = consulta.itens.slice((filtro.pagina - 1) * filtro.limite, filtro.pagina * filtro.limite).map((i) => ({ ...i, podeEditar: i.podeEditar && op.status === "CONFIRMADA", valor: verValores ? i.valor : null }));
    return { servico: { id: op.id, numero: op.numero, descricao: op.descricao, status: op.status, propriedadeId, propriedade: op.propriedade, data: op.data.toISOString(), valorConfirmado: verValores ? op.valorTotal.toString() : null, totalAtribuido: verValores ? total.toString() : null, disponivel: verValores ? op.valorTotal.minus(total).toString() : null }, itens, total: consulta.total, pagina: filtro.pagina, limite: filtro.limite, paginas: Math.max(1, Math.ceil(consulta.total / filtro.limite)) };
  });
}
export async function procedimentosOperacaoServico(id: string, propriedadeId: number) {
  return (await fatos(prisma, id, propriedadeId)).itens;
}
export function validarAtribuicoesServico(itens: ProcedimentoServico[], valorConfirmado: Prisma.Decimal) {
  const ativos = itens.filter((i) => i.status !== "ANULADO" && i.status !== "CANCELADO");
  const total = ativos.reduce((s, i) => s.plus(i.valor ?? 0), new Prisma.Decimal(0));
  if (total.gt(valorConfirmado)) throw new RebanhoError("CONFLITO", "Os valores ultrapassam o Serviço confirmado", "itens");
  if (ativos.some((i) => i.tipo === "PROTOCOLO" && i.valor != null && ativos.some((f) => f.tipo !== "PROTOCOLO" && f.execucaoId === i.id && f.valor != null))) throw new RebanhoError("CONFLITO", "Retire o valor do protocolo ou dos procedimentos dele", "itens");
  return total;
}
export async function confirmarProcedimentosServico(input: ConfirmarProcedimentosServico, usuarioId: number | null, podeEditarValores = true) {
  input = { ...confirmarProcedimentosServicoSchema.parse(input), servicoId: input.servicoId };
  if (!podeEditarValores && input.itens.some((i) => i.valor !== undefined)) throw new RebanhoError("VALIDACAO", "Você não tem permissão para editar valores");
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify({ ...input, itens: [...input.itens].sort((a, b) => `${a.tipo}:${a.id}`.localeCompare(`${b.tipo}:${b.id}`)) })).digest("hex");
  return transacaoPecuaria(async (tx) => {
    const previa = await fatos(tx, input.servicoId, input.propriedadeId, undefined, input.itens.map((i) => i.id));
    await travarAnimais(tx, previa.itens.map((i) => i.animalId));
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chaveIdempotencia}`}))`;
    await tx.$queryRaw`SELECT id FROM "Operacao" WHERE id = ${input.servicoId} FOR UPDATE`;
    const op = await servico(tx, input.servicoId, input.propriedadeId);
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chaveIdempotencia } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.usuarioId !== usuarioId || anterior.propriedadeId !== input.propriedadeId || anterior.operacao !== "PROCEDIMENTOS_SERVICO") throw new RebanhoError("CONFLITO", "Chave de reenvio usada com outros dados");
      return { servicoId: op.id, quantidade: input.itens.length, salvo: true, reenvio: true, itens: previa.itens.map((i) => ({ id: i.id, tipo: i.tipo, valor: podeEditarValores ? i.valor : null })) };
    }
    if (op.status !== "CONFIRMADA") throw new RebanhoError("CONFLITO", "Este Serviço foi cancelado; recarregue a consulta");
    const [selecionados, vinculados] = await Promise.all([fatos(tx, op.id, input.propriedadeId, undefined, input.itens.map((i) => i.id)), fatos(tx, op.id, input.propriedadeId)]);
    const alterados = input.itens.map((mudanca, indice) => {
      const atual = selecionados.itens.find((i) => i.id === mudanca.id && i.tipo === mudanca.tipo);
      if (!atual || !atual.podeEditar || atual.operacaoServicoId && atual.operacaoServicoId !== op.id) throw new RebanhoError("CONFLITO", "Procedimento indisponível neste sítio ou vinculado a outro Serviço", `itens.${indice}.id`);
      return { ...atual, valor: mudanca.valor === undefined ? atual.valor : mudanca.valor, operacaoServicoId: op.id, vinculado: true };
    });
    const execucaoIds = [...new Set(alterados.flatMap((i) => i.execucaoId ? [i.execucaoId] : []))];
    const conflitos = execucaoIds.length ? await tx.execucaoProtocoloSanitario.findMany({ where: { id: { in: execucaoIds }, propriedadeId: input.propriedadeId, operacaoServicoId: { not: op.id }, NOT: { operacaoServicoId: null } }, select: { id: true } }) : [];
    if (conflitos.length) throw new RebanhoError("CONFLITO", "A execução está vinculada a outro Serviço");
    const protocolosAlterados = alterados.filter((i) => i.tipo === "PROTOCOLO").map((i) => i.id);
    if (protocolosAlterados.length) {
      const outroServico = { propriedadeId: input.propriedadeId, operacaoServicoId: { not: op.id }, NOT: { operacaoServicoId: null }, status: "VALIDO" as const, tarefa: { execucaoId: { in: protocolosAlterados } } };
      const [a, e] = await Promise.all([tx.aplicacaoProduto.count({ where: outroServico }), tx.exameAnimal.count({ where: outroServico })]);
      if (a || e) throw new RebanhoError("CONFLITO", "Há procedimentos desta execução vinculados a outro Serviço");
    }
    validarAtribuicoesServico([...vinculados.itens.filter((i) => !alterados.some((a) => a.id === i.id && a.tipo === i.tipo)), ...alterados], op.valorTotal);
    for (const item of alterados) {
      const data = { operacaoServicoId: op.id, valorServicoAtribuido: item.valor == null ? null : new Prisma.Decimal(item.valor) };
      if (item.tipo === "APLICACAO") await tx.aplicacaoProduto.update({ where: { id: item.id }, data });
      else if (item.tipo === "EXAME") await tx.exameAnimal.update({ where: { id: item.id }, data });
      else await tx.execucaoProtocoloSanitario.update({ where: { id: item.id }, data });
      await auditar(tx, { entidade: item.tipo === "APLICACAO" ? "AplicacaoProduto" : item.tipo === "EXAME" ? "ExameAnimal" : "ExecucaoProtocoloSanitario", entidadeId: item.id, animalId: item.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: "PROCEDIMENTO_SERVICO", antes: selecionados.itens.find((i) => i.id === item.id), depois: { servicoId: op.id, valor: item.valor, motivo: input.motivo } });
    }
    await tx.requisicaoPecuaria.create({ data: { chave: input.chaveIdempotencia, usuarioId, propriedadeId: input.propriedadeId, operacao: "PROCEDIMENTOS_SERVICO", hashPayload, resultadoIds: { servicoId: op.id, ids: alterados.map((i) => i.id) } } });
    return { servicoId: op.id, quantidade: alterados.length, salvo: true, reenvio: false, itens: alterados.map((i) => ({ id: i.id, tipo: i.tipo, valor: podeEditarValores ? i.valor : null })) };
  });
}
