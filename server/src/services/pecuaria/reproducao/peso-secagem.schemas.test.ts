import { describe, expect, it } from "vitest";
import { encerramentoLactacaoSchema, manterPesoSecagemSchema } from "./peso-secagem.schemas.js";
const id = "10000000-0000-4000-8000-000000000001";
const base = { propriedadeId: 1, data: "2026-10-20", motivo: "Secagem manual comprovada" };
const peso = { acao: "REGISTRAR", data: "2026-10-20", pesoKg: 500, origem: "MANUAL", precisao: "ESTIMADO" };
describe("contratos do peso opcional na secagem", () => {
  it("mantém encerramento anterior sem peso e exige chave para associar", () => {
    expect(encerramentoLactacaoSchema.safeParse(base).success).toBe(true);
    expect(encerramentoLactacaoSchema.safeParse({...base,pesoSecagem:{acao:"NAO_INFORMAR"}}).success).toBe(true);
    expect(encerramentoLactacaoSchema.safeParse({...base,pesoSecagem:peso}).success).toBe(false);
    expect(encerramentoLactacaoSchema.safeParse({...base,chave:id,pesoSecagem:peso}).success).toBe(true);
  });
  it("reutilizar só envia identidade; não aceita reclassificar o peso silenciosamente", () => {
    expect(encerramentoLactacaoSchema.safeParse({...base,chave:id,pesoSecagem:{acao:"VINCULAR",pesagemId:id}}).success).toBe(true);
    expect(encerramentoLactacaoSchema.safeParse({...base,chave:id,pesoSecagem:{acao:"VINCULAR",pesagemId:id,precisao:"MEDIDO"}}).success).toBe(false);
  });
  it("precisão é explícita e uma estimativa não vira balança", () => {
    expect(encerramentoLactacaoSchema.safeParse({...base,chave:id,pesoSecagem:{...peso,precisao:undefined}}).success).toBe(false);
    expect(encerramentoLactacaoSchema.safeParse({...base,chave:id,pesoSecagem:{...peso,origem:"BALANCA"}}).success).toBe(false);
    expect(encerramentoLactacaoSchema.safeParse({...base,chave:id,pesoSecagem:{...peso,precisao:"NAO_INFORMADO"}}).success).toBe(true);
  });
  it("substituição/desvínculo pertencem à manutenção, com motivo e chave", () => {
    expect(encerramentoLactacaoSchema.safeParse({...base,chave:id,pesoSecagem:{acao:"DESVINCULAR",vinculoId:id,motivo:"Revisão da associação"}}).success).toBe(false);
    expect(manterPesoSecagemSchema.safeParse({chave:id,propriedadeId:1,motivo:"Revisão da associação",pesoSecagem:{acao:"SUBSTITUIR",vinculoId:id,pesagem:{acao:"VINCULAR",pesagemId:id}}}).success).toBe(true);
    expect(manterPesoSecagemSchema.safeParse({propriedadeId:1,motivo:"Revisão da associação",pesoSecagem:{acao:"DESVINCULAR",vinculoId:id}}).success).toBe(false);
  });
});
