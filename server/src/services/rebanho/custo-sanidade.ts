// Custo de sanidade por RATEIO: o gasto financeiro real com categorias de uso
// sanitário é rateado pelas aplicações reais (EventoSanitario APLICACAO) por
// animal. Estimativa POR VOLUME — o Ideagri não tem custo por produto preenchido
// (PRODUTO.VRUNITARIOESTOQUE = NULL), então uma aplicação cara conta igual a uma barata.
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { obterCustosMedios } from "../estoque/estoque.js";
import { incluirClassificacao, ratearTransacao } from "../financeiro/classificacao.js";

// Ids das categorias marcadas como "uso sanitário" (comportamento é da
// categoria, mesmo que ela esteja inativa — situação é do produto/uso é dela).
export async function resolverIdsCategoriasSanitarias(): Promise<number[]> {
  return (await prisma.categoria.findMany({ where: { usoSanitario: true }, select: { id: true } })).map((c) => c.id);
}

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

// Resolve o id do produto de cada aplicação (vínculo direto ou, no legado, por
// nome) e o custo médio ponderado de cada um no sítio. Base comum para o preço
// de referência (por produto) e para o custo real por aplicação, abaixo.
async function resolverCustosMediosDeAplicacoes(
  aplics: { produtoId: number | null; produto: string | null }[],
  propriedadeId: number | null,
) {
  const nomesSemVinculo = [...new Set(aplics.filter((a) => a.produtoId == null && a.produto).map((a) => a.produto!))];
  const idPorNome = new Map<string, number>();
  if (nomesSemVinculo.length > 0) {
    for (const p of await prisma.produto.findMany({ where: { nome: { in: nomesSemVinculo } }, select: { id: true, nome: true }, orderBy: { id: "asc" } })) {
      if (!idPorNome.has(p.nome)) idPorNome.set(p.nome, p.id);
    }
  }
  const ids = [...aplics.flatMap((a) => (a.produtoId != null ? [a.produtoId] : [])), ...idPorNome.values()];
  const custos = await obterCustosMedios(prisma, ids, propriedadeId);
  const idDe = (a: { produtoId: number | null; produto: string | null }) => a.produtoId ?? (a.produto ? idPorNome.get(a.produto) : undefined);
  return { idDe, custos };
}

export interface AplicacaoCusteavel {
  produtoId: number | null;
  produto: string | null;
  quantidadeUsada?: Prisma.Decimal | number | string | null;
  movimentoEstoqueId?: number | null;
}

// Monta as duas funções de precificação numa passada só (uma query de nomes +
// uma de custos médios + uma de movimentos), evitando repetir as buscas quando
// o chamador precisa das duas (agregarCustoSanidade usa ambas).
async function criarMotorDeCusto(aplics: AplicacaoCusteavel[], propriedadeId: number | null) {
  const movIds = [...new Set(aplics.flatMap((a) => (a.movimentoEstoqueId != null ? [a.movimentoEstoqueId] : [])))];
  const movimentos = movIds.length > 0
    ? await prisma.movimentoEstoque.findMany({ where: { id: { in: movIds }, status: "CONFIRMADO" }, select: { id: true, valorTotal: true } })
    : [];
  const valorPorMovimento = new Map(movimentos.map((m) => [m.id, m.valorTotal.toNumber()]));
  const { idDe, custos } = await resolverCustosMediosDeAplicacoes(aplics, propriedadeId);

  // Custo médio (preço unitário) do produto de uma aplicação — cruza por
  // produtoId quando o evento tem vínculo com o estoque; eventos legados (só
  // texto livre) caem no nome do produto. Referência de preço (exibição), não
  // é o custo da aplicação em si — ver custoRealDe para isso.
  const custoMedioDe = (a: { produtoId: number | null; produto: string | null }) => {
    const id = idDe(a);
    const custo = id != null ? custos.get(id) : undefined;
    return custo != null ? custo.toNumber() : null;
  };

  // Custo REAL de cada aplicação. Precedência: (a) valor do MovimentoEstoque
  // CONFIRMADO que baixou o consumo — já valorizado no momento da aplicação, a
  // fonte mais confiável (se o movimento foi estornado, a aplicação não teve
  // custo efetivo: null, não cai no rateio como se fosse "sem base"; ela só não
  // soma nada de exato); (b) sem movimento mas com produtoId + quantidadeUsada
  // → quantidade × custo médio atual do produto no sítio; (c) evento legado só
  // com texto (sem produtoId/quantidade) → sem base de custo, null — a Fatia
  // cai no rateio por volume.
  const custoRealDe = (a: AplicacaoCusteavel) => {
    if (a.movimentoEstoqueId != null) {
      const valor = valorPorMovimento.get(a.movimentoEstoqueId);
      return valor != null ? valor : null;
    }
    if (a.produtoId != null && a.quantidadeUsada != null) {
      const custoMedio = custos.get(a.produtoId);
      if (custoMedio == null) return null;
      const qtd = a.quantidadeUsada instanceof Prisma.Decimal ? a.quantidadeUsada.toNumber() : Number(a.quantidadeUsada);
      return Math.round(custoMedio.toNumber() * qtd * 100) / 100;
    }
    return null;
  };

  return { custoMedioDe, custoRealDe };
}

