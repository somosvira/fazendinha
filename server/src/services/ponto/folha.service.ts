/* Serviço de folha (com DB) — carrega os funcionários ativos e seus registros
 * do mês, roda o motor puro (apurarFuncionario) e agrega os totais da fazenda. */
import { prisma } from "../../db.js";
import { apurarFuncionario, type FolhaLinhaDTO, type RegistroInput } from "./folha.js";

export interface FolhaDTO {
  mes: string; // YYYY-MM
  linhas: FolhaLinhaDTO[];
  totais: {
    salarios: number;
    valorExtra: number;
    totalPagar: number;
    totalHoras: number;
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** "YYYY-MM" → [primeiro dia, primeiro dia do mês seguinte). Datas UTC. */
function janelaMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, m] = mes.split("-").map(Number);
  return { inicio: new Date(Date.UTC(ano, m - 1, 1)), fim: new Date(Date.UTC(ano, m, 1)) };
}

export async function apurarFolha(mes: string): Promise<FolhaDTO> {
  const { inicio, fim } = janelaMes(mes);
  const funcionarios = await prisma.funcionario.findMany({
    where: { ativo: true },
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

  const totais = linhas.reduce(
    (acc, l) => ({
      salarios: acc.salarios + l.salarioMensal,
      valorExtra: acc.valorExtra + l.valorExtra,
      totalPagar: acc.totalPagar + l.totalPagar,
      totalHoras: acc.totalHoras + l.totalHoras,
    }),
    { salarios: 0, valorExtra: 0, totalPagar: 0, totalHoras: 0 }
  );

  return {
    mes,
    linhas,
    totais: {
      salarios: round2(totais.salarios),
      valorExtra: round2(totais.valorExtra),
      totalPagar: round2(totais.totalPagar),
      totalHoras: round2(totais.totalHoras),
    },
  };
}
