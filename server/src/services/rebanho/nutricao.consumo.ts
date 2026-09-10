import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";
import { saldoProduto, type MovIn } from "./estoque.calc.js";
import { consumoEsperado, diasNoPeriodo } from "./nutricao.consumo.calc.js";
import { NutricaoError } from "./nutricao.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { consumoPeriodoSchema, type ConsumoPeriodoInput } from "@fazendinha/shared";

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function assertPeriodoAberto(propriedadeId: number, data: Date) {
  const periodo = await prisma.periodoFinanceiro.findUnique({ where: { propriedadeId_ano_mes: { propriedadeId, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } } });
  if (periodo?.status === "FECHADO") throw new NutricaoError("MES_FECHADO", "mês financeiro fechado");
}

// Janela de fechamento de consumo: lote + intervalo de datas.
export const consumoSchema = consumoPeriodoSchema;
export type ConsumoInput = ConsumoPeriodoInput;

// Carrega lote + dieta + composição, resolve cabeças/dias e devolve as linhas de
// consumo já casadas com saldo atual. Base comum de previsão e fechamento.
async function resolverConsumo(grupoId: number, dataInicio: string, dataFim: string, propriedadeId: number | null = null) {
  const grupo = await prisma.grupo.findFirst({
    where: { id: grupoId, ...(propriedadeId != null ? { propriedadeId } : {}) },
    include: { dieta: { include: { itens: { include: { produto: true }, orderBy: { ordem: "asc" } } } } },
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
  const saldoPorProduto = new Map<string, number>();
  for (const pid of produtoIds) {
    const doProduto: MovIn[] = movs.filter((m) => m.produtoId === pid).map((m) => ({ tipo: m.tipo, quantidade: Number(m.quantidade), valorTotal: Number(m.valorTotal), data: iso(m.data) }));
    saldoPorProduto.set(pid, saldoProduto(doProduto).saldo);
  }

  const linhas = itens.map((it, idx) => {
    const quantidade = linhasBase[idx].quantidade;
    const custoUnitario = it.produto.custoUnitario != null ? Number(it.produto.custoUnitario) : 0;
    const custoTotal = Math.round(quantidade * custoUnitario * 100) / 100;
    const saldoAtual = saldoPorProduto.get(it.produtoId) ?? 0;
    const saldoApos = Math.round((saldoAtual - quantidade) * 100) / 100;
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
      insuficiente: saldoApos < 0,
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
          id: input.id,
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
      for (const [indice, l] of prev.linhas.entries()) {
        if (l.quantidade <= 0) continue; // 0 cabeças/dias → nada a baixar
        const valorTotal = new Prisma.Decimal(l.quantidade).mul(l.custoUnitario).toDecimalPlaces(2);
        custoTotal = custoTotal.plus(valorTotal);
        await tx.movimentoEstoque.create({
          data: {
            id: input.movimentoIds?.[indice],
            produtoId: l.produtoId,
            tipo: "SAIDA",
            origem: "NUTRICAO",
            data: dataMov,
            ordem: indice,
            quantidade: l.quantidade,
            custoUnitario: l.custoUnitario,
            valorTotal,
            grupoId,
            propriedadeId: propriedadeMovimentoId,
            consumoPeriodoId: cp.id,
            observacao: `Consumo dieta ${prev.dietaNome} — ${input.dataInicio} a ${input.dataFim}`,
          },
        });
      }

      return tx.consumoPeriodo.update({ where: { id: cp.id }, data: { custoTotal } });
    });

    return { id: periodo.id, grupoId, dataInicio: input.dataInicio, dataFim: input.dataFim, numCabecas: prev.numCabecas, dias: prev.dias, custoTotal: Number(periodo.custoTotal), movimentos: prev.linhas.filter((l) => l.quantidade > 0).length, temInsuficiencia: prev.temInsuficiencia };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new NutricaoError("JA_FECHADO", "o consumo deste lote para este período já foi fechado");
    }
    throw e;
  }
}

// Estorna um período fechado: apaga as SAIDAs geradas (cascade) e o cabeçalho.
export async function reabrirConsumoPeriodo(id: string, propriedadeId: number | null = null) {
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
  const periodos = await prisma.consumoPeriodo.findMany({ where: { grupoId, ...(propriedadeId != null ? { grupo: { propriedadeId } } : {}) }, orderBy: [{ dataFim: "desc" }, { criadoEm: "desc" }], include: { _count: { select: { movimentos: true } } } });
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
