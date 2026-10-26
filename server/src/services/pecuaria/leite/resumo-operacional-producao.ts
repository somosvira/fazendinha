import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { RebanhoError } from "../rebanho/regras.js";
import { dataLeiteSchema } from "./schemas.js";

export const consultaResumoOperacionalProducaoSchema = z.object({
  inicio: dataLeiteSchema, fim: dataLeiteSchema,
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(),
}).strict().refine(f => f.inicio <= f.fim && (Date.parse(f.fim) - Date.parse(f.inicio)) / 86400000 < 366,
  "Consulte até 366 dias, com início anterior ao fim");
type Filtro = z.input<typeof consultaResumoOperacionalProducaoSchema>;
const zero = () => new Prisma.Decimal(0);
const texto = (d: Date) => d.toISOString().slice(0, 10);
const MAX_FATOS = 50_000;

/** Quantidades operacionais pela data do fato físico; sem preços, caixa ou inferência clínica. */
export async function consultarResumoOperacionalProducaoLeite(propriedadeId: number, raw: Filtro) {
  const f = consultaResumoOperacionalProducaoSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const periodo = { gte: new Date(f.inicio), lte: new Date(f.fim) };
    const fatoWhere = { propriedadeId, data: periodo, status: "CONFIRMADO", movimento: { propriedadeId, status: "CONFIRMADO" as const } };
    const nutricaoWhere = { propriedadeId, data: periodo, status: "CONFIRMADO" };
    // Uma linha por movimento impede repetir a retirada nas versões comerciais/entregas.
    const vendaWhere: Prisma.MovimentoEstoqueWhereInput = {
      propriedadeId, data: periodo, status: "CONFIRMADO", tipo: "SAIDA", metodoValorizacao: "LEITE_FIFO_V1", reversaoDeId: null,
      OR: [
        { retiradaOperacaoLeite: { comercial: { propriedadeId, status: { not: "ANULADA" } } } },
        { retiradaOperacaoLeite: null, versoesComerciaisLeite: { some: { operacao: { status: "CONFIRMADA" } } } },
        { retiradaOperacaoLeite: null, versoesComerciaisLeite: { none: {} }, operacao: { tipo: "VENDA", status: "CONFIRMADA" } },
      ],
    };
    // Conta também os filhos antes dos joins; o teto vale para todo o conjunto materializado.
    const contagens = await Promise.all([
      tx.destinoInternoLeite.count({ where: fatoWhere }), tx.fornecimentoNutricionalLeite.count({ where: nutricaoWhere }),
      tx.descarteLeite.count({ where: fatoWhere }), tx.movimentoEstoque.count({ where: vendaWhere }),
      tx.movimentoFornecimentoNutricionalLeite.count({ where: { fornecimento: nutricaoWhere } }),
      tx.alocacaoLeiteEstoque.count({ where: { movimento: { descarteLeite: fatoWhere } } }),
    ]);
    if (contagens.reduce((s, n) => s + n, 0) > MAX_FATOS) throw new RebanhoError("VALIDACAO", "Consulte um período menor: limite de 50 mil fatos");
    const [destinos, fornecimentos, descartes, vendas] = await Promise.all([
      tx.destinoInternoLeite.findMany({ where: fatoWhere, select: { data: true, movimentoId: true, natureza: true, quantidadeLitros: true } }),
      tx.fornecimentoNutricionalLeite.findMany({ where: nutricaoWhere, select: { data: true, quantidadeLitros: true,
        movimentos: { where: { MovimentoEstoque: { propriedadeId, status: "CONFIRMADO" } }, select: { movimentoId: true, natureza: true, quantidadeLitros: true } } } }),
      tx.descarteLeite.findMany({ where: fatoWhere, select: { data: true, quantidadeLitros: true,
        movimento: { select: { alocacoesLeite: { select: { quantidade: true, classificacao: { select: { natureza: true } } } } } } } }),
      tx.movimentoEstoque.findMany({ where: vendaWhere, select: { data: true, quantidade: true,
        retiradaOperacaoLeite: { select: { comercial: { select: { status: true, parceiro: { select: { id: true, nome: true } } } } } },
        versoesComerciaisLeite: { where: { operacao: { status: "CONFIRMADA" } }, orderBy: { versao: "desc" }, take: 1,
          select: { operacao: { select: { parceiro: { select: { id: true, nome: true } } } } } },
        operacao: { select: { parceiro: { select: { id: true, nome: true } } } },
      } }),
    ]);
    const dias = new Map<string, { consumo: { presente: boolean; total: Prisma.Decimal; comum: Prisma.Decimal; naoComercial: Prisma.Decimal; colostro: Prisma.Decimal; nutricao: Prisma.Decimal }; descarte: { presente: boolean; total: Prisma.Decimal; comercial: Prisma.Decimal; naoComercial: Prisma.Decimal; colostro: Prisma.Decimal; semClassificacao: Prisma.Decimal }; vendas: { presente: boolean; total: Prisma.Decimal; compradores: Map<string, { id: string | null; nome: string; litros: Prisma.Decimal }>; coletasSemPreco: number } }>();
    for (let t = Date.parse(f.inicio); t <= Date.parse(f.fim); t += 86400000) dias.set(texto(new Date(t)), {
      consumo: { presente: false, total: zero(), comum: zero(), naoComercial: zero(), colostro: zero(), nutricao: zero() },
      descarte: { presente: false, total: zero(), comercial: zero(), naoComercial: zero(), colostro: zero(), semClassificacao: zero() },
      vendas: { presente: false, total: zero(), compradores: new Map(), coletasSemPreco: 0 },
    });
    const movimentosConsumidos = new Set<string>();
    function consumir(data: Date, movimentoId: string, natureza: string, quantidade: Prisma.Decimal, nutricional: boolean) {
      if (movimentosConsumidos.has(movimentoId)) return;
      movimentosConsumidos.add(movimentoId);
      const c = dias.get(texto(data))!.consumo;
      c.presente = true; c.total = c.total.plus(quantidade);
      if (nutricional) c.nutricao = c.nutricao.plus(quantidade);
      if (["LEITE_COMUM", "COMERCIAL"].includes(natureza)) c.comum = c.comum.plus(quantidade);
      else if (["LEITE_NAO_COMERCIAL", "NAO_COMERCIAL"].includes(natureza)) c.naoComercial = c.naoComercial.plus(quantidade);
      else if (natureza === "COLOSTRO") c.colostro = c.colostro.plus(quantidade);
    }
    for (const d of destinos) consumir(d.data, d.movimentoId, d.natureza, d.quantidadeLitros, false);
    for (const n of fornecimentos) for (const m of n.movimentos) consumir(n.data, m.movimentoId, m.natureza, m.quantidadeLitros, true);
    for (const d of descartes) {
      const c = dias.get(texto(d.data))!.descarte;
      c.presente = true; c.total = c.total.plus(d.quantidadeLitros);
      let classificado = zero();
      // Snapshot da classificação da alocação: restrição posterior da origem não reescreve o descarte.
      for (const a of d.movimento.alocacoesLeite) {
        if (a.classificacao.natureza === "COMERCIAL") c.comercial = c.comercial.plus(a.quantidade);
        else if (a.classificacao.natureza === "NAO_COMERCIAL") c.naoComercial = c.naoComercial.plus(a.quantidade);
        else if (a.classificacao.natureza === "COLOSTRO") c.colostro = c.colostro.plus(a.quantidade);
        else continue;
        classificado = classificado.plus(a.quantidade);
      }
      if (classificado.gt(d.quantidadeLitros)) throw new RebanhoError("CONFLITO", "As alocações do descarte divergem do volume registrado");
      c.semClassificacao = c.semClassificacao.plus(d.quantidadeLitros.minus(classificado));
    }
    for (const v of vendas) {
      const c = dias.get(texto(v.data))!.vendas;
      c.presente = true; c.total = c.total.plus(v.quantidade);
      const comercial = v.retiradaOperacaoLeite?.comercial;
      const parceiro = comercial?.parceiro ?? v.versoesComerciaisLeite[0]?.operacao.parceiro ?? v.operacao?.parceiro;
      const chave = parceiro?.id ?? "SEM_COMPRADOR";
      const comprador = c.compradores.get(chave) ?? { id: parceiro?.id ?? null, nome: parceiro?.nome ?? "Comprador não informado", litros: zero() };
      comprador.litros = comprador.litros.plus(v.quantidade); c.compradores.set(chave, comprador);
      if (comercial?.status === "ABERTA") c.coletasSemPreco++;
    }
    return { propriedadeId, periodo: { inicio: f.inicio, fim: f.fim }, dias: [...dias].map(([data, d]) => {
      const c = d.consumo, x = d.descarte, v = d.vendas;
      const valor = (presente: boolean, n: Prisma.Decimal) => presente ? n.toString() : null;
      return { data,
        consumo: { totalLitros: valor(c.presente, c.total), comumLitros: valor(c.presente, c.comum), naoComercialLitros: valor(c.presente, c.naoComercial), colostroLitros: valor(c.presente, c.colostro), nutricaoLitros: valor(c.presente, c.nutricao), funcionariosLitros: null, casaLitros: null },
        descarte: { totalLitros: valor(x.presente, x.total), comercialLitros: valor(x.presente, x.comercial), naoComercialLitros: valor(x.presente, x.naoComercial), colostroLitros: valor(x.presente, x.colostro), semClassificacaoLitros: valor(x.presente, x.semClassificacao) },
        vendas: { totalLitros: valor(v.presente, v.total), compradores: [...v.compradores.values()].map(p => ({ ...p, litros: p.litros.toString() })), coletasSemPreco: v.coletasSemPreco },
      };
    }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
