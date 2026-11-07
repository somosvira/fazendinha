import { Prisma } from "@prisma/client";
import { hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import {
  prepararPartidasTx,
  type SelecaoPartida,
} from "../../estoque/partidas.js";
import {
  planejarSaidaTx,
  registrarSaidaValorizadaTx,
  saldosBasesTx,
  travarValorizacaoTx,
  previaRetroatividadeTx,
} from "../../estoque/valorizacao.js";
import { repartirQuantidade } from "./mensal.calc.js";

type Tx = Prisma.TransactionClient;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
/** Vínculos e efeito físico são gravados na transação do consumo. */
export async function ajustarItemTx(
  tx: Tx,
  itemId: string,
  alvo: Prisma.Decimal,
  usuarioId: number | null,
  motivo: string,
  escolhas?: SelecaoPartida[],
) {
  const item = await tx.itemConsumoDiario.findUniqueOrThrow({
    where: { id: itemId },
    include: {
      produto: true,
      dia: { include: { mes: { include: { configuracao: true } } } },
    },
  });
  const { dia } = item,
    { mes } = dia,
    propriedadeId = mes.propriedadeId;
  if (item.unidade !== item.produto.unidade)
    throw new RebanhoError(
      "CONFLITO",
      "A unidade do produto difere do consumo histórico; reconcilie o cadastro antes de ajustar",
    );
  const diferenca = alvo.minus(item.confirmada);
  if (diferenca.isZero()) return;
  if (alvo.lt(0) || alvo.decimalPlaces() > 3)
    throw new RebanhoError("VALIDACAO", "Quantidade revisada inválida");
  if (
    !dia.centroCustoId ||
    !(await tx.centroCusto.findFirst({
      where: { id: dia.centroCustoId, ativo: true },
    }))
  )
    throw new RebanhoError(
      "CONFLITO",
      "Informe um centro de custo ativo no lote",
    );
  const data = hojeFazendaDate();
  await exigirPeriodoAberto(tx, propriedadeId, dia.data);
  await exigirPeriodoAberto(tx, propriedadeId, data);
  await travarValorizacaoTx(tx, [item.produtoId]);
  const baseMovimento = {
    produtoId: item.produtoId,
    propriedadeId,
    data,
    origem: "NUTRICAO" as const,
    centroCustoId: dia.centroCustoId,
    criadoPorId: usuarioId,
    observacao: motivo,
  };
  let movimentoId: string, valor: Prisma.Decimal;
  if (diferenca.gt(0)) {
    let partidas = escolhas;
    if (item.produto.rastrearPartidas && !partidas?.length) {
      if (!mes.configuracao.autorizaValidade)
        throw new RebanhoError(
          "CONFLITO",
          "Este produto controla lotes por validade: escolha o lote de estoque do dia ou autorize, na configuração do fechamento, o uso do lote que vence primeiro",
        );
      const bases = await saldosBasesTx(
        tx,
        item.produtoId,
        propriedadeId,
        data,
      );
      const elegiveis = await tx.partidaProduto.findMany({
        where: {
          id: { in: bases.flatMap((b) => (b.partidaId ? [b.partidaId] : [])) },
          validade: { gte: dia.data },
        },
        orderBy: [{ validade: "asc" }, { id: "asc" }],
      });
      let falta = diferenca;
      partidas = [];
      for (const p of elegiveis) {
        const saldo = bases
          .filter((b) => b.partidaId === p.id)
          .reduce((s, b) => s.plus(b.quantidade), D(0));
        const quantidade = Prisma.Decimal.min(
          falta,
          Prisma.Decimal.max(saldo, 0),
        );
        if (quantidade.gt(0))
          partidas.push({ partidaId: p.id, quantidade: quantidade.toString() });
        falta = falta.minus(quantidade);
        if (falta.isZero()) break;
      }
      if (falta.gt(0))
        throw new RebanhoError(
          "CONFLITO",
          "Saldo insuficiente em lotes com validade conhecida e vigente",
        );
    }
    const distribuicao = await prepararPartidasTx(tx, {
      produtoId: item.produtoId,
      rastrearPartidas: item.produto.rastrearPartidas,
      propriedadeId,
      tipo: "SAIDA",
      data: dia.data,
      quantidade: diferenca,
      partidas,
      usuarioId,
    });
    const plano = await planejarSaidaTx(tx, {
      produtoId: item.produtoId,
      propriedadeId,
      data,
      quantidade: diferenca,
      partidas: distribuicao,
    });
    valor = plano.valorTotal;
    const movimento = await tx.movimentoEstoque.create({
      data: {
        ...baseMovimento,
        tipo: "SAIDA",
        quantidade: diferenca,
        custoUnitario: plano.custoUnitario,
        valorTotal: valor,
        alocacaoPartidaEstoques: {
          create: distribuicao.map((p) => ({
            partidaId: p.partidaId,
            quantidade: p.quantidade,
          })),
        },
      },
    });
    await registrarSaidaValorizadaTx(tx, movimento.id, plano);
    movimentoId = movimento.id;
  } else {
    const cronologia = await previaRetroatividadeTx(
      tx,
      item.produtoId,
      propriedadeId,
      data,
    );
    if (!cronologia.permitido)
      throw new RebanhoError("CONFLITO", cronologia.motivo!);
    const vinculos = await tx.movimentoConsumoDiario.findMany({
      where: { itemId },
      include: {
        movimento: {
          include: { parcelasValorizacao: { include: { base: true } } },
        },
      },
      orderBy: { id: "asc" },
    });
    const porBase = new Map<
      string,
      {
        quantidade: Prisma.Decimal;
        valor: Prisma.Decimal;
        partidaId: string | null;
        metodo: string;
      }
    >();
    for (const v of vinculos)
      for (const p of v.movimento.parcelasValorizacao) {
        const b = porBase.get(p.baseId) ?? {
          quantidade: D(0),
          valor: D(0),
          partidaId: p.base.partidaId,
          metodo: p.base.metodo,
        };
        b.quantidade = b.quantidade.minus(p.quantidade);
        b.valor = b.valor.minus(p.valorTotal);
        porBase.set(p.baseId, b);
      }
    const bases = [...porBase.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, b]) => b.quantidade.gt(0));
    if (
      !bases
        .reduce((a, [, b]) => a.plus(b.quantidade), D(0))
        .eq(item.confirmada)
    )
      throw new RebanhoError(
        "CONFLITO",
        "As bases do consumo precisam ser conciliadas antes da recomposição",
      );
    const metodoAtual = item.produto.rastrearPartidas
      ? "MEDIA_SALDO_V1"
      : "FIFO_AQUISICAO_V1";
    if (bases.some(([, b]) => b.metodo !== metodoAtual))
      throw new RebanhoError(
        "CONFLITO",
        "O rastreio do produto mudou após o consumo; reconcilie a valorização antes de recompor",
      );
    const quantidades = repartirQuantidade(
      diferenca.negated(),
      bases.map(([, b]) => b.quantidade),
    );
    const parcelas = bases
      .map(([baseId, b], i) => ({
        baseId,
        partidaId: b.partidaId,
        quantidade: quantidades[i],
        valorTotal: quantidades[i].eq(b.quantidade)
          ? b.valor
          : b.valor.mul(quantidades[i]).div(b.quantidade).toDecimalPlaces(2),
      }))
      .filter((p) => p.quantidade.gt(0));
    const total = parcelas.reduce((a, p) => a.plus(p.valorTotal), D(0));
    valor = total.negated();
    const porPartida = new Map<string, Prisma.Decimal>();
    for (const p of parcelas)
      if (p.partidaId)
        porPartida.set(
          p.partidaId,
          (porPartida.get(p.partidaId) ?? D(0)).plus(p.quantidade),
        );
    const movimento = await tx.movimentoEstoque.create({
      data: {
        ...baseMovimento,
        tipo: "ENTRADA",
        quantidade: diferenca.negated(),
        valorTotal: total,
        custoUnitario: total.div(diferenca.negated()).toDecimalPlaces(4),
        metodoValorizacao: item.produto.rastrearPartidas
          ? "MEDIA_SALDO_V1"
          : "FIFO_AQUISICAO_V1",
        alocacaoPartidaEstoques: {
          create: [...porPartida].map(([partidaId, quantidade]) => ({
            partidaId,
            quantidade,
          })),
        },
      },
    });
    await tx.parcelaValorizacaoEstoque.createMany({
      data: parcelas.map((p, ordem) => ({
        movimentoEstoqueId: movimento.id,
        baseId: p.baseId,
        ordem,
        quantidade: p.quantidade,
        valorTotal: p.valorTotal,
      })),
    });
    movimentoId = movimento.id;
  }
  await tx.movimentoConsumoDiario.create({
    data: { itemId, movimentoId, quantidade: diferenca, valor, motivo },
  });
  await tx.itemConsumoDiario.update({
    where: { id: itemId },
    data: { confirmada: alvo, custoLiquido: { increment: valor } },
  });
}