export async function custoMedioPorAplicacao(
  aplics: { produtoId: number | null; produto: string | null }[],
  propriedadeId: number | null,
): Promise<(a: { produtoId: number | null; produto: string | null }) => number | null> {
  return (await criarMotorDeCusto(aplics, propriedadeId)).custoMedioDe;
}

export async function precoPorAplicacao(
  aplics: AplicacaoCusteavel[],
  propriedadeId: number | null,
): Promise<(a: AplicacaoCusteavel) => number | null> {
  return (await criarMotorDeCusto(aplics, propriedadeId)).custoRealDe;
}

// ── Service (junta financeiro real + consumo real) ───────────────────────────
const toNum = (x: any) => (x != null ? Number(x) : 0);

export async function agregarCustoSanidade(meses = 12, propriedadeId: number | null = null) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);

  // Gasto real com categorias de uso sanitário (mesmos filtros de caixa do
  // dashboard). Pré-filtro Prisma: operação ou algum item na categoria; o
  // rateio abaixo fica só com as partes cuja categoria é sanitária.
  const idsSanitario = await resolverIdsCategoriasSanitarias();
  const lancs = idsSanitario.length === 0 ? [] : await prisma.transacaoFinanceira.findMany({
    where: {
      status: "CONFIRMADA",
      tipo: "PAGAMENTO",
      data: { gte: desde },
      operacao: { OR: [{ categoriaId: { in: idsSanitario } }, { itens: { some: { categoriaId: { in: idsSanitario } } } }] },
      ...(propriedadeId != null ? { propriedadeId } : {}),
    },
    select: { id: true, valorTotal: true, operacao: { include: incluirClassificacao } },
  });
  const totalMedicamento = Math.round(lancs.reduce((s, l) =>
    s + ratearTransacao(l.operacao, l.id, l.valorTotal)
      .filter((p) => p.categoriaId != null && idsSanitario.includes(p.categoriaId))
      .reduce((ss, p) => ss + p.valor.toNumber(), 0), 0) * 100) / 100;

  // Aplicações reais por animal + ranking de produtos (inclui VACINA — também é
  // consumo de produto veterinário; só o tipo na timeline difere).
  const aplics = await prisma.eventoSanitario.findMany({
    where: { tipo: { in: ["APLICACAO", "VACINA"] }, data: { gte: desde }, ...(propriedadeId != null ? { animal: { propriedadeId } } : {}) },
    select: { produto: true, produtoId: true, quantidadeUsada: true, movimentoEstoqueId: true, animal: { select: { numero: true, nome: true } } },
  });
  // Custo médio = preço de referência por produto (exibição). Custo real = o
  // que a aplicação de fato consumiu (movimento de estoque ou quantidade ×
  // custo médio) — os dois podem divergir por aplicação, por isso são calculados
  // à parte (ver criarMotorDeCusto acima).
  const { custoMedioDe, custoRealDe } = await criarMotorDeCusto(aplics, propriedadeId);
  const custosMediosPorProduto = new Map<string, number | null>();

  const porAnimalMap = new Map<string, AnimalAplic>();
  const porProduto = new Map<string, number>();
  const exatoPorAnimal = new Map<string, number>(); // soma do custo real das aplicações com custo apurado
  const exatoPorProduto = new Map<string, number>(); // soma do custo real das aplicações daquele produto
  for (const a of aplics) {
    const num = a.animal.numero;
    const cur = porAnimalMap.get(num) ?? iniciarAnimalAplic(num, a.animal.nome);
    cur.n++;
    porAnimalMap.set(num, cur);
    if (a.produto) {
      porProduto.set(a.produto, (porProduto.get(a.produto) ?? 0) + 1);
      if (!custosMediosPorProduto.has(a.produto) || custosMediosPorProduto.get(a.produto) == null) {
        custosMediosPorProduto.set(a.produto, custoMedioDe(a));
      }
      const custoReal = custoRealDe(a);
      if (custoReal != null) {
        exatoPorAnimal.set(num, (exatoPorAnimal.get(num) ?? 0) + custoReal);
        exatoPorProduto.set(a.produto, (exatoPorProduto.get(a.produto) ?? 0) + custoReal);
      }
    }
  }

  const rateio = ratearCustoSanidade(totalMedicamento, [...porAnimalMap.values()]);
  // Custo exato por animal (Fatia 26): soma do custo real das aplicações que ele recebeu.
  const topAnimais = rateio.animais.slice(0, 10).map((a) => ({
    ...a,
    custoExato: Math.round((exatoPorAnimal.get(a.numero) ?? 0) * 100) / 100,
  }));

  // Custo EXATO por produto (Fatia 21): soma do custo real de cada aplicação do produto.
  const produtos = [...porProduto.entries()]
    .map(([produto, n]) => {
      const exato = exatoPorProduto.get(produto);
      return {
        produto,
        n,
        custoMedio: custosMediosPorProduto.get(produto) ?? null,
        custoExato: exato != null ? Math.round(exato * 100) / 100 : null,
      };
    })
    .sort((a, b) => b.n - a.n);
  const custoExatoTotal = Math.round(produtos.reduce((s, p) => s + (p.custoExato ?? 0), 0) * 100) / 100;
  const produtosPrecificados = produtos.filter((p) => p.custoExato != null).length;

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
      "Estimativa por volume: gasto real das categorias de uso sanitário ÷ nº de aplicações. " +
      "O custo exato usa o valor do movimento de estoque da aplicação ou, sem ele, a quantidade aplicada × custo médio do produto neste sítio.",
  };
}
