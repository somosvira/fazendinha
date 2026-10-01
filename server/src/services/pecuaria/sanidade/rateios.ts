import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
type TipoRateio = "APLICACAO" | "EXAME" | "PROTOCOLO";
async function contexto(tx: Prisma.TransactionClient, servicoId: string, propriedadeId: number) {
  const servico = await tx.operacao.findFirst({ where: { id: servicoId, propriedadeId, tipo: "SERVICO", status: "CONFIRMADA" } });
  if (!servico) throw new RebanhoError("VALIDACAO", "Serviço confirmado não encontrado neste sítio");
  const [aplicacoes, exames, protocolos] = await Promise.all([
    tx.aplicacaoProduto.findMany({ where: { operacaoServicoId: servicoId, propriedadeId, status: "VALIDO" }, include: { tarefa: { select: { execucaoId: true } } } }),
    tx.exameAnimal.findMany({ where: { operacaoServicoId: servicoId, propriedadeId, status: "VALIDO" }, include: { tarefa: { select: { execucaoId: true } }, tipoExame: { select: { nome: true } } } }),
    tx.execucaoProtocoloSanitario.findMany({ where: { operacaoServicoId: servicoId, propriedadeId, canceladaEm: null }, include: { protocolo: { select: { nome: true } } } }),
  ]);
  const itens = [
    ...aplicacoes.map((a) => ({ id: a.id, tipo: "APLICACAO" as const, animalId: a.animalId, nome: a.nomeProdutoAplicado, valor: a.valorServicoAtribuido, execucaoId: a.tarefa?.execucaoId })),
    ...exames.map((e) => ({ id: e.id, tipo: "EXAME" as const, animalId: e.animalId, nome: e.tipoExame.nome, valor: e.valorServicoAtribuido, execucaoId: e.tarefa?.execucaoId })),
    ...protocolos.map((p) => ({ id: p.id, tipo: "PROTOCOLO" as const, animalId: p.animalId, nome: p.protocolo.nome, valor: p.valorServicoAtribuido, execucaoId: p.id })),
  ];
  return { servico, itens };
}
export async function listarRateios(servicoId: string, propriedadeId: number) {
  return prisma.$transaction(async (tx) => {
    const c = await contexto(tx, servicoId, propriedadeId);
    const total = c.itens.reduce((s, i) => s.plus(i.valor ?? 0), new Prisma.Decimal(0));
    return { valorConfirmado: c.servico.valorTotal.toString(), totalAtribuido: total.toString(), disponivel: c.servico.valorTotal.minus(total).toString(), itens: c.itens.map((i) => ({ ...i, valor: i.valor?.toString() ?? null })) };
  });
}
export async function salvarRateio(input: { servicoId: string; propriedadeId: number; tipo: TipoRateio; id: string; valor: string | null; motivo: string }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const original = await contexto(tx, input.servicoId, input.propriedadeId);
    const item = original.itens.find((i) => i.id === input.id && i.tipo === input.tipo);
    if (!item) throw new RebanhoError("NAO_ENCONTRADO", "Fato válido não vinculado a este Serviço");
    await travarAnimais(tx, [item.animalId]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-servico-rateio:${input.servicoId}`}))`;
    const c = await contexto(tx, input.servicoId, input.propriedadeId);
    const valor = input.valor == null ? null : new Prisma.Decimal(input.valor);
    if (valor && (!valor.isFinite() || valor.lt(0) || valor.decimalPlaces() > 2)) throw new RebanhoError("VALIDACAO", "Valor de rateio inválido");
    const total = c.itens.filter((i) => i.id !== item.id).reduce((s, i) => s.plus(i.valor ?? 0), new Prisma.Decimal(0)).plus(valor ?? 0);
    if (total.gt(c.servico.valorTotal)) throw new RebanhoError("CONFLITO", "O rateio ultrapassa o valor confirmado do Serviço");
    if (valor?.gt(0) && c.itens.some((i) => i.id !== item.id && i.valor?.gt(0) && i.execucaoId === item.execucaoId && item.execucaoId && (item.tipo === "PROTOCOLO" || i.tipo === "PROTOCOLO"))) throw new RebanhoError("CONFLITO", "Não atribua o mesmo Serviço ao protocolo e aos seus fatos; retire o rateio anterior");
    if (input.tipo === "APLICACAO") await tx.aplicacaoProduto.update({ where: { id: item.id }, data: { valorServicoAtribuido: valor } });
    else if (input.tipo === "EXAME") await tx.exameAnimal.update({ where: { id: item.id }, data: { valorServicoAtribuido: valor } });
    else await tx.execucaoProtocoloSanitario.update({ where: { id: item.id }, data: { valorServicoAtribuido: valor } });
    await auditar(tx, { entidade: input.tipo === "APLICACAO" ? "AplicacaoProduto" : input.tipo === "EXAME" ? "ExameAnimal" : "ExecucaoProtocoloSanitario", entidadeId: item.id, animalId: item.animalId, propriedadeId: input.propriedadeId, acao: "RATEIO_SERVICO", usuarioId, antes: { valor: item.valor }, depois: { valor, motivo: input.motivo, servicoId: input.servicoId, totalAtribuido: total } });
    return { id: item.id, valor: valor?.toString() ?? null, totalAtribuido: total.toString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
