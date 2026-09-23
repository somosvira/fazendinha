// Custo de sanidade por RATEIO: o gasto financeiro real de "Medicamento Animal"
// (Lancamento) é rateado pelas aplicações reais (EventoSanitario APLICACAO) por
// animal. Estimativa POR VOLUME — o Ideagri não tem custo por produto preenchido
// (PRODUTO.VRUNITARIOESTOQUE = NULL), então uma aplicação cara conta igual a uma barata.
import { prisma } from "../../db.js";
import { obterCustosMedios } from "../estoque/estoque.js";

export interface AnimalAplic {
  numero: string;
  nome: string | null;
  n: number;
}

export function iniciarAnimalAplic(numero: string, nome: string | null): AnimalAplic {
  return { numero, nome, n: 0 };
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

// ── Preço por aplicação = custo médio do produto no sítio ────────────────────
// Cruza por produtoId quando o evento tem vínculo com o estoque; eventos legados
// (só texto livre) caem no nome do produto. Uma query de nomes + uma de custos.
export async function precoPorAplicacao(
  aplics: { produtoId: number | null; produto: string | null }[],
  propriedadeId: number | null,
): Promise<(a: { produtoId: number | null; produto: string | null }) => number | null> {
  const nomesSemVinculo = [...new Set(aplics.filter((a) => a.produtoId == null && a.produto).map((a) => a.produto!))];
  const idPorNome = new Map<string, number>();
  if (nomesSemVinculo.length > 0) {
    for (const p of await prisma.produto.findMany({ where: { nome: { in: nomesSemVinculo } }, select: { id: true, nome: true }, orderBy: { id: "asc" } })) {
      if (!idPorNome.has(p.nome)) idPorNome.set(p.nome, p.id);
    }
  }
  const ids = [...aplics.flatMap((a) => (a.produtoId != null ? [a.produtoId] : [])), ...idPorNome.values()];
  const custos = await obterCustosMedios(prisma, ids, propriedadeId);
  return (a) => {
    const id = a.produtoId ?? (a.produto ? idPorNome.get(a.produto) : undefined);
    const custo = id != null ? custos.get(id) : undefined;
    return custo != null ? custo.toNumber() : null;
  };
}

// ── Service (junta financeiro real + consumo real) ───────────────────────────
const toNum = (x: any) => (x != null ? Number(x) : 0);

export async function agregarCustoSanidade(meses = 12, propriedadeId: number | null = null) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);

  // Gasto real "Medicamento Animal" (mesmos filtros de caixa do dashboard).
  const lancs = await prisma.transacaoFinanceira.findMany({
    where: {
      status: "CONFIRMADA",
      tipo: "PAGAMENTO",
      data: { gte: desde },
      operacao: { categoria: { nome: "Medicamento Animal" } },
      ...(propriedadeId != null ? { propriedadeId } : {}),
    },
    select: { valorTotal: true },
  });
  const totalMedicamento = Math.round(lancs.reduce((s, l) => s + toNum(l.valorTotal), 0) * 100) / 100;

  // Aplicações reais por animal + ranking de produtos (inclui VACINA — também é
  // consumo de produto veterinário; só o tipo na timeline difere).
  const aplics = await prisma.eventoSanitario.findMany({
    where: { tipo: { in: ["APLICACAO", "VACINA"] }, data: { gte: desde }, ...(propriedadeId != null ? { animal: { propriedadeId } } : {}) },
    select: { produto: true, produtoId: true, animal: { select: { numero: true, nome: true } } },
  });
  // Preço = custo médio ponderado das entradas no sítio da consulta (null sem base).
  const precoDe = await precoPorAplicacao(aplics, propriedadeId);
  const precos = new Map<string, number | null>();

  const porAnimalMap = new Map<string, AnimalAplic>();
  const porProduto = new Map<string, number>();
  const exatoPorAnimal = new Map<string, number>(); // soma do custo médio dos produtos com custo apurado
  for (const a of aplics) {
    const num = a.animal.numero;
    const cur = porAnimalMap.get(num) ?? iniciarAnimalAplic(num, a.animal.nome);
    cur.n++;
    porAnimalMap.set(num, cur);
    if (a.produto) {
      porProduto.set(a.produto, (porProduto.get(a.produto) ?? 0) + 1);
      const cu = precoDe(a);
      if (!precos.has(a.produto) || precos.get(a.produto) == null) precos.set(a.produto, cu);
      if (cu != null) exatoPorAnimal.set(num, (exatoPorAnimal.get(num) ?? 0) + cu);
    }
  }

  const rateio = ratearCustoSanidade(totalMedicamento, [...porAnimalMap.values()]);
  // Custo exato por animal (Fatia 26): soma dos produtos precificados que ele recebeu.
  const topAnimais = rateio.animais.slice(0, 10).map((a) => ({
    ...a,
    custoExato: Math.round((exatoPorAnimal.get(a.numero) ?? 0) * 100) / 100,
  }));

  // Custo EXATO por produto (Fatia 21): custo médio × nº aplicações.
  const produtos = [...porProduto.entries()]
    .map(([produto, n]) => {
      const cu = precos.get(produto) ?? null;
      return { produto, n, custoMedio: cu, custoExato: cu != null ? Math.round(cu * n * 100) / 100 : null };
    })
    .sort((a, b) => b.n - a.n);
  const custoExatoTotal = Math.round(produtos.reduce((s, p) => s + (p.custoExato ?? 0), 0) * 100) / 100;
  const produtosPrecificados = produtos.filter((p) => p.custoMedio != null).length;

  return {
    periodoMeses: meses,
    totalMedicamento,
    totalAplicacoes: rateio.totalAplicacoes,
    custoPorAplicacao: rateio.custoPorAplicacao,
    topAnimais,
    produtos: produtos.slice(0, 15),
    custoExatoTotal,
    produtosPrecificados,
    produtosTotais: produtos.length,
    nota:
      "Estimativa por volume: gasto real de Medicamento Animal ÷ nº de aplicações. " +
      "O custo exato usa o custo médio das compras de cada produto neste sítio — registre as compras para apurá-lo.",
  };
}
