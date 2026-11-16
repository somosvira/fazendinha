import { describe, expect, it } from "vitest";
import { quantidadePadraoTentativa, resolverDecisaoIatf, validarConsumoExcepcionalTentativa } from "./atendimento.calc.js";
describe("decisões do atendimento manual", () => {
  it("preserva não indicar como decisão distinta de ausência", () => {
    expect(resolverDecisaoIatf({resultado:"NEGATIVO"}).decisaoIatf).toBeNull();
    expect(resolverDecisaoIatf({resultado:"NEGATIVO",decisaoIatf:"NAO_INDICAR"})).toEqual({conduta:undefined,decisaoIatf:"NAO_INDICAR"});
    expect(resolverDecisaoIatf({resultado:"NEGATIVO",decisaoIatf:"INDICAR"}).conduta).toBe("IATF");
  });
  it("rejeita indicação clínica incompatível e decisões contraditórias", () => {
    for(const resultado of ["POSITIVO","INCONCLUSIVO","NAO_AVALIADO"])
      expect(()=>resolverDecisaoIatf({resultado,decisaoIatf:"INDICAR"})).toThrow();
    expect(()=>resolverDecisaoIatf({resultado:"NEGATIVO",decisaoIatf:"NAO_INDICAR",conduta:"IATF"})).toThrow();
    expect(()=>resolverDecisaoIatf({resultado:"NEGATIVO",decisaoIatf:"INDICAR",conduta:"DESCARTE"})).toThrow();
  });
  it("só pressupõe uma unidade para material cadastrado em dose/unidade", () => {
    expect(quantidadePadraoTentativa("IA",undefined,"DOSE")).toBe(1);
    expect(quantidadePadraoTentativa("TE",undefined,"UN")).toBe(1);
    expect(()=>quantidadePadraoTentativa("IA",undefined,"ML")).toThrow();
    expect(quantidadePadraoTentativa("IA",2,"DOSE")).toBe(2);
    expect(quantidadePadraoTentativa("COBERTURA",undefined,undefined)).toBeNull();
  });
});

it("novas exceções exigem motivo sem reescrever quantidades históricas",()=>{
 expect(quantidadePadraoTentativa("IA",2,"DOSE")).toBe(2);
 expect(()=>validarConsumoExcepcionalTentativa("IA",2,"DOSE")).toThrow(/motivo/);
 expect(()=>validarConsumoExcepcionalTentativa("IA",2,"DOSE","Uso real conferido")).not.toThrow();
 expect(()=>validarConsumoExcepcionalTentativa("IA",1,"DOSE")).not.toThrow();
 expect(()=>validarConsumoExcepcionalTentativa("TE",2,"UN","Transferência dupla")).toThrow(/um embrião/);
 expect(()=>validarConsumoExcepcionalTentativa("TE",0.5,"ML","Unidade documental histórica")).not.toThrow();
});
