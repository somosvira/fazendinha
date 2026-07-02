import { prisma } from "../../db.js";
import { quebrarPorCategoria } from "../rebanho/custo-producao.js";

// ── Ponte financeira do café (espelha rebanho/custo-producao) ────────────────
// O café da Rio Novo está em FORMAÇÃO: a maior parte do gasto cai em
// "Plantio Café - investimento" (formação da lavoura) e só uma fração é custeio
// recorrente. O custo/saca real só fecha quando a safra fecha; aqui damos a
// estimativa honesta sobre o que já foi liquidado e o que já foi colhido.
//
// Centros de custo do café no banco (ver seed):
//   - "Plantio Café"                  → custeio
//   - "Plantio Café - investimento"   → investimento (formação)
//   - "Atividade Plantio"             → custeio (mão de obra/insumos genéricos)
const CENTROS_CAFE = ["Plantio Café", "Plantio Café - investimento", "Atividade Plantio"] as const;
const ehInvestimento = (centro: string) => /investimento/i.test(centro);

const toNum = (x: any) => (x != null ? Number(x) : 0);

// Toggle Custeio / Investimento / Tudo (spec §6.4) — seleciona qual total vira
// o "headline" (`custoTotal`) da resposta. NÃO muda como o split em si é
// calculado (heurística por nome do centro de custo, ver nota do módulo
// acima) — apenas expõe/soma os totais que já existiam. custoSaca/custoHa
// continuam SEMPRE sobre custeio (§2/§5.1), independente da classe pedida.
export type ClasseCusto = "custeio" | "investimento" | "tudo";

export async function agregarCustoPlantio(meses = 12, classe: ClasseCusto = "custeio") {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);

  // 1a) Resolve os centros de custo do café por nome, case-insensitive — o seed
  //     grava "Plantio Café - Investimento" (I maiúsculo) enquanto CENTROS_CAFE
  //     lista a variante minúscula; um `in` exato deixaria o investimento de fora.
  const centrosCafe = await prisma.centroCusto.findMany({
    where: { OR: CENTROS_CAFE.map((nome) => ({ nome: { equals: nome, mode: "insensitive" as const } })) },
    select: { id: true },
  });
  const centroCafeIds = centrosCafe.map((c) => c.id);

  // 1b) Lançamentos reais de café (mesmos filtros do dashboard financeiro:
  //     LIQUIDADO, estornado=false, DEBITO, dataLiquidacao recente).
  const lancs = await prisma.lancamento.findMany({
    where: {
      situacao: "LIQUIDADO",
      estornado: false,
      natureza: "DEBITO",
      dataLiquidacao: { not: null, gte: desde },
      centroCustoId: { in: centroCafeIds },
    },
    select: {
      valor: true,
      categoria: { select: { nome: true } },
      centroCusto: { select: { nome: true } },
    },
  });

  // 2) Split custeio (centro SEM "investimento") vs investimento (formação).
  const custeio = lancs.filter((l) => !ehInvestimento(l.centroCusto.nome));
  const investimento = lancs.filter((l) => ehInvestimento(l.centroCusto.nome));
  const custeioTotal = Math.round(custeio.reduce((s, l) => s + toNum(l.valor), 0) * 100) / 100;
  const investimentoTotal = Math.round(investimento.reduce((s, l) => s + toNum(l.valor), 0) * 100) / 100;

  // 3) Breakdown do custeio por categoria (motor puro reusado do rebanho).
  const quebra = quebrarPorCategoria(custeio.map((l) => ({ categoria: l.categoria.nome, valor: toNum(l.valor) })));

  // 4) Sacas colhidas no período — produção real das passadas de colheita.
  const passadas = await prisma.passadaColheita.findMany({
    where: { data: { gte: desde } },
    select: { sacasBeneficiadas: true },
  });
  const sacasPeriodo = Math.round(passadas.reduce((s, p) => s + toNum(p.sacasBeneficiadas), 0) * 100) / 100;

  // 5) Área produtiva — talhões ATIVOS (em produção). Formação/baixado fora.
  const talhoesAtivos = await prisma.talhao.findMany({ where: { estado: "ATIVO" }, select: { areaHa: true } });
  const areaProducao = Math.round(talhoesAtivos.reduce((s, t) => s + toNum(t.areaHa), 0) * 100) / 100;

  // 6) Custo/saca e custo/ha sobre o CUSTEIO (não o investimento de formação) —
  //    sempre, independente da `classe` pedida (§2/§5.1).
  const custoSaca = sacasPeriodo > 0 ? Math.round((custeioTotal / sacasPeriodo) * 100) / 100 : null;
  const custoHa = areaProducao > 0 ? Math.round((custeioTotal / areaProducao) * 100) / 100 : null;

  // 7) Headline `custoTotal` — apenas SELECIONA entre os totais já calculados
  //    acima conforme a `classe` pedida (default "custeio", contrato §6.4).
  //    Não recalcula nem altera o split; "tudo" só soma os dois totais.
  const custoTotal =
    classe === "investimento" ? investimentoTotal : classe === "tudo" ? Math.round((custeioTotal + investimentoTotal) * 100) / 100 : custeioTotal;

  return {
    periodoMeses: meses,
    classe,
    custoTotal,
    custeioTotal,
    investimentoTotal,
    sacasPeriodo,
    areaProducao,
    custoSaca,
    custoHa,
    breakdown: quebra.linhas,
    nota:
      "Café em formação: a maior parte do gasto é investimento (formação da lavoura), " +
      "produção apenas começando. Custo/saca = custeio do café ÷ sacas colhidas no período; " +
      "quando a safra fechar, recalcula sobre o realizado.",
  };
}
