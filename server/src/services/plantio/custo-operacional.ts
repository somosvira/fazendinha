/* Custo OPERACIONAL do café (Fase 1c do custo-safra) — ADITIVO ao custo
 * financeiro existente (services/plantio/custo.ts). NÃO mexe nos números
 * financeiros: essa é uma leitura paralela, direto das OPERAÇÕES reais da
 * safra (Ideagri: TarefaAgricola + ApontamentoMaquina), sem passar pelo
 * financeiro (Lancamento/CentroCusto).
 *
 * Convenção anti-duplicação (spec §4.1):
 *   custeioOperacional(safra) = Σ TarefaAgricola.custoReal + Σ ApontamentoMaquina.valorTotal
 * Tarefas carregam insumo+serviço; apontamentos carregam recurso próprio
 * (hora-máquina/hora-homem) não embutido numa tarefa. Não somar a mesma
 * despesa nas duas.
 *
 * custo/unidade sempre sobre CUSTEIO (spec §2, §5.1) — não há investimento
 * na v1 operacional do café (isso continua vindo do financeiro).
 *
 * Núcleo PURO (calcularCustoOperacionalCafe) sem DB — testável. Wrapper
 * (agregarCustoOperacionalCafe) carrega do Prisma e monta o DTO com `nota`
 * de transparência, espelhando services/corte/custo.ts.
 */
import { prisma } from "../../db.js";

const round2 = (n: number) => Math.round(n * 100) / 100;
const toNum = (x: any) => (x != null ? Number(x) : 0);

// ── Núcleo PURO ──────────────────────────────────────────────────────────────

export interface TarefaCustoOperacional {
  custoReal: number;
}

export interface ApontamentoCustoOperacional {
  valorTotal: number;
}

export interface CustoOperacionalCafeInput {
  tarefas: TarefaCustoOperacional[];
  apontamentos: ApontamentoCustoOperacional[];
  sacas: number;
  areaHa: number;
}

export interface CustoOperacionalCafe {
  custeioTotal: number;
  custoSaca: number | null;
  custoHa: number | null;
}

/**
 * Núcleo PURO — deriva o custeio operacional do café das tarefas e
 * apontamentos da safra.
 *   custeioTotal = Σ tarefas.custoReal + Σ apontamentos.valorTotal
 *   custoSaca    = custeioTotal ÷ sacas   (null se sacas <= 0, nunca NaN)
 *   custoHa      = custeioTotal ÷ areaHa  (null se areaHa <= 0, nunca NaN)
 */
export function calcularCustoOperacionalCafe(
  input: CustoOperacionalCafeInput
): CustoOperacionalCafe {
  const totalTarefas = input.tarefas.reduce((s, t) => s + t.custoReal, 0);
  const totalApontamentos = input.apontamentos.reduce((s, a) => s + a.valorTotal, 0);
  const custeioTotal = round2(totalTarefas + totalApontamentos);

  const custoSaca = input.sacas > 0 ? round2(custeioTotal / input.sacas) : null;
  const custoHa = input.areaHa > 0 ? round2(custeioTotal / input.areaHa) : null;

  return { custeioTotal, custoSaca, custoHa };
}

// ── Wrapper com DB ───────────────────────────────────────────────────────────

export interface CustoOperacionalCafeDTO extends CustoOperacionalCafe {
  safraId: number;
  sacas: number;
  areaHa: number;
  nota: string;
}

export class CustoOperacionalCafeError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) {
    super(message);
    this.name = "CustoOperacionalCafeError";
  }
}

/**
 * Wrapper — carrega a Safra (Ideagri), suas TarefaAgricola/ApontamentoMaquina,
 * as sacas beneficiadas (PassadaColheita) na janela [dataInicio, dataFim ??
 * agora] da safra, e a área dos talhões ATIVOS. Chama o núcleo puro e monta
 * o DTO com nota de transparência.
 */
export async function agregarCustoOperacionalCafe(safraId: number): Promise<CustoOperacionalCafeDTO> {
  const safra = await prisma.safra.findUnique({
    where: { id: safraId },
    select: { id: true, dataInicio: true, dataFim: true },
  });
  if (!safra) throw new CustoOperacionalCafeError("NAO_ENCONTRADO", "safra não encontrada");

  const [tarefas, apontamentos] = await Promise.all([
    prisma.tarefaAgricola.findMany({
      where: { safraId },
      select: { custoReal: true },
    }),
    prisma.apontamentoMaquina.findMany({
      where: { safraId },
      select: { valorTotal: true },
    }),
  ]);

  // Sacas beneficiadas na janela da safra. PassadaColheita não referencia o
  // modelo Safra (Ideagri) — liga-se a SafraTalhao (café-fenológico), um
  // modelo diferente. Por isso a ponte aqui é por DATA: passadas cuja `data`
  // cai dentro de [dataInicio, dataFim ?? agora] da Safra.
  const fimJanela = safra.dataFim ?? new Date();
  const passadas = await prisma.passadaColheita.findMany({
    where: { data: { gte: safra.dataInicio, lte: fimJanela } },
    select: { sacasBeneficiadas: true },
  });
  const sacas = round2(passadas.reduce((s, p) => s + toNum(p.sacasBeneficiadas), 0));

  // Área — talhões ATIVOS (em produção), mesma convenção do custo financeiro.
  const talhoesAtivos = await prisma.talhao.findMany({
    where: { estado: "ATIVO" },
    select: { areaHa: true },
  });
  const areaHa = round2(talhoesAtivos.reduce((s, t) => s + toNum(t.areaHa), 0));

  const resultado = calcularCustoOperacionalCafe({
    tarefas: tarefas.map((t) => ({ custoReal: toNum(t.custoReal) })),
    apontamentos: apontamentos.map((a) => ({ valorTotal: toNum(a.valorTotal) })),
    sacas,
    areaHa,
  });

  const nota =
    "Custo OPERACIONAL do café (aditivo ao custo financeiro) — vem das operações " +
    "reais da safra: Σ custo realizado das tarefas agrícolas (adubo, defensivo, mão " +
    "de obra por tarefa) + Σ valor dos apontamentos de hora-máquina/hora-homem não " +
    "embutidos numa tarefa. Sacas = colheita beneficiada no período da safra; " +
    "área = talhões ATIVOS (em produção). Custo/saca e custo/ha são sempre sobre o " +
    "custeio operacional (não há investimento nesta leitura — investimento continua " +
    "vindo do custo financeiro, GET /plantio/custo).";

  return { safraId, ...resultado, sacas, areaHa, nota };
}
