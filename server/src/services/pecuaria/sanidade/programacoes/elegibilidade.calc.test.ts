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
  it("conserva a ocorrência única diária passada para conferência após ativação tardia", () => {
    expect(janelaPublicavel({ ...p, meses: [10], ano: 2029, precisao: "DIA", dia: 5, recorrencia: "SEM_REPETICAO", ativadoEm: new Date("2030-10-10Z") }, new Date("2030-10-10Z")))
      .toMatchObject([{ ano: 2029, mes: 10, dia: 5, inicioJanela: "2029-10-05", fimJanela: "2029-10-05", periodo: "UNICA", situacao: "CONFERENCIA_INICIAL" }]);
  });
  it("recupera só a última edição diária perdida depois da ativação, sem backfill de campanhas", () => {
    const programa = { ...p, meses: [1, 2, 3], precisao: "DIA", dia: 5, recorrencia: "CAMPANHA_ANUAL", ativadoEm: new Date("2030-01-01Z") };
    expect(janelaPublicavel(programa, new Date("2030-03-06Z"))).toMatchObject([{ ano: 2030, mes: 3, inicioJanela: "2030-03-05", periodo: "CAMPANHA:2030-03", situacao: "CONFERENCIA_INICIAL" }]);
    expect(janelaPublicavel({ ...programa, ativadoEm: new Date("2030-03-06Z") }, new Date("2030-03-06Z"))).toEqual([]);
  });
  it("recupera 31 de dezembro no ano seguinte sem fabricar campanha anterior à adoção", () => {
    const programa = { ...p, meses: [12], precisao: "DIA", dia: 31, recorrencia: "CAMPANHA_ANUAL", ativadoEm: new Date("2030-01-01Z") };
    expect(janelaPublicavel(programa, new Date("2031-01-01Z"))).toMatchObject([{ ano: 2030, mes: 12, dia: 31, situacao: "CONFERENCIA_INICIAL" }]);
    expect(janelaPublicavel({ ...programa, ativadoEm: new Date("2031-01-01Z") }, new Date("2031-01-01Z"))).toEqual([]);
  });
  it("mantém janelas mensais sem dia e a identidade única da elegibilidade no catch-up diário", () => {
    expect(janelaPublicavel({ ...p, meses: [2], precisao: "MES", dia: null }, new Date("2030-02-06Z")))
      .toMatchObject([{ mes: 2, dia: null, precisao: "MES", periodo: "ELEGIBILIDADE" }]);
    expect(janelaPublicavel({ ...p, meses: [2], precisao: "DIA", dia: 5 }, new Date("2030-02-06Z")))
      .toMatchObject([{ mes: 2, periodo: "ELEGIBILIDADE", situacao: "CONFERENCIA_INICIAL" }]);
  });
});
