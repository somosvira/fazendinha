import { describe, expect, it } from "vitest";
import { proximaEtapa, resumoProgramacao } from "./iatf-lote.calc.js";
import type { EtapaProtocolo } from "./iatf.calc.js";

// Protocolo clássico D0/D7/D9/D11 (IATF 11 dias).
const ETAPAS: EtapaProtocolo[] = [
  { dia: 0, acao: "Implante P4 + BE", hormonio: "P4 + BE", ordem: 0 },
  { dia: 7, acao: "Retira implante + PGF", hormonio: "PGF2α", ordem: 0 },
  { dia: 9, acao: "Cipionato de estradiol", hormonio: "ECP", ordem: 0 },
  { dia: 11, acao: "IATF", hormonio: null, ordem: 0 },
];

describe("proximaEtapa", () => {
  const agenda = resumoProgramacao({ etapas: ETAPAS, dataInicio: "2026-07-06", hoje: "2026-07-06" }).agenda;

  it("no D0, a próxima etapa é o próprio D0 (data >= hoje)", () => {
    const p = proximaEtapa(agenda, "2026-07-06");
    expect(p?.rotulo).toBe("D0");
    expect(p?.data).toBe("2026-07-06");
  });

  it("no meio do protocolo, aponta a próxima etapa futura", () => {
    // 2026-07-08 (D2, sem etapa) → próxima é D7 (2026-07-13).
    const p = proximaEtapa(agenda, "2026-07-08");
    expect(p?.rotulo).toBe("D7");
    expect(p?.data).toBe("2026-07-13");
  });

  it("no dia exato de uma etapa, ela é a próxima (inclusivo)", () => {
    const p = proximaEtapa(agenda, "2026-07-13"); // = D7
    expect(p?.rotulo).toBe("D7");
  });

  it("depois da última etapa, não há próxima (protocolo terminado)", () => {
    expect(proximaEtapa(agenda, "2026-07-18")).toBeNull(); // D11 = 2026-07-17
  });
});

describe("resumoProgramacao", () => {
  it("deriva a agenda completa a partir do D0", () => {
    const r = resumoProgramacao({ etapas: ETAPAS, dataInicio: "2026-07-06", hoje: "2026-07-06" });
    expect(r.agenda.map((e) => e.data)).toEqual(["2026-07-06", "2026-07-13", "2026-07-15", "2026-07-17"]);
    expect(r.totalEtapas).toBe(4);
    expect(r.dataFim).toBe("2026-07-17");
  });

  it("no D0, nenhuma etapa foi concluída ainda", () => {
    const r = resumoProgramacao({ etapas: ETAPAS, dataInicio: "2026-07-06", hoje: "2026-07-06" });
    expect(r.etapasConcluidas).toBe(0);
    expect(r.proxima?.rotulo).toBe("D0");
    expect(r.concluido).toBe(false);
  });

  it("conta etapas já passadas (data < hoje) como concluídas", () => {
    // hoje = 2026-07-14: D0 (07-06) e D7 (07-13) já passaram; D9/D11 no futuro.
    const r = resumoProgramacao({ etapas: ETAPAS, dataInicio: "2026-07-06", hoje: "2026-07-14" });
    expect(r.etapasConcluidas).toBe(2);
    expect(r.proxima?.rotulo).toBe("D9");
    expect(r.concluido).toBe(false);
  });

  it("marca concluído quando hoje passou da última etapa", () => {
    const r = resumoProgramacao({ etapas: ETAPAS, dataInicio: "2026-07-06", hoje: "2026-07-20" });
    expect(r.etapasConcluidas).toBe(4);
    expect(r.proxima).toBeNull();
    expect(r.concluido).toBe(true);
  });

  it("ordena etapas fora de ordem antes de derivar", () => {
    const bagunca: EtapaProtocolo[] = [
      { dia: 11, acao: "IATF", hormonio: null, ordem: 0 },
      { dia: 0, acao: "Implante", hormonio: "P4", ordem: 0 },
    ];
    const r = resumoProgramacao({ etapas: bagunca, dataInicio: "2026-07-06", hoje: "2026-07-06" });
    expect(r.agenda.map((e) => e.rotulo)).toEqual(["D0", "D11"]);
  });
});
