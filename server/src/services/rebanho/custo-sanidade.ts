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

  // Aplicações reais por animal + ranking de produtos (inclui VACINA — também é
  // consumo de produto veterinário; só o tipo na timeline difere).
  const aplics = await prisma.eventoSanitario.findMany({
    where: { tipo: { in: ["APLICACAO", "VACINA"] }, data: { gte: desde } },
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

  // Custo EXATO por produto (Fatia 21): custoUnitario do Produto (Cadastros) × nº aplicações.
  // Null quando o produto não tem preço — o usuário precifica no Cadastros.
  const precos = new Map<string, number | null>();
  for (const p of await prisma.produto.findMany({ select: { nome: true, custoUnitario: true } })) {
    precos.set(p.nome, p.custoUnitario != null ? Number(p.custoUnitario) : null);
  }
  const produtos = [...porProduto.entries()]
    .map(([produto, n]) => {
      const cu = precos.get(produto) ?? null;
      return { produto, n, custoUnitario: cu, custoExato: cu != null ? Math.round(cu * n * 100) / 100 : null };
    })
    .sort((a, b) => b.n - a.n);
  const custoExatoTotal = Math.round(produtos.reduce((s, p) => s + (p.custoExato ?? 0), 0) * 100) / 100;
  const produtosPrecificados = produtos.filter((p) => p.custoUnitario != null).length;

  return {
    periodoMeses: meses,
    totalMedicamento,
    totalAplicacoes: rateio.totalAplicacoes,
    custoPorAplicacao: rateio.custoPorAplicacao,
    topAnimais: rateio.animais.slice(0, 10),
    produtos: produtos.slice(0, 15),
    custoExatoTotal,
    produtosPrecificados,
    produtosTotais: produtos.length,
    nota:
      "Estimativa por volume: gasto real de Medicamento Animal ÷ nº de aplicações. " +
      "Para o custo exato, precifique os produtos no Cadastros (custo unitário por aplicação).",
  };
}
