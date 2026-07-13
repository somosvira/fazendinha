/* Agregação PURA do dashboard da Equipe & Ponto — compõe a contagem de
 * funcionários ativos + o custo de MO por setor + os totais da folha do mês
 * num triplo { k, dominios, alertas }. Sem Prisma: recebe os agregados já
 * prontos (o loader dashboard.ts carrega e converte). `tab` usa o prefixo eqp-*. */
import type { CustoMOSetor } from "./custoMOSetor.js";
import type { FolhaDTO } from "./folha.service.js";

export interface DashboardPontoDTO {
  k: {
    mes: string;
    funcionariosAtivos: number;
    setores: number;
    custoMOMes: number;
    folhaTotalPagar: number;
    valorExtra: number;
    totalHoras: number;
    maiorSetor: { nome: string; total: number; qtd: number } | null;
  };
  dominios: { tab: string; titulo: string; linhas: string[] }[];
  alertas: { label: string; n: number; tom?: "up" | "bad"; tab: string }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const brMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function agregarDashboardPonto(input: {
  mes: string;
  funcionariosAtivos: number;
  custoSetores: CustoMOSetor[];
  folha: FolhaDTO;
}): DashboardPontoDTO {
  const { mes, funcionariosAtivos, custoSetores, folha } = input;

  const custoMOMes = custoSetores.reduce((a, s) => a + s.totalMensal, 0);
  const maior = custoSetores[0]
    ? { nome: custoSetores[0].setor, total: custoSetores[0].totalMensal, qtd: custoSetores[0].qtd }
    : null;

  const semPonto = folha.linhas.filter((l) => l.diasTrabalhados === 0).length;
  const comExtra = folha.linhas.filter((l) => l.extra50 + l.extra100 > 0).length;

  return {
    k: {
      mes,
      funcionariosAtivos,
      setores: custoSetores.length,
      custoMOMes: round2(custoMOMes),
      folhaTotalPagar: folha.totais.totalPagar,
      valorExtra: folha.totais.valorExtra,
      totalHoras: folha.totais.totalHoras,
      maiorSetor: maior,
    },
    dominios: [
      {
        tab: "eqp-funcionarios",
        titulo: "Funcionários",
        linhas: [
          `${funcionariosAtivos} funcionários ativos`,
          `${custoSetores.length} setores`,
          maior ? `Maior: ${maior.nome} (${maior.qtd})` : "Sem setores cadastrados",
        ],
      },
      {
        tab: "eqp-ponto",
        titulo: "Ponto",
        linhas: [`${folha.linhas.length} em apuração no mês`, `${semPonto} sem ponto lançado`],
      },
      {
        tab: "eqp-folha",
        titulo: "Folha",
        linhas: [
          `Total a pagar ${brMoney(folha.totais.totalPagar)}`,
          `Hora extra ${brMoney(folha.totais.valorExtra)} · ${round2(folha.totais.totalHoras)} h`,
        ],
      },
    ],
    alertas: [
      { label: "Sem ponto lançado no mês", n: semPonto, tom: "bad", tab: "eqp-ponto" },
      { label: "Com horas extras", n: comExtra, tom: "up", tab: "eqp-folha" },
    ],
  };
}
