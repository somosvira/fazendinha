import { describe, expect, it } from "vitest";
import { elegivelProgramacao, janelaPublicavel } from "./elegibilidade.calc.js";
const p = { id: "p", meses: [1,2,12], ano: null, vigenciaInicio: null, vigenciaFim: null, precisao: "MES", dia: null, recorrencia: "JANELA_ELEGIBILIDADE", antecedenciaDias: 3, ativadoEm: new Date("2030-01-01Z") };
describe("publicação explícita da programação", () => {
  it("avalia mês do ano separadamente dos meses de vida", () => {
    const animal = { sexo: "F", dataNascimento: new Date("2030-01-31Z") };
    expect(elegivelProgramacao({ idadeMinimaMeses: 1 }, animal, new Date("2030-02-28Z"))).toBe(false);
    expect(elegivelProgramacao({ idadeMinimaMeses: 1 }, animal, new Date("2030-03-01Z"))).toBe(true);
    expect(elegivelProgramacao({ criterioPendente: "Conferir gestação" }, animal, new Date("2030-03-01Z"))).toBe(false);
  });
  it("atravessa o ano pela antecedência sem gerar episódios passados", () => {
    expect(janelaPublicavel({ ...p, meses: [1] }, new Date("2030-12-29Z"))).toMatchObject([{ ano: 2031, mes: 1, situacao: "PROXIMO" }]);
    expect(janelaPublicavel({ ...p, meses: [1] }, new Date("2030-03-01Z"))).toEqual([]);
  });
  it("adoção tardia gera conferência, nunca atraso", () => {
    expect(janelaPublicavel({ ...p, ativadoEm: new Date("2030-02-10Z") }, new Date("2030-02-10Z"))).toMatchObject([{ mes: 2, situacao: "CONFERENCIA_INICIAL", dia: null }]);
  });
});
