import { describe, expect, it } from "vitest";
import { janelaProgramacao, chaveNecessidadeProgramacao, type CalendarioProgramacao } from "./calendario.calc.js";
const base: CalendarioProgramacao = { id: "p", meses: [1,2,12], ano: null, vigenciaInicio: null, vigenciaFim: null, precisao: "MES", dia: null, recorrencia: "JANELA_ELEGIBILIDADE" };
describe("programação de calendário", () => {
  it("mantém mês sem inventar dia e distingue ano consultado de ano cadastrado", () => {
    expect(janelaProgramacao(base, 2032, 2)).toMatchObject({ dia: null, inicioJanela: "2032-02-01", fimJanela: "2032-02-29", precisao: "MES" });
    expect(base.ano).toBeNull(); expect(janelaProgramacao(base, 2032, 3)).toBeNull();
  });
  it("preserva a necessidade de elegibilidade entre meses e anos", () => {
    const a = janelaProgramacao(base, 2031, 12)!; const b = janelaProgramacao(base, 2032, 1)!;
    expect(chaveNecessidadeProgramacao("p", a.periodo, "ANIMAL", "a")).toBe(chaveNecessidadeProgramacao("p", b.periodo, "ANIMAL", "a"));
    expect(a.id).not.toBe(b.id);
  });
  it("campanhas de edições distintas são necessidades distintas", () => {
    const p = { ...base, recorrencia: "CAMPANHA_ANUAL" };
    expect(janelaProgramacao(p, 2031, 1)!.periodo).not.toBe(janelaProgramacao(p, 2032, 1)!.periodo);
    expect(janelaProgramacao(p, 2032, 1)!.periodo).not.toBe(janelaProgramacao(p, 2032, 2)!.periodo);
  });
  it("não normaliza dia inválido para outro mês", () => {
    expect(janelaProgramacao({ ...base, precisao: "DIA", dia: 29 }, 2031, 2)).toBeNull();
    expect(janelaProgramacao({ ...base, precisao: "DIA", dia: 29 }, 2032, 2)?.dia).toBe(29);
  });
  it("respeita ano e recorta vigência sem alterar precisão", () => {
    const p = { ...base, ano: 2032, vigenciaInicio: new Date("2032-02-10T00:00:00Z"), vigenciaFim: new Date("2032-02-20T00:00:00Z") };
    expect(janelaProgramacao(p, 2031, 2)).toBeNull(); expect(janelaProgramacao(p, 2032, 1)).toBeNull();
    expect(janelaProgramacao(p, 2032, 2)).toMatchObject({ inicioJanela: "2032-02-10", fimJanela: "2032-02-20", dia: null });
  });
});
