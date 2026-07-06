/* Custo de mão de obra agregado por SETOR operacional.
 *
 * Só entram funcionários ATIVOS; `setor` livre/opcional (sem setor → "Geral"),
 * espelhando Animal.setor. É o salário-base mensal somado por setor — um número
 * disponível para a gestão ("25 funcionários, 10 do curral"). NÃO amarra ainda
 * com os custos de rebanho/plantio/corte (cada módulo tem custo próprio); a
 * amarração fica como débito para uma fase futura.
 *
 * `agregarCustoMOPorSetor` é pura (testável sem Prisma). O loader
 * `custoMOPorSetor` carrega os ativos e converte Decimal→number na borda.
 */
import { prisma } from "../../db.js";

export interface FuncionarioCustoMO {
  setor?: string | null;
  salarioMensal: number; // já em number (Decimal convertido na borda)
  ativo: boolean;
}

export interface CustoMOSetor {
  setor: string; // "Geral" quando o funcionário não tem setor
  totalMensal: number; // soma dos salários mensais dos ativos do setor
  qtd: number; // nº de funcionários ativos no setor
}

const SEM_SETOR = "Geral";

/** Agrega custo de MO por setor (só ativos; sem setor → "Geral"; ordena por total desc). */
export function agregarCustoMOPorSetor(funcionarios: FuncionarioCustoMO[]): CustoMOSetor[] {
  const mapa = new Map<string, { totalMensal: number; qtd: number }>();
  for (const f of funcionarios) {
    if (!f.ativo) continue;
    const setor = f.setor?.trim() || SEM_SETOR;
    const cur = mapa.get(setor) ?? { totalMensal: 0, qtd: 0 };
    cur.totalMensal += f.salarioMensal;
    cur.qtd += 1;
    mapa.set(setor, cur);
  }
  return [...mapa.entries()]
    .map(([setor, v]) => ({ setor, totalMensal: v.totalMensal, qtd: v.qtd }))
    .sort((a, b) => b.totalMensal - a.totalMensal);
}

/** Carrega os funcionários ativos e devolve o custo de MO agregado por setor. */
export async function custoMOPorSetor(): Promise<CustoMOSetor[]> {
  const rows = await prisma.funcionario.findMany({
    where: { ativo: true },
    select: { setor: true, salarioMensal: true, ativo: true },
  });
  return agregarCustoMOPorSetor(
    rows.map((r) => ({ setor: r.setor, salarioMensal: Number(r.salarioMensal), ativo: r.ativo }))
  );
}
