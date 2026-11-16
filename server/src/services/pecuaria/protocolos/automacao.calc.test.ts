import { describe, it, expect } from "vitest";
import { instanteProgramado, validarDataAutomacao } from "./automacao.calc.js";
import { momentosDasAcoes, snapshotMomento } from "./momentos.js";
describe("automação: tempo e política explícita", () => {
  it("converte hora padrão sem depender do timezone do servidor", () => {
    expect(instanteProgramado("2026-11-03", "08:30", "America/Sao_Paulo").toISOString()).toBe("2026-11-03T11:30:00.000Z");
    expect(instanteProgramado("2026-11-03", "08:30", "America/Manaus").toISOString()).toBe("2026-11-03T12:30:00.000Z");
  });
  it("recusa horário ambíguo ou inexistente por horário de verão", () => {
    expect(() => instanteProgramado("2026-11-01", "01:30", "America/New_York")).toThrow(/ambíguo/);
    expect(() => instanteProgramado("2026-03-08", "02:30", "America/New_York")).toThrow(/inexistente/);
  });
  it("recusa data retroativa e não executa no instante da ativação", () => {
    const agora = new Date("2026-11-03T11:30Z");
    expect(() => validarDataAutomacao(agora, agora)).toThrow(/retroativo/);
    expect(() => validarDataAutomacao(new Date(agora.getTime() + 1), agora)).not.toThrow();
  });
  it("AUTOMATIZADA legado permanece confirmação obrigatória", () => {
    const momento = momentosDasAcoes([{ momento: { nome: "D0", ordem: 1, modoAtendimento: "AUTOMATIZADA" } }])[0];
    expect(momento.politicaExecucao).toBe("CONFIRMACAO_OBRIGATORIA");
    expect(snapshotMomento({ id: "m", nome: "D0", ordem: 1, modoAtendimento: "AUTOMATIZADA" })?.politicaExecucao).toBe("CONFIRMACAO_OBRIGATORIA");
  });
  it("política automática exige horário e fuso explícitos", () => {
    expect(() => momentosDasAcoes([{ momento: { nome: "D0", ordem: 1, politicaExecucao: "AUTOMATICA_EXCECAO" } }])).toThrow(/horário/);
  });
});
