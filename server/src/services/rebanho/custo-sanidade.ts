// Custo de sanidade por RATEIO: o gasto financeiro real de "Medicamento Animal"
// (Lancamento) é rateado pelas aplicações reais (EventoSanitario APLICACAO) por
// animal. Estimativa POR VOLUME — o Ideagri não tem custo por produto preenchido
// (PRODUTO.VRUNITARIOESTOQUE = NULL), então uma aplicação cara conta igual a uma barata.
import { prisma } from "../../db.js";

export interface AnimalAplic {
  numero: string;
  nome: string;
  n: number;
}

// ── Motor puro (TDD) ─────────────────────────────────────────────────────────
export function ratearCustoSanidade(totalMedicamento: number, porAnimal: AnimalAplic[]) {
  const totalAplicacoes = porAnimal.reduce((s, a) => s + a.n, 0);
  const custoPorAplicacao = totalAplicacoes > 0 ? Math.round((totalMedicamento / totalAplicacoes) * 100) / 100 : 0;
  const animais = porAnimal
    .map((a) => ({ ...a, custoEstimado: Math.round(a.n * custoPorAplicacao * 100) / 100 }))
    .sort((x, y) => y.custoEstimado - x.custoEstimado);
  return { totalAplicacoes, custoPorAplicacao, animais };
}

// ── Service (junta financeiro real + consumo real) ───────────────────────────
const toNum = (x: any) => (x != null ? Number(x) : 0);

export async function agregarCustoSanidade(meses = 12) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);

  // Gasto real "Medicamento Animal" (mesmos filtros de caixa do dashboard).
  const lancs = await prisma.lancamento.findMany({
    where: {
      situacao: "LIQUIDADO",
      natureza: "DEBITO",
      dataLiquidacao: { not: null, gte: desde },
      categoria: { nome: "Medicamento Animal" },
    },
    select: { valor: true },
  });
  const totalMedicamento = Math.round(lancs.reduce((s, l) => s + toNum(l.valor), 0) * 100) / 100;

  // Aplicações reais por animal + ranking de produtos.
  const aplics = await prisma.eventoSanitario.findMany({
    where: { tipo: "APLICACAO", data: { gte: desde } },
    select: { produto: true, animal: { select: { numero: true, nome: true } } },
  });
  const porAnimalMap = new Map<string, AnimalAplic>();
  const porProduto = new Map<string, number>();
  for (const a of aplics) {
    const num = a.animal.numero;
    const cur = porAnimalMap.get(num) ?? { numero: num, nome: a.animal.nome ?? num, n: 0 };
    cur.n++;
    porAnimalMap.set(num, cur);
    if (a.produto) porProduto.set(a.produto, (porProduto.get(a.produto) ?? 0) + 1);
  }

  const rateio = ratearCustoSanidade(totalMedicamento, [...porAnimalMap.values()]);
  const topProdutos = [...porProduto.entries()]
    .map(([produto, n]) => ({ produto, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  return {
    periodoMeses: meses,
    totalMedicamento,
    totalAplicacoes: rateio.totalAplicacoes,
    custoPorAplicacao: rateio.custoPorAplicacao,
    topAnimais: rateio.animais.slice(0, 10),
    topProdutos,
    nota:
      "Estimativa por volume: gasto real de Medicamento Animal ÷ nº de aplicações. " +
      "Não pondera custo por produto (o Ideagri não tem custo por produto preenchido).",
  };
}
