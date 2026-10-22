import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { baixarLeiteTx, estornarBaixaLeiteTx, saldosOrigensLeiteTx } from "../../estoque/leite.js";
import { travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { auditar, hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { transacaoPecuaria } from "../transacao.js";
import { conferirSitioLeiteTx } from "./configuracoes.js";
import { descarteLeiteSchema, estornoDescarteLeiteSchema, consultaDescartesLeiteSchema, type DescarteLeiteInput, type EstornoDescarteLeiteInput } from "./descartes.schemas.js";

const incluir = { entrada: { include: { sessao: { select: { nome: true } }, movimento: { select: { produtoId: true, produto: { select: { nome: true } } } } } } } as const;
type Descarte = Prisma.DescarteLeiteGetPayload<{ include: typeof incluir }>;
export function descarteLeiteDTO(d: Descarte) {
  return { id: d.id, propriedadeId: d.propriedadeId, entradaId: d.entradaId, produtoId: d.entrada.movimento.produtoId, produtoNome: d.entrada.movimento.produto.nome,
    nomeOrdenha: d.entrada.sessao.nome, data: d.data.toISOString().slice(0, 10), quantidadeLitros: d.quantidadeLitros.toNumber(),
    saldoOrigemAntes: d.saldoOrigemAntes.toNumber(), saldoOrigemDepois: d.saldoOrigemDepois.toNumber(), motivo: d.motivo,
    status: d.status, versao: d.versao, criadoEm: d.criadoEm.toISOString(), criadoPorId: d.criadoPorId,
    estornadoEm: d.estornadoEm?.toISOString() ?? null, motivoEstorno: d.motivoEstorno };
}
export type DescarteLeiteDTO = ReturnType<typeof descarteLeiteDTO>;
export async function registrarDescarteLeite(input: DescarteLeiteInput & { propriedadeId: number }, usuarioId: number | null) {
  const dados = { ...descarteLeiteSchema.parse(input), propriedadeId: input.propriedadeId };
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, dados, usuarioId, "DESCARTE_LEITE", async () => {
      await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
      const data = new Date(dados.data);
      if (data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "O descarte deve ter data até hoje", "data");
      const origem = await tx.entradaProducaoLeite.findFirst({ where: { id: dados.entradaId, status: "CONFIRMADA", movimento: { propriedadeId: dados.propriedadeId, status: "CONFIRMADO" } }, include: { movimento: true } });
      if (!origem) throw new RebanhoError("NAO_ENCONTRADO", "Origem confirmada não encontrada neste sítio");
      if (origem.movimento.data > data) throw new RebanhoError("VALIDACAO", "O descarte não pode anteceder a produção", "data");
      await travarValorizacaoTx(tx, [origem.movimento.produtoId]);
      const saldo = (await saldosOrigensLeiteTx(tx, origem.movimento.produtoId, dados.propriedadeId, data)).find(o => o.entradaId === origem.id);
      if (!saldo || !saldo.quantidade.eq(dados.quantidadeDisponivelEsperadaLitros)) throw new RebanhoError("CONFLITO", "O saldo da origem mudou; confira antes de descartar");
      if (saldo.quantidade.lt(dados.quantidadeLitros)) throw new RebanhoError("VALIDACAO", "O descarte supera o saldo da origem");
      const movimento = await baixarLeiteTx(tx, { produtoId: origem.movimento.produtoId, propriedadeId: dados.propriedadeId,
        data, quantidade: dados.quantidadeLitros, entradaIds: [origem.id], origem: "PERDA", observacao: dados.motivo, usuarioId });
      const criado = await tx.descarteLeite.create({ data: { propriedadeId: dados.propriedadeId, entradaId: origem.id, movimentoId: movimento.id,
        data, quantidadeLitros: new Prisma.Decimal(dados.quantidadeLitros), saldoOrigemAntes: saldo.quantidade,
        saldoOrigemDepois: saldo.quantidade.minus(dados.quantidadeLitros), motivo: dados.motivo, criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "DescarteLeite", entidadeId: criado.id, propriedadeId: dados.propriedadeId, usuarioId, acao: "DESCARTE", depois: criado });
      return { id: criado.id };
    });
    return descarteLeiteDTO(await tx.descarteLeite.findFirstOrThrow({ where: { id: resultado.id, propriedadeId: dados.propriedadeId }, include: incluir }));
  });
}
export async function estornarDescarteLeite(id: string, input: EstornoDescarteLeiteInput & { propriedadeId: number }, usuarioId: number | null) {
  const dados = { ...estornoDescarteLeiteSchema.parse(input), propriedadeId: input.propriedadeId };
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, dados, usuarioId, `DESCARTE_LEITE_ESTORNO:${id}`, async () => {
      await tx.$queryRaw`SELECT id FROM pecuaria."DescarteLeite" WHERE id=${id} AND "propriedadeId"=${dados.propriedadeId} FOR UPDATE`;
      const original = await tx.descarteLeite.findFirst({ where: { id, propriedadeId: dados.propriedadeId } });
      if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Descarte não encontrado neste sítio");
      if (original.status !== "CONFIRMADO" || original.versao !== dados.versaoEsperada) throw new RebanhoError("CONFLITO", "O descarte mudou; recarregue antes de estornar");
      const inverso = await estornarBaixaLeiteTx(tx, { movimentoId: original.movimentoId, propriedadeId: dados.propriedadeId, usuarioId, motivo: dados.motivo });
      await tx.descarteLeite.update({ where: { id }, data: { status: "ESTORNADO", versao: { increment: 1 }, estornadoEm: new Date(), estornadoPorId: usuarioId, motivoEstorno: dados.motivo, movimentoEstornoId: inverso.id } });
      await auditar(tx, { entidade: "DescarteLeite", entidadeId: id, propriedadeId: dados.propriedadeId, usuarioId, acao: "ESTORNO", antes: original, depois: { movimentoEstornoId: inverso.id, motivo: dados.motivo } });
      return { id };
    });
    return descarteLeiteDTO(await tx.descarteLeite.findFirstOrThrow({ where: { id: resultado.id, propriedadeId: dados.propriedadeId }, include: incluir }));
  });
}
export async function obterDescarteLeite(id: string, propriedadeId: number) {
  const fato = await prisma.descarteLeite.findFirst({ where: { id, propriedadeId }, include: incluir });
  if (!fato) throw new RebanhoError("NAO_ENCONTRADO", "Descarte não encontrado neste sítio");
  return descarteLeiteDTO(fato);
}
export async function listarDescartesLeite(propriedadeId: number, input: ReturnType<typeof consultaDescartesLeiteSchema.parse>) {
  const filtro = consultaDescartesLeiteSchema.parse(input);
  const where = { propriedadeId, ...(filtro.de || filtro.ate ? { data: { ...(filtro.de ? { gte: new Date(filtro.de) } : {}), ...(filtro.ate ? { lte: new Date(filtro.ate) } : {}) } } : {}) };
  const [itens, total] = await prisma.$transaction([prisma.descarteLeite.findMany({ where, include: incluir, orderBy: [{ data: "desc" }, { id: "desc" }], skip: (filtro.pagina - 1) * 20, take: 20 }), prisma.descarteLeite.count({ where })]);
  return { propriedadeId, itens: itens.map(descarteLeiteDTO), total, pagina: filtro.pagina, tamanho: 20 };
}
