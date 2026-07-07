/* Serviço de folha (com DB) — carrega os funcionários ativos e seus registros
 * do mês, roda o motor puro (apurarFuncionario) e agrega os totais da fazenda. */
import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { apurarFuncionario, round2, type FolhaLinhaDTO, type RegistroInput } from "./folha.js";

export interface FolhaTotais {
  salarios: number;
  valorExtra: number;
  totalPagar: number;
  totalHoras: number;
}

export interface FolhaDTO {
  mes: string; // YYYY-MM
  linhas: FolhaLinhaDTO[];
  totais: FolhaTotais;
}

/** "YYYY-MM" → [primeiro dia, primeiro dia do mês seguinte). Datas UTC. */
function janelaMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, m] = mes.split("-").map(Number);
  return { inicio: new Date(Date.UTC(ano, m - 1, 1)), fim: new Date(Date.UTC(ano, m, 1)) };
}

/**
 * Soma pura das linhas da folha usando Prisma.Decimal — evita drift de ponto
 * flutuante que aparece ao acumular `number` com casas fracionárias (ex.: 0.1 + 0.2).
 * O arredondamento final passa pelo mesmo `round2` do motor puro (Decimal.toFixed).
 */
export function agregarTotais(linhas: FolhaLinhaDTO[]): FolhaTotais {
  const D = Prisma.Decimal;
  const acc = linhas.reduce(
    (a, l) => ({
      salarios: a.salarios.add(l.salarioMensal),
      valorExtra: a.valorExtra.add(l.valorExtra),
      totalPagar: a.totalPagar.add(l.totalPagar),
      totalHoras: a.totalHoras.add(l.totalHoras),
    }),
    { salarios: new D(0), valorExtra: new D(0), totalPagar: new D(0), totalHoras: new D(0) }
  );
  return {
    salarios: round2(acc.salarios),
    valorExtra: round2(acc.valorExtra),
    totalPagar: round2(acc.totalPagar),
    totalHoras: round2(acc.totalHoras),
  };
}

export async function apurarFolha(mes: string, propriedadeId?: number | null): Promise<FolhaDTO> {
  const { inicio, fim } = janelaMes(mes);
  const funcionarios = await prisma.funcionario.findMany({
    where: { ativo: true, ...(propriedadeId != null ? { propriedadeId } : {}) }, // escopo do sítio
    orderBy: { nome: "asc" },
    include: { registros: { where: { data: { gte: inicio, lt: fim } } } },
  });

  const linhas: FolhaLinhaDTO[] = funcionarios.map((f) => {
    const registros: RegistroInput[] = f.registros.map((r) => ({
      entrada: r.entrada,
      saida: r.saida,
      intervaloMin: r.intervaloMin,
      tipoDia: r.tipoDia,
    }));
    return apurarFuncionario(
      {
        id: String(f.id),
        nome: f.nome,
        cargo: f.cargo ?? null,
        salarioMensal: Number(f.salarioMensal),
        cargaMensalHoras: Number(f.cargaMensalHoras),
        jornadaDiariaHoras: Number(f.jornadaDiariaHoras),
      },
      registros
    );
  });

  return { mes, linhas, totais: agregarTotais(linhas) };
}
