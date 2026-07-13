import { describe, it, expect } from "vitest";
import { agregarDashboardPonto } from "./dashboard.agg.js";
import type { FolhaDTO } from "./folha.service.js";
import type { CustoMOSetor } from "./custoMOSetor.js";

const linha = (over: Partial<FolhaDTO["linhas"][number]> = {}): FolhaDTO["linhas"][number] => ({
  funcionarioId: "1",
  nome: "F",
  cargo: null,
  salarioMensal: 2000,
  valorHora: 10,
  diasTrabalhados: 20,
  totalHoras: 160,
  horasNormais: 160,
  extra50: 0,
  extra100: 0,
  valorExtra: 0,
  totalPagar: 2000,
  ...over,
});

const folha = (linhas: FolhaDTO["linhas"], totais?: Partial<FolhaDTO["totais"]>): FolhaDTO => ({
  mes: "2026-05",
  linhas,
  totais: { salarios: 0, valorExtra: 0, totalPagar: 0, totalHoras: 0, ...totais },
});

describe("agregarDashboardPonto", () => {
  it("compõe KPIs de quadro, custo e folha", () => {
    const custoSetores: CustoMOSetor[] = [
      { setor: "Curral", totalMensal: 8000, qtd: 4 },
      { setor: "Geral", totalMensal: 3000, qtd: 2 },
    ];
    const d = agregarDashboardPonto({
      mes: "2026-05",
      funcionariosAtivos: 6,
      custoSetores,
      folha: folha([linha()], { salarios: 12000, valorExtra: 500, totalPagar: 12500, totalHoras: 1000 }),
    });
    expect(d.k.mes).toBe("2026-05");
    expect(d.k.funcionariosAtivos).toBe(6);
    expect(d.k.setores).toBe(2);
    expect(d.k.custoMOMes).toBe(11000);
    expect(d.k.folhaTotalPagar).toBe(12500);
    expect(d.k.maiorSetor).toEqual({ nome: "Curral", total: 8000, qtd: 4 });
  });

  it("alerta 'sem ponto' conta linhas com diasTrabalhados 0", () => {
    const d = agregarDashboardPonto({
      mes: "2026-05",
      funcionariosAtivos: 2,
      custoSetores: [],
      folha: folha([linha({ diasTrabalhados: 0 }), linha({ diasTrabalhados: 22 })]),
    });
    const al = d.alertas.find((a) => a.tab === "eqp-ponto")!;
    expect(al.n).toBe(1);
  });

  it("alerta 'horas extras' conta linhas com extra50+extra100 > 0", () => {
    const d = agregarDashboardPonto({
      mes: "2026-05",
      funcionariosAtivos: 3,
      custoSetores: [],
      folha: folha([linha({ extra50: 5 }), linha({ extra100: 2 }), linha()]),
    });
    const al = d.alertas.find((a) => a.tab === "eqp-folha")!;
    expect(al.n).toBe(2);
  });

  it("maiorSetor é null sem setores", () => {
    const d = agregarDashboardPonto({ mes: "2026-05", funcionariosAtivos: 0, custoSetores: [], folha: folha([]) });
    expect(d.k.maiorSetor).toBeNull();
  });
});
