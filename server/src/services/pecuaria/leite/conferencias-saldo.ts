import type { ConferenciaSaldoLeite } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { transacaoPecuaria } from "../transacao.js";
import { conferirSitioLeiteTx } from "./configuracoes.js";
import { registrarConferenciaSaldoLeiteSchema, consultarConferenciasSaldoLeiteSchema, type RegistrarConferenciaSaldoLeiteInput } from "./conferencias-saldo.schemas.js";
export function conferenciaSaldoLeiteDTO(c: ConferenciaSaldoLeite & { produto: { nome: string } }) {
  return { id: c.id, propriedadeId: c.propriedadeId, produtoId: c.produtoId, produtoNome: c.produto.nome, data: c.data.toISOString().slice(0, 10),
    litrosObservados: c.litrosObservados.toNumber(), referencia: c.referencia, responsavel: c.responsavel, versao: c.versao,
    motivoCorrecao: c.motivoCorrecao, criadoEm: c.criadoEm.toISOString(), criadoPorId: c.criadoPorId };
}
export async function registrarConferenciaSaldoLeite(input: RegistrarConferenciaSaldoLeiteInput & { propriedadeId: number }, usuarioId: number | null) {
  const dados = { ...registrarConferenciaSaldoLeiteSchema.parse(input), propriedadeId: input.propriedadeId };
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, dados, usuarioId, "CONFERENCIA_FISICA_LEITE", async () => {
      await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
      const data = new Date(dados.data);
      if (data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "A conferência deve ter data até hoje");
      const produto = await tx.produto.findFirst({ where: { id: dados.produtoId, unidade: "L", rastrearPartidas: false } });
      if (!produto) throw new RebanhoError("VALIDACAO", "Selecione um produto em litros com origens leiteiras");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leite-conferencia:${dados.propriedadeId}:${dados.produtoId}:${dados.data}`}))`;
      const ultima = await tx.conferenciaSaldoLeite.findFirst({ where: { propriedadeId: dados.propriedadeId, produtoId: dados.produtoId, data }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== dados.versaoEsperada) throw new RebanhoError("CONFLITO", "A conferência física mudou; recarregue antes de registrar outra versão");
      const criada = await tx.conferenciaSaldoLeite.create({ data: { propriedadeId: dados.propriedadeId, produtoId: dados.produtoId, data,
        litrosObservados: new Prisma.Decimal(dados.litrosObservados), referencia: dados.referencia, responsavel: dados.responsavel,
        versao: dados.versaoEsperada + 1, motivoCorrecao: dados.motivoCorrecao ?? null, criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "ConferenciaSaldoLeite", entidadeId: criada.id, propriedadeId: dados.propriedadeId, usuarioId,
        acao: ultima ? "CORRECAO" : "OBSERVACAO_FISICA", antes: ultima, depois: criada });
      return { id: criada.id };
    });
    return conferenciaSaldoLeiteDTO(await tx.conferenciaSaldoLeite.findFirstOrThrow({ where: { id: resultado.id, propriedadeId: dados.propriedadeId }, include: { produto: { select: { nome: true } } } }));
  });
}
export async function listarConferenciasSaldoLeite(propriedadeId: number, input: ReturnType<typeof consultarConferenciasSaldoLeiteSchema.parse>) {
  const filtro = consultarConferenciasSaldoLeiteSchema.parse(input);
  const where = { propriedadeId, ...(filtro.produtoId ? { produtoId: filtro.produtoId } : {}), ...(filtro.data ? { data: new Date(filtro.data) } : {}) };
  const [itens, total] = await prisma.$transaction([prisma.conferenciaSaldoLeite.findMany({ where, include: { produto: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { versao: "desc" }, { id: "desc" }], skip: (filtro.pagina - 1) * 20, take: 20 }), prisma.conferenciaSaldoLeite.count({ where })]);
  return { propriedadeId, itens: itens.map(conferenciaSaldoLeiteDTO), total, pagina: filtro.pagina, tamanho: 20 };
}
