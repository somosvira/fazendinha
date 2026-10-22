import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { consultaComercialLeiteSchema } from "./comercial.schemas.js";
type Filtro = z.input<typeof consultaComercialLeiteSchema>;
const data = (v: string) => new Date(`${v}T00:00:00Z`);
const texto = (v: Date) => v.toISOString().slice(0, 10);
/** Coleta usa movimento físico; venda usa comprador/período, nunca data do recebimento. */
export async function consultarColetasOperacoesLeite(propriedadeId: number, raw: Filtro) {
  const f = consultaComercialLeiteSchema.parse(raw);
  const where: Prisma.RetiradaOperacaoLeiteWhereInput = {
    comercial: { propriedadeId, ...(f.parceiroId ? { parceiroId: f.parceiroId } : {}) },
    movimento: { status: "CONFIRMADO", ...(f.de || f.ate ? { data: { ...(f.de ? { gte: data(f.de) } : {}), ...(f.ate ? { lte: data(f.ate) } : {}) } } : {}) },
  };
  return prisma.$transaction(async tx => {
    const [total, linhas] = await Promise.all([tx.retiradaOperacaoLeite.count({ where }), tx.retiradaOperacaoLeite.findMany({ where,
      include: { movimento: { select: { data: true, quantidade: true, produto: { select: { nome: true } } } }, comprovantes: { select: { id: true, nome: true, mimeType: true } }, comercial: { select: { id: true, status: true, inicio: true, fim: true, parceiro: { select: { id: true, nome: true } } } } },
      orderBy: [{ movimento: { data: "desc" } }, { id: "desc" }], skip: (f.pagina - 1) * f.porPagina, take: f.porPagina })]);
    return { propriedadeId, total, pagina: f.pagina, porPagina: f.porPagina, itens: linhas.map(r => ({ id: r.id, comercialId: r.comercialId, data: texto(r.movimento.data), produtoNome: r.movimento.produto.nome,
      quantidadeLitros: r.movimento.quantidade.toString(), referencia: r.referencia, pontoColeta: r.pontoColeta, horarioColeta: r.horarioColeta, comprovantes: r.comprovantes,
      parceiroId: r.comercial.parceiro.id, parceiroNome: r.comercial.parceiro.nome, inicio: texto(r.comercial.inicio), fim: texto(r.comercial.fim), situacao: r.comercial.status === "ABERTA" ? "PRECO_PENDENTE" : "FECHADA" })) };
  }, { isolationLevel: "RepeatableRead" });
}
export async function consultarVendasOperacoesLeite(propriedadeId: number, raw: Filtro, verValores: boolean) {
  const f = consultaComercialLeiteSchema.parse(raw);
  const where: Prisma.OperacaoComercialLeiteWhereInput = { propriedadeId, status: "FECHADA",
    ...(f.parceiroId ? { parceiroId: f.parceiroId } : {}), ...(f.de ? { fim: { gte: data(f.de) } } : {}), ...(f.ate ? { inicio: { lte: data(f.ate) } } : {}) };
  return prisma.$transaction(async tx => {
    const [total, linhas] = await Promise.all([tx.operacaoComercialLeite.count({ where }), tx.operacaoComercialLeite.findMany({ where,
      include: { parceiro: { select: { id: true, nome: true } }, fechamentos: { orderBy: { versao: "desc" }, take: 1, include: { amostras: true, operacao: { select: { numero: true, data: true, status: true, valorTotal: true } } } } },
      orderBy: [{ inicio: "desc" }, { id: "desc" }], skip: (f.pagina - 1) * f.porPagina, take: f.porPagina })]);
    return { propriedadeId, total, pagina: f.pagina, porPagina: f.porPagina, itens: linhas.map(o => {
      const fechamento = o.fechamentos[0];
      return { id: o.id, comercialId: o.id, parceiroId: o.parceiroId, parceiroNome: o.parceiro.nome, inicio: texto(o.inicio), fim: texto(o.fim), referencia: o.referencia,
        fechamento: fechamento ? { id: fechamento.id, versao: fechamento.versao, data: texto(fechamento.operacao.data), status: fechamento.operacao.status, numeroOperacao: fechamento.operacao.numero,
          volumeReconhecido: fechamento.volumeReconhecido.toString(), precoUnitario: verValores ? fechamento.precoUnitario.toFixed(4) : null,
          valorTotal: verValores ? fechamento.operacao.valorTotal.toFixed(2) : null, amostras: fechamento.amostras.map(a => ({ amostraId: a.amostraId, versaoAmostra: a.versaoAmostra, snapshot: a.snapshot })) } : null };
    }) };
  }, { isolationLevel: "RepeatableRead" });
}
