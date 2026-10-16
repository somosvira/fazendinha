import { describe, expect, it } from "vitest";
import { anteriorIatf, diaIatf, lerDataIatf } from "./horarios.calc.js";
import { calendarioIatf } from "./regras.calc.js";
import { compararExecucaoIatf, snapshotIatf } from "./iatf.calc.js";
import { programacaoSchema } from "./schemas.js";
const etapa = { nome: "Manejo", tipo: "MANEJO" as const, intervalo: 0, unidade: "DIAS" as const };
describe("IATF com data conhecida e horário opcional", () => {
  it("conserva o dia sem deslocá-lo ao dia anterior no Brasil", () => {
    const t = lerDataIatf("2026-10-01");
    expect(t.precisao).toBe("DIA"); expect(t.data).toBe("2026-10-01");
    expect(diaIatf(t.instante,t.precisao)).toBe("2026-10-01");
    expect(lerDataIatf("2026-10-02T02:30:00Z").data).toBe("2026-10-01");
    expect(() => lerDataIatf("2026-02-30")).toThrow();
    expect(() => lerDataIatf("2026-10-01T12:00")).toThrow();
  });
  it("não afirma ordem intradiária quando uma hora é desconhecida", () => {
    const conhecido = new Date("2026-10-01T15:00:00Z"), dia = new Date("2026-10-01");
    expect(anteriorIatf(dia,"DIA",conhecido,"HORA")).toBe(false);
    expect(anteriorIatf(new Date("2026-09-30"),"DIA",conhecido,"HORA")).toBe(true);
    expect(anteriorIatf(new Date("2026-10-01T14:00:00Z"),"HORA",conhecido,"HORA")).toBe(true);
  });
  it("calcula dias inteiros e sinaliza etapas em horas ou dias fracionados sem inventar vencimento", () => {
    const inicio = new Date("2026-10-01");
    const t = calendarioIatf(inicio,[{...etapa,intervalo:11},{...etapa,intervalo:36,unidade:"HORAS"},{...etapa,intervalo:1.5}],"DIA");
    expect(t[0]).toMatchObject({previstaEm:new Date("2026-10-12"),precisaoTemporal:"DIA",previsaoPendente:false});
    expect(t[1]).toMatchObject({previstaEm:inicio,previsaoPendente:true}); expect(t[2].previsaoPendente).toBe(true);
    expect(calendarioIatf(new Date("2026-10-01T15:00:00Z"),[{...etapa,intervalo:36,unidade:"HORAS"}])[0]).toMatchObject({previstaEm:new Date("2026-10-03T03:00:00Z"),previsaoPendente:false});
  });
  it("compara a data disponível e mantém o horário como não aferido", () => {
    const d = new Date("2026-10-02T02:30:00Z");
    const p = snapshotIatf(etapa,{},d,d,d);
    expect(compararExecucaoIatf(p,"2026-10-01",{})).toEqual({aferido:true,diferencas:[],horarioAferido:false});
    expect(compararExecucaoIatf(p,"2026-10-02",{}).diferencas).toMatchObject([{campo:"data",planejado:"2026-10-01",realizado:"2026-10-02"}]);
    const semHora = snapshotIatf(etapa,{},new Date("2026-10-01"),new Date("2026-10-01"),new Date("2026-10-01"),"DIA");
    expect(semHora.previstaEm).toBe("2026-10-01");
    expect(compararExecucaoIatf(semHora,"2026-10-01T20:00:00Z",{})).toMatchObject({diferencas:[],horarioAferido:false});
    expect(compararExecucaoIatf({...semHora,previsaoPendente:true},"2026-10-04",{})).toMatchObject({diferencas:[],horarioAferido:false});
  });
  it("aceita precisão independente por animal sem mudar payloads antigos com hora", () => {
    const id="00000000-0000-4000-8000-000000000001";
    expect(programacaoSchema.parse({chave:id,propriedadeId:1,protocoloId:id,nome:"IATF",inicioPrevisto:"2026-10-01",animais:[{animalId:id,inicioPrevisto:"2026-10-01T12:00:00Z"}]}).inicioPrevisto).toBe("2026-10-01");
  });
});
