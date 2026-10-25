import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { EstoqueError, obterBaseCusto, statusSaldoEstoque } from "./estoque.js";
import { custoMedioDaBase, valorSaidaDaBase } from "./estoque.calc.js";
import { idsGrupoPartidaTx, listarPartidas } from "./partidas.js";
import { includeProduto, produtoDTO } from "./produtos.js";
import { METODO_LEITE, valoresMovimentosLeiteTx } from "./leite.js";

async function escopo(propriedadeId: number | null): Promise<Prisma.MovimentoEstoqueWhereInput> {
  if (propriedadeId == null) return {};
  return propriedadeId === await propriedadePrincipalId() ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId };
}

export async function detalheProduto(produtoId: string, propriedadeId: number | null, verValores: boolean, financeiro: boolean) {
  const produto = await prisma.produto.findUnique({ where: { id: produtoId }, include: includeProduto });
  if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto não encontrado");
  const [movimentos, base, lotes] = await Promise.all([
    prisma.movimentoEstoque.findMany({ where: { produtoId, status: statusSaldoEstoque, ...await escopo(propriedadeId) }, select: { tipo: true, quantidade: true } }),
    verValores ? obterBaseCusto(prisma, produtoId, propriedadeId) : Promise.resolve(null),
    listarPartidas(produtoId, propriedadeId),
  ]);
  const saldo = movimentos.reduce((s, m) => m.tipo === "SAIDA" ? s.minus(m.quantidade) : s.plus(m.quantidade), new Prisma.Decimal(0));
  const conhecido = base != null && base.quantidade.eq(saldo);
  const custo = conhecido ? custoMedioDaBase(base) : null;
  const dto = produtoDTO(produto);
  return { ...dto, fornecedores: dto.fornecedores.map((f) => ({ ...f, id: financeiro ? f.id : null })), propriedadeId,
    saldo: saldo.toString(), custoMedio: custo?.toString() ?? null,
    valor: verValores ? (conhecido ? base.valor.toString() : saldo.isZero() ? "0" : null) : null,
    estadoValor: !verValores ? "OCULTO" : conhecido || saldo.isZero() ? "CONHECIDO" : "DESCONHECIDO",
    totalLotes: lotes.length, lotesComSaldo: lotes.filter((l) => new Prisma.Decimal(l.saldo).gt(0)).length };
}

export async function lotesProduto(produtoId: string, propriedadeId: number | null, pagina: number, porPagina: number) {
  const lotes = await listarPartidas(produtoId, propriedadeId);
  return { itens: lotes.slice((pagina - 1) * porPagina, pagina * porPagina), total: lotes.length, pagina, porPagina };
}

export async function origensProduto(produtoId: string, propriedadeId: number | null, filtros: { partidaId?: string; pagina: number; porPagina: number }, verValores: boolean, financeiro: boolean) {
  const idsGrupo = filtros.partidaId ? await idsGrupoPartidaTx(prisma, filtros.partidaId) : null;
  const where: Prisma.MovimentoEstoqueWhereInput = { produtoId, status: statusSaldoEstoque, reversaoDeId: null,
    AND: [await escopo(propriedadeId), { OR: [{ tipo: "ENTRADA" }, { tipo: "AJUSTE", quantidade: { gt: 0 } }] }],
    ...(idsGrupo ? { alocacaoPartidaEstoques: { some: { partidaId: { in: idsGrupo } } } } : {}),
  };
  const [total, entradas] = await Promise.all([
    prisma.movimentoEstoque.count({ where }),
    prisma.movimentoEstoque.findMany({ where, orderBy: [{ data: "desc" }, { seq: "desc" }], skip: (filtros.pagina - 1) * filtros.porPagina, take: filtros.porPagina,
      include: { parcelasValorizacao: { include: { base: { select: { partidaId: true } } } }, operacao: { select: { id: true, numero: true, tipo: true, parceiro: { select: { id: true, nome: true } } } },
        alocacaoPartidaEstoques: { include: { partida: { select: { nome: true, codigo: true, validade: true, lotePrincipalId: true } } } } } }),
  ]);
  const valoresLeite = verValores ? await valoresMovimentosLeiteTx(prisma, entradas.filter(m => m.metodoValorizacao === METODO_LEITE).map(m => m.id)) : new Map<string, { valorTotal: Prisma.Decimal | null; custoUnitario: Prisma.Decimal | null }>();
  return { itens: entradas.map((original) => {
    const m = valoresLeite.has(original.id) ? { ...original, ...valoresLeite.get(original.id)! } : original;
    const quantidadeConsulta = idsGrupo ? m.alocacaoPartidaEstoques.filter((a) => idsGrupo.includes(a.partidaId)).reduce((s, a) => s.plus(a.quantidade), new Prisma.Decimal(0)) : m.quantidade;
    // Recorte de exibição do valor original, sem novo método de custo por lote.
    const parcelasDoGrupo = idsGrupo ? (m.parcelasValorizacao ?? []).filter(p => p.base.partidaId != null && idsGrupo.includes(p.base.partidaId)) : [];
    const valorConsulta = !idsGrupo || quantidadeConsulta.eq(m.quantidade) ? m.valorTotal
      : parcelasDoGrupo.length > 0 ? parcelasDoGrupo.reduce((v,p) => v.plus(p.valorTotal), new Prisma.Decimal(0)).mul(m.tipo === "SAIDA" ? -1 : 1) : null;
    return { id: m.id, movimentoId: m.id, seq: m.seq, data: m.data.toISOString().slice(0, 10), propriedadeId: m.propriedadeId,
    origem: m.origem, status: m.status,
    quantidade: quantidadeConsulta.toString(),
    quantidadeMovimento: m.quantidade.toString(), custoUnitario: verValores ? m.custoUnitario?.toString() ?? null : null, valorTotal: verValores ? valorConsulta?.toString() ?? null : null,
    metodoValorizacao: m.metodoValorizacao ?? "LEGADO",
    valorTotalMovimento: verValores ? m.valorTotal?.toString() ?? null : null,
    fornecedor: m.operacao?.parceiro?.nome ?? null, fornecedorId: financeiro ? m.operacao?.parceiro?.id ?? null : null,
    operacaoId: financeiro ? m.operacao?.id ?? null : null, operacaoNumero: financeiro ? m.operacao?.numero ?? null : null,
    partidas: m.alocacaoPartidaEstoques.filter((a) => !idsGrupo || idsGrupo.includes(a.partidaId)).map((a) => ({ partidaId: a.partidaId, lotePrincipalId: a.partida.lotePrincipalId ?? a.partidaId, nome: a.partida.nome, codigo: a.partida.codigo, validade: a.partida.validade, quantidade: a.quantidade.toString() })) };
  }),
    total, pagina: filtros.pagina, porPagina: filtros.porPagina };
}
