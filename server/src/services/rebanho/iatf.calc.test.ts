import { describe, it, expect } from "vitest";
import {
  agendarEtapas, ordenarEtapas, etapasComStatus, progressoExecucao,
  type EtapaProtocolo, type EtapaAgendada,
} from "./iatf.calc.js";

// Protocolo IATF clássico de 11 dias (D0/D7/D9/D11): implante + benzoato,
// retirada + PGF, ECP/GnRH, IATF. `dia` é o offset em dias a partir de D0.
const P11: EtapaProtocolo[] = [
  { dia: 0, acao: "Implante de progesterona + benzoato de estradiol", hormonio: "P4 + BE", ordem: 1 },
  { dia: 7, acao: "Retirada do implante + prostaglandina", hormonio: "PGF2α", ordem: 2 },
  { dia: 9, acao: "Cipionato de estradiol", hormonio: "ECP", ordem: 3 },
  { dia: 11, acao: "Inseminação artificial em tempo fixo", hormonio: null, ordem: 4 },
];

describe("agendarEtapas", () => {
  it("soma o offset `dia` à data de início (D0 = a própria data de início)", () => {
    const r = agendarEtapas(P11, "2026-07-19");
    expect(r.map((e) => e.data)).toEqual(["2026-07-19", "2026-07-26", "2026-07-28", "2026-07-30"]);
  });

  it("preserva ação/hormônio/ordem e adiciona o rótulo D<n> de cada etapa", () => {
    const r = agendarEtapas(P11, "2026-07-19");
    expect(r[0]).toMatchObject<Partial<EtapaAgendada>>({ dia: 0, rotulo: "D0", data: "2026-07-19", acao: P11[0].acao, hormonio: "P4 + BE", ordem: 1 });
    expect(r[3]).toMatchObject<Partial<EtapaAgendada>>({ dia: 11, rotulo: "D11", hormonio: null });
  });

  it("atravessa fronteira de mês corretamente", () => {
    const r = agendarEtapas([{ dia: 0, acao: "a", hormonio: null, ordem: 1 }, { dia: 11, acao: "b", hormonio: null, ordem: 2 }], "2026-07-25");
    expect(r.map((e) => e.data)).toEqual(["2026-07-25", "2026-08-05"]);
  });

  it("atravessa fronteira de ano (dez→jan)", () => {
    const r = agendarEtapas([{ dia: 0, acao: "a", hormonio: null, ordem: 1 }, { dia: 9, acao: "b", hormonio: null, ordem: 2 }], "2026-12-28");
    expect(r.map((e) => e.data)).toEqual(["2026-12-28", "2027-01-06"]);
  });

  it("ordena as etapas por `dia` antes de agendar (entrada fora de ordem)", () => {
    const r = agendarEtapas([{ dia: 11, acao: "IATF", hormonio: null, ordem: 4 }, { dia: 0, acao: "implante", hormonio: null, ordem: 1 }], "2026-07-19");
    expect(r.map((e) => e.dia)).toEqual([0, 11]);
    expect(r.map((e) => e.data)).toEqual(["2026-07-19", "2026-07-30"]);
  });

  it("lista vazia → agenda vazia", () => {
    expect(agendarEtapas([], "2026-07-19")).toEqual([]);
  });
});

describe("ordenarEtapas", () => {
  it("desempata por `ordem` quando o `dia` é igual (duas ações no mesmo dia)", () => {
    const etapas: EtapaProtocolo[] = [
      { dia: 0, acao: "segunda", hormonio: null, ordem: 2 },
      { dia: 0, acao: "primeira", hormonio: null, ordem: 1 },
    ];
    expect(ordenarEtapas(etapas).map((e) => e.acao)).toEqual(["primeira", "segunda"]);
  });
});

describe("etapasComStatus + progressoExecucao", () => {
  const HOJE = "2026-07-25";
  const etapas = [
    { dia: 0, acao: "D0", hormonio: null, ordem: 1 },
    { dia: 7, acao: "D7", hormonio: null, ordem: 2 },
    { dia: 11, acao: "D11", hormonio: null, ordem: 3 },
  ];
  const ex = (
    dia: number, ordem: number, status: "PENDENTE" | "CONCLUIDA" | "PULADA",
    dataPlanejada: string, dataExecucao: string | null = null, id = dia,
  ) => ({ id, dia, acao: "x", hormonio: null, ordem, dataPlanejada, status, dataExecucao });

  it("cruza agenda com execuções e marca atraso em pendentes vencidas", () => {
    const r = etapasComStatus(etapas, "2026-07-19", [
      ex(0, 1, "CONCLUIDA", "2026-07-19", "2026-07-19"),
      ex(7, 2, "PENDENTE", "2026-07-26"),
      ex(11, 3, "PENDENTE", "2026-07-30"),
    ], HOJE);
    expect(r[0].status).toBe("CONCLUIDA");
    expect(r[0].atrasada).toBe(false);
    expect(r[1].status).toBe("PENDENTE");
    expect(r[1].atrasada).toBe(false); // D7 = 26/jul > 25/jul
    // se hoje for depois de D7:
    const r2 = etapasComStatus(etapas, "2026-07-19", [
      ex(0, 1, "CONCLUIDA", "2026-07-19", "2026-07-19"),
      ex(7, 2, "PENDENTE", "2026-07-26"),
    ], "2026-07-28");
    expect(r2[1].atrasada).toBe(true);
  });

  it("progresso usa status real, não só a data", () => {
    const sts = etapasComStatus(etapas, "2026-07-19", [
      ex(0, 1, "CONCLUIDA", "2026-07-19", "2026-07-19"),
      ex(7, 2, "PULADA", "2026-07-26", "2026-07-26"),
      ex(11, 3, "PENDENTE", "2026-07-30"),
    ], HOJE);
    const p = progressoExecucao(sts);
    expect(p).toMatchObject({ total: 3, resolvidas: 2, concluidas: 1, puladas: 1, pendentes: 1, concluido: false });
    expect(p.proxima?.rotulo).toBe("D11");
  });
});
