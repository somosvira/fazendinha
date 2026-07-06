/* Testes da função PURA de pré-preenchimento da grade (montarGradePadrao) e do
 * classificador de dia (tipoDiaPorDataPadrao). Não tocam no Prisma — só lógica
 * de calendário + horário padrão. Espelha o estilo de folha.test.ts. */
import { describe, it, expect } from "vitest";
import {
  montarGradePadrao,
  tipoDiaPorDataPadrao,
  type HorarioPadraoFuncionario,
} from "./pontos.js";
import type { TipoDiaPonto } from "@prisma/client";

const comPadrao = (over: Partial<HorarioPadraoFuncionario> = {}): HorarioPadraoFuncionario => ({
  horaEntradaPadrao: "07:00",
  horaSaidaPadrao: "17:00",
  intervaloPadraoMin: 60,
  ...over,
});

// Stub determinístico: só os dias 1..3 do mês são úteis; o resto "pula".
const soPrimeiros3: (d: string) => TipoDiaPonto = (data) =>
  Number(data.split("-")[2]) <= 3 ? "UTIL" : "FOLGA";

const dow = (s: string): number => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

describe("tipoDiaPorDataPadrao", () => {
  it("domingo → DOMINGO, sábado → FOLGA, dia de semana → UTIL", () => {
    expect(tipoDiaPorDataPadrao("2026-08-02")).toBe("DOMINGO"); // domingo
    expect(tipoDiaPorDataPadrao("2026-08-01")).toBe("FOLGA"); // sábado
    expect(tipoDiaPorDataPadrao("2026-08-03")).toBe("UTIL"); // segunda
    expect(tipoDiaPorDataPadrao("2026-08-07")).toBe("UTIL"); // sexta
  });
});

describe("montarGradePadrao — dias úteis preenchidos", () => {
  it("preenche os dias úteis com o horário padrão (entrada/saída/intervalo)", () => {
    const grade = montarGradePadrao(comPadrao(), 2026, 3, soPrimeiros3);
    expect(grade).toHaveLength(3);
    expect(grade.map((g) => g.data)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
    for (const g of grade) {
      expect(g).toMatchObject({ entrada: "07:00", saida: "17:00", intervaloMin: 60, tipoDia: "UTIL" });
    }
  });

  it("com o classificador real, só seg–sex entram (fim de semana fica de fora)", () => {
    const grade = montarGradePadrao(comPadrao(), 2026, 8, tipoDiaPorDataPadrao);
    expect(grade).toHaveLength(21); // agosto/2026 tem 21 dias de semana
    // nenhum sábado (6) nem domingo (0) na grade padrão
    expect(grade.every((g) => dow(g.data) >= 1 && dow(g.data) <= 5)).toBe(true);
    expect(grade.some((g) => g.data === "2026-08-01")).toBe(false); // sábado
    expect(grade.some((g) => g.data === "2026-08-02")).toBe(false); // domingo
    expect(grade.some((g) => g.data === "2026-08-03")).toBe(true); // segunda
  });

  it("intervalo padrão null → cai no fallback de 60 min", () => {
    const grade = montarGradePadrao(comPadrao({ intervaloPadraoMin: null }), 2026, 3, soPrimeiros3);
    expect(grade.every((g) => g.intervaloMin === 60)).toBe(true);
  });

  it("intervalo padrão 0 é respeitado (não vira 60 pelo ?? fallback)", () => {
    const grade = montarGradePadrao(comPadrao({ intervaloPadraoMin: 0 }), 2026, 3, soPrimeiros3);
    expect(grade.every((g) => g.intervaloMin === 0)).toBe(true);
  });
});

describe("montarGradePadrao — idempotência (dia já existente não duplica)", () => {
  it("pula as datas que já têm registro", () => {
    const grade = montarGradePadrao(comPadrao(), 2026, 3, soPrimeiros3, ["2026-03-02"]);
    expect(grade.map((g) => g.data)).toEqual(["2026-03-01", "2026-03-03"]);
    expect(grade.some((g) => g.data === "2026-03-02")).toBe(false);
  });

  it("todas as datas úteis já existentes → grade vazia (nada a criar)", () => {
    const grade = montarGradePadrao(comPadrao(), 2026, 3, soPrimeiros3, [
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
    expect(grade).toEqual([]);
  });
});

describe("montarGradePadrao — funcionário sem padrão → nada", () => {
  it("sem hora de entrada → []", () => {
    expect(montarGradePadrao(comPadrao({ horaEntradaPadrao: null }), 2026, 3, soPrimeiros3)).toEqual([]);
  });

  it("sem hora de saída → []", () => {
    expect(montarGradePadrao(comPadrao({ horaSaidaPadrao: null }), 2026, 3, soPrimeiros3)).toEqual([]);
  });

  it("ambos null → [] mesmo com intervalo definido", () => {
    const semPadrao = comPadrao({ horaEntradaPadrao: null, horaSaidaPadrao: null, intervaloPadraoMin: 30 });
    expect(montarGradePadrao(semPadrao, 2026, 3, soPrimeiros3)).toEqual([]);
  });
});
