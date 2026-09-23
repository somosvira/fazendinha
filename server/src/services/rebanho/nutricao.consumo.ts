import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { saldoProduto, valorSaidaDaBase, type MovIn } from "../estoque/estoque.calc.js";
import { obterBasesCusto, produtosComEstoque } from "../estoque/estoque.js";
import { consumoEsperado, diasNoPeriodo } from "./nutricao.consumo.calc.js";
import { NutricaoError } from "./nutricao.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { resolverCentroSaida } from "../estoque/centro.calc.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function assertPeriodoAberto(propriedadeId: number, data: Date) {
  const periodo = await prisma.periodoFinanceiro.findUnique({ where: { propriedadeId_ano_mes: { propriedadeId, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } } });
  if (periodo?.status === "FECHADO") throw new NutricaoError("MES_FECHADO", "mês financeiro fechado");
}

// Janela de fechamento de consumo: lote + intervalo de datas.
export const consumoSchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
  observacao: z.string().max(200).optional(),
});
export type ConsumoInput = z.infer<typeof consumoSchema>;

// Carrega lote + dieta + composição, resolve cabeças/dias e devolve as linhas de
// consumo já casadas com saldo atual. Base comum de previsão e fechamento.
async function resolverConsumo(grupoId: number, dataInicio: string, dataFim: string, propriedadeId: number | null = null) {
  const grupo = await prisma.grupo.findFirst({
    where: { id: grupoId, ...(propriedadeId != null ? { propriedadeId } : {}) },
    include: {
      dieta: {
        include: {
          itens: {
            include: { produto: { include: { centrosCusto: { select: { centroCustoId: true } } } } },
            orderBy: [{ ordem: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!grupo) throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  if (!grupo.dieta) throw new NutricaoError("SEM_DIETA", "lote não tem dieta atribuída — atribua uma dieta antes de fechar o consumo");
  const itens = grupo.dieta.itens;
  if (itens.length === 0) throw new NutricaoError("SEM_DIETA", `dieta "${grupo.dieta.nome}" não tem composição — cadastre os produtos da dieta antes de fechar o consumo`);

  const dias = diasNoPeriodo(dataInicio, dataFim);
  if (dias <= 0) throw new NutricaoError("PERIODO_INVALIDO", "a data final deve ser igual ou posterior à inicial");

  const numCabecas = await prisma.animal.count({ where: { grupoId, status: "ATIVO", ...(propriedadeId != null ? { propriedadeId } : {}) } });

  const linhasBase = consumoEsperado(
    itens.map((i) => ({ produtoId: i.produtoId, qtdPorCabecaDia: Number(i.qtdPorCabecaDia) })),
    numCabecas,
    dias,
  );

  // Saldo atual de cada produto envolvido (Σ entradas − Σ saídas).
  const produtoIds = itens.map((i) => i.produtoId);
  const movs = await prisma.movimentoEstoque.findMany({ where: { produtoId: { in: produtoIds }, ...(propriedadeId != null ? { propriedadeId } : {}) }, select: { produtoId: true, tipo: true, quantidade: true, valorTotal: true, data: true } });
  const saldoPorProduto = new Map<number, number>();
  for (const pid of produtoIds) {
    const doProduto: MovIn[] = movs.filter((m) => m.produtoId === pid).map((m) => ({ tipo: m.tipo, quantidade: Number(m.quantidade), valorTotal: Number(m.valorTotal), data: iso(m.data) }));
    saldoPorProduto.set(pid, saldoProduto(doProduto).saldo);
  }

  // Custo das saídas = custo médio ponderado das entradas no sítio do lote.
  const sitioLote = grupo.propriedadeId ?? (await propriedadePrincipalId());
  const custos = await obterBasesCusto(prisma, produtoIds, sitioLote);
  // Só baixa produto que tem estoque (alguma entrada/ajuste) no sítio do lote;
  // sem isso a linha aparece na prévia mas não gera SAIDA.
  const comEstoque = await produtosComEstoque(prisma, produtoIds, sitioLote);

  const linhas = itens.map((it, idx) => {
    const semEstoque = !comEstoque.has(it.produtoId);
    const quantidade = linhasBase[idx].quantidade;
    const { custoUnitario: custoDecimal, valorTotal } = semEstoque
      ? { custoUnitario: new Prisma.Decimal(0), valorTotal: new Prisma.Decimal(0) }
      : valorSaidaDaBase(quantidade, custos.get(it.produtoId));
    const custoUnitario = custoDecimal.toNumber();
    const custoTotal = valorTotal.toNumber();
    const saldoAtual = saldoPorProduto.get(it.produtoId) ?? 0;
    const saldoApos = semEstoque ? saldoAtual : Math.round((saldoAtual - quantidade) * 100) / 100;
    const produtoCentroIds = it.produto.centrosCusto.map((cc) => cc.centroCustoId);
    const centroCustoId = resolverCentroSaida({ produtoCentroIds, contextoCentroId: grupo.centroCustoId });
    return {
      produtoId: it.produtoId,
      produtoNome: it.produto.nome,
      unidade: it.unidade,
      qtdPorCabecaDia: Number(it.qtdPorCabecaDia),
      quantidade,
      custoUnitario,
      custoTotal,
      saldoAtual,
      saldoApos,
      insuficiente: !semEstoque && saldoApos < 0,
      semEstoque,
      centroCustoId,
    };
  });

  const custoTotal = Math.round(linhas.reduce((a, l) => a + l.custoTotal, 0) * 100) / 100;
  return {
    grupoId,
    grupoNome: grupo.nome,
    propriedadeId: grupo.propriedadeId, // sítio do lote → escopo das SAIDAs geradas
    dietaId: grupo.dieta.id,
    dietaNome: grupo.dieta.nome,
    dataInicio,
    dataFim,
    dias,
    numCabecas,
    linhas,
    custoTotal,
    temInsuficiencia: linhas.some((l) => l.insuficiente),
  };
}

// Preview (não grava): mostra "vai baixar X, custo R$ Y, saldo fica Z".
export async function previsaoConsumo(grupoId: number, dataInicio: string, dataFim: string, propriedadeId: number | null = null) {
  return resolverConsumo(grupoId, dataInicio, dataFim, propriedadeId);
}

// Fecha o consumo do período: grava as SAIDAs (origem NUTRICAO) e o cabeçalho.
// Idempotente por (lote, janela). Saldo insuficiente NÃO bloqueia (a vaca comeu)
// — a previsão já sinaliza o negativo ao usuário. Não gera Lançamento: o caixa
// já saiu na compra (ENTRADA).
export async function fecharConsumoPeriodo(grupoId: number, input: ConsumoInput, propriedadeId: number | null = null) {
  const prev = await resolverConsumo(grupoId, input.dataInicio, input.dataFim, propriedadeId);
  const dataMov = new Date(input.dataFim + "T00:00:00Z");
  const propriedadeMovimentoId = prev.propriedadeId ?? (await propriedadePrincipalId()); // escopo das SAIDAs

  await assertPeriodoAberto(propriedadeMovimentoId, dataMov);

  try {
    const periodo = await prisma.$transaction(async (tx) => {
      const cp = await tx.consumoPeriodo.create({
        data: {
          grupoId,
          dietaId: prev.dietaId,
          dataInicio: new Date(input.dataInicio + "T00:00:00Z"),
          dataFim: dataMov,
          numCabecas: prev.numCabecas,
          diasBase: prev.dias,
          custoTotal: 0,
          observacao: input.observacao,
        },
      });

      let custoTotal = new Prisma.Decimal(0);
      for (const l of prev.linhas) {
        if (l.quantidade <= 0 || l.semEstoque) continue; // 0 cabeças/dias ou produto sem estoque no sítio → nada a baixar
        // Valores já calculados na previsão pela base do custo médio (valorSaidaPreciso):
        // custoTotal tem 2 casas e custoUnitario 4 — reconverter de number é exato.
        // Não recalcular valor a partir do custoUnitario arredondado.
        const custoUnitario = new Prisma.Decimal(l.custoUnitario);
        const valorTotal = new Prisma.Decimal(l.custoTotal);
        custoTotal = custoTotal.plus(valorTotal);
        await tx.movimentoEstoque.create({
          data: {
            produtoId: l.produtoId,
            tipo: "SAIDA",
            origem: "NUTRICAO",
            data: dataMov,
            quantidade: l.quantidade,
            custoUnitario,
            valorTotal,
            grupoId,
            propriedadeId: propriedadeMovimentoId,
            consumoPeriodoId: cp.id,
            centroCustoId: l.centroCustoId,
            observacao: `Consumo dieta ${prev.dietaNome} — ${input.dataInicio} a ${input.dataFim}`,
          },
        });
      }

      return tx.consumoPeriodo.update({ where: { id: cp.id }, data: { custoTotal } });
    });

    return { id: periodo.id, grupoId, dataInicio: input.dataInicio, dataFim: input.dataFim, numCabecas: prev.numCabecas, dias: prev.dias, custoTotal: Number(periodo.custoTotal), movimentos: prev.linhas.filter((l) => l.quantidade > 0 && !l.semEstoque).length, temInsuficiencia: prev.temInsuficiencia };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new NutricaoError("JA_FECHADO", "o consumo deste lote para este período já foi fechado");
    }
    throw e;
  }
}

// Estorna um período fechado: apaga as SAIDAs geradas (cascade) e o cabeçalho.
export async function reabrirConsumoPeriodo(id: number, propriedadeId: number | null = null) {
  const cp = await prisma.consumoPeriodo.findFirst({ where: { id, ...(propriedadeId != null ? { grupo: { propriedadeId } } : {}) }, include: { grupo: true } });
  if (!cp) throw new NutricaoError("NAO_ENCONTRADO", "fechamento de consumo não encontrado");
  await assertPeriodoAberto(cp.grupo.propriedadeId ?? await propriedadePrincipalId(), cp.dataFim);
  // onDelete: Cascade nas SAIDAs (consumoPeriodoId) apaga os movimentos junto.
  await prisma.consumoPeriodo.delete({ where: { id } });
}

// Fechamentos já feitos para um lote (para exibir e permitir estorno).
export async function listarConsumosPeriodo(grupoId: number, propriedadeId: number | null = null) {
  if (propriedadeId != null && !(await prisma.grupo.findFirst({ where: { id: grupoId, propriedadeId }, select: { id: true } }))) {
    throw new NutricaoError("NAO_ENCONTRADO", "lote não encontrado");
  }
  const periodos = await prisma.consumoPeriodo.findMany({ where: { grupoId, ...(propriedadeId != null ? { grupo: { propriedadeId } } : {}) }, orderBy: { dataFim: "desc" }, include: { _count: { select: { movimentos: true } } } });
  const fechados = await prisma.periodoFinanceiro.findMany({ where: { status: "FECHADO", ...(propriedadeId != null ? { propriedadeId } : {}) }, select: { ano: true, mes: true } });
  const mesFechado = (d: Date) => fechados.some((f) => f.ano === d.getUTCFullYear() && f.mes === d.getUTCMonth() + 1);
  return periodos.map((p) => ({
    id: p.id,
    dataInicio: iso(p.dataInicio),
    dataFim: iso(p.dataFim),
    numCabecas: p.numCabecas,
    diasBase: p.diasBase,
    custoTotal: Number(p.custoTotal),
    numMovimentos: p._count.movimentos,
    mesFechado: mesFechado(p.dataFim),
  }));
}
