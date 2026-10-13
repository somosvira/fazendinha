import { describe, expect, it } from "vitest";
import { calendarioIatf, contadoresCiclo, situacaoReprodutiva } from "./regras.calc.js";
const dia = (n: number) => new Date(`2026-10-${String(n).padStart(2, "0")}T00:00:00Z`);

describe("evidências reprodutivas e calendário", () => {
  it("usa o início efetivo individual, com intervalo do protocolo em dias ou horas", () => {
    const etapas = [
      { nome: "Inseminação", tipo: "TENTATIVA" as const, intervalo: 11, unidade: "DIAS" as const },
      { nome: "Avaliação", tipo: "AVALIACAO" as const, intervalo: 48, unidade: "HORAS" as const },
    ];
    expect(calendarioIatf(dia(1), etapas).map((e) => e.previstaEm)).toEqual([dia(12), dia(3)]);
    expect(calendarioIatf(dia(3), etapas).map((e) => e.previstaEm)).toEqual([dia(14), dia(5)]);
  });
  it("aborto e natimorto válidos reiniciam tentativas, sem contar parto histórico duas vezes", () => {
    const partos = [
      { data: dia(2), status: "VALIDO", incluidoSaldoAnterior: true },
      { data: dia(8), status: "VALIDO", incluidoSaldoAnterior: false },
      { data: dia(10), status: "ANULADO", incluidoSaldoAnterior: false },
    ];
    const tentativas = [1, 5, 9, 11].map((n) => ({ data: dia(n), status: "VALIDO" }));
    expect(contadoresCiclo(2, partos, tentativas, dia(10))).toEqual({ partos: 3, tentativasCiclo: 1 });
    expect(contadoresCiclo(2, partos, tentativas, dia(7))).toEqual({ partos: 2, tentativasCiclo: 1 });
  });
  it("parto ou perda encerra o estado gestante; nova tentativa aguarda diagnóstico", () => {
    const gestacao = { confirmadaEm: dia(1), encerradaEm: dia(8), status: "VALIDO" };
    const ultimaAvaliacao = { data: dia(5), resultado: "RECONFIRMACAO" };
    expect(situacaoReprodutiva({ gestacao, ultimaAvaliacao })).toBe("VAZIA");
    expect(situacaoReprodutiva({ ultimaAvaliacao, ultimoParto: { data: dia(8) } })).toBe("VAZIA");
    expect(situacaoReprodutiva({ gestacao, ultimaAvaliacao, ultimaTentativa: { data: dia(10) } })).toBe("AGUARDANDO_DIAGNOSTICO");
  });
  it("situação inicial posterior não apaga uma gestação operacional aberta", () => {
    expect(situacaoReprodutiva({ gestacao: { confirmadaEm: dia(1), encerradaEm: null, status: "VALIDO" }, inicial: { data: dia(10), situacao: "APTA" } })).toBe("GESTANTE");
  });
  it("aguardar, não avaliado e inconclusivo preservam a última evidência, sem inventar resultado", () => {
    expect(situacaoReprodutiva({ avaliacoes: [{ data: dia(1), resultado: "NEGATIVO" }, { data: dia(5), resultado: "INCONCLUSIVO" }] })).toBe("VAZIA");
    expect(situacaoReprodutiva({ avaliacoes: [{ data: dia(5), resultado: "NAO_AVALIADO" }] })).toBe("DESCONHECIDA");
    expect(situacaoReprodutiva({ inicial: { data: dia(10), situacao: "DESCONHECIDA" }, ultimaAvaliacao: { data: dia(1), resultado: "NEGATIVO" } })).toBe("DESCONHECIDA");
  });
});
