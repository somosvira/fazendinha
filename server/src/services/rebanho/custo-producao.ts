import { prisma } from "../../db.js";
import { calcularCustoVacaDia } from "./estoque.js";

// ── Motor puro (TDD) ────────────────────────────────────────────────────────
// Quebra o custeio do leite por componente: soma por categoria, ordena desc e
// calcula a participação (%) sobre o total. Testável sem Prisma.

export interface ItemCusto {
  categoria: string;
  valor: number;
}
export interface QuebraCusto {
  total: number;
  linhas: { categoria: string; valor: number; pct: number }[];
}

export function quebrarPorCategoria(itens: ItemCusto[]): QuebraCusto {
  const por = new Map<string, number>();
  for (const i of itens) por.set(i.categoria, (por.get(i.categoria) ?? 0) + i.valor);
  const total = Math.round([...por.values()].reduce((a, b) => a + b, 0) * 100) / 100;
  const linhas = [...por.entries()]
    .map(([categoria, valor]) => ({
      categoria,
      valor: Math.round(valor * 100) / 100,
      pct: total > 0 ? Math.round((valor / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
  return { total, linhas };
}

// ── Service (agrega Lancamento real) ────────────────────────────────────────
const toNum = (x: any) => (x != null ? Number(x) : 0);

export async function agregarCustoProducao(meses = 12) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - meses);

  // Custeio do leite (real): mesmos filtros do buildDashboard (LIQUIDADO,
  // estornado=false, dataLiquidacao recente) + DEBITO + CCusto "Atividade Leiteira".
  const lancs = await prisma.lancamento.findMany({
    where: {
      situacao: "LIQUIDADO",
      estornado: false,
      natureza: "DEBITO",
      dataLiquidacao: { not: null, gte: desde },
      centroCusto: { nome: "Atividade Leiteira" },
    },
    select: { valor: true, categoria: { select: { nome: true } } },
  });
  const quebra = quebrarPorCategoria(lancs.map((l) => ({ categoria: l.categoria.nome, valor: toNum(l.valor) })));

  // Custo vaca/dia (real): reusa o motor do Estoque (consumo de insumo ÷ vacas×dias).
  const cvd = await calcularCustoVacaDia(30); // { custoVacaDia, vacasEmLactacao, totalConsumo }

  // Litros estimados do período — produção média/dia das vacas em lactação × dias.
  // Com o rebanho real importado (Ideagri), isto já é a escala da fazenda inteira,
  // então alimenta o custo/litro de verdade (é uma estimativa: produção atual × dias).
  const dias = meses * 30;
  const animais = await prisma.animal.findMany({
    where: { status: "ATIVO", resumo: { del: { not: null } } },
    include: { resumo: true },
  });
  const litrosDia = animais.reduce((s, a) => s + toNum(a.resumo?.producaoMediaDia), 0);
  const litrosPeriodoEstimado = Math.round(litrosDia * dias);

  const custoLitro =
    litrosPeriodoEstimado > 0 ? Math.round((quebra.total / litrosPeriodoEstimado) * 100) / 100 : null;

  return {
    periodoMeses: meses,
    custeioLeiteTotal: quebra.total,
    breakdown: quebra.linhas,
    custoVacaDia: cvd.custoVacaDia,
    vacasEmLactacao: cvd.vacasEmLactacao,
    litrosPeriodoEstimado,
    litrosDia: Math.round(litrosDia * 10) / 10,
    custoLitro,
    nota:
      "Estimativa: custeio do leite (Atividade Leiteira) ÷ litros produzidos no período " +
      "(produção atual das vacas em lactação × dias). Refina conforme entram novos controles leiteiros.",
  };
}
