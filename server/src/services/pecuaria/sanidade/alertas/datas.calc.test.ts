import { describe, it, expect } from "vitest";
import { alcanceIdade, avaliarPrazo, dataCivil, diaCivil } from "./datas.calc.js";
import { idadeEmMeses } from "../../rebanho/categoria.calc.js";
describe("alcance sanitário em meses completos", () => {
  it.each([["2024-02-29",12,"2025-03-01"],["2026-01-31",1,"2026-03-01"],["2026-01-10",6,"2026-07-10"]])("%s + %s", (n,m,d) => {
    const alcance = alcanceIdade(dataCivil(n), Number(m))!;
    expect(alcance.toISOString().slice(0,10)).toBe(d);
    expect(idadeEmMeses(n, alcance)).toBe(Number(m));
    expect(idadeEmMeses(n, new Date(alcance.getTime()-86400000))).toBeLessThan(Number(m));
  });
  it("não fabrica atraso de adoção passada", () => expect(avaliarPrazo({ data:dataCivil("2026-01-01"), hoje:dataCivil("2026-10-28"), adocao:dataCivil("2026-10-28"), antecedenciaDias:0,prazoDias:0 })).toEqual({situacao:"CONFERENCIA_INICIAL",visivel:true,prazo:null}));
  it("usa o dia de São Paulo", () => expect(diaCivil(new Date("2026-10-28T01:00:00Z"))).toBe("2026-10-27"));
});

import { situacaoTemporal } from "./datas.calc.js";
describe("prazo do adiamento preservado",()=>{
 it.each(["regra","programação"])("%s retorna à atenção na nova data sem alterar a decisão",origem=>{
  const entrada={situacao:"ADIADO",dataReferencia:dataCivil("2026-01-01"),dataAtencao:origem==="regra"?dataCivil("2026-10-30"):null,prazo:dataCivil("2026-10-30")};
  expect(situacaoTemporal(entrada,dataCivil("2026-10-29"))).toBe("ADIADO");
  expect(situacaoTemporal(entrada,dataCivil("2026-10-30"))).toBe("PENDENTE");
  expect(situacaoTemporal(entrada,dataCivil("2026-10-31"))).toBe("ATRASADO");
  expect(entrada.situacao).toBe("ADIADO");expect(entrada.dataReferencia.toISOString().slice(0,10)).toBe("2026-01-01");
 });
 it("respeita prazo operacional após a data adiada",()=>{const entrada={situacao:"ADIADO",dataReferencia:dataCivil("2026-01-01"),dataAtencao:dataCivil("2026-10-30"),prazo:dataCivil("2026-11-02")};expect(situacaoTemporal(entrada,dataCivil("2026-11-01"))).toBe("PENDENTE");expect(situacaoTemporal(entrada,dataCivil("2026-11-03"))).toBe("ATRASADO");});
});
