import { describe, expect, it } from "vitest";
import { exameProtocoloSchema, tentativaProtocoloSchema, avaliacaoProtocoloSchema } from "./execucao.clinica.schemas.js";
const id = "a0000000-0000-4000-8000-000000000001";
const base = { tarefaId: id, animalId: id, propriedadeId: 1, data: "2026-10-20" };
describe("contratos clínicos da execução comum", () => {
  it("aceita coleta sem resultado e conserva ausência de horário", () => {
    const coleta = exameProtocoloSchema.parse({ ...base, tipo: "EXAME", tipoExameId: id });
    expect(coleta.resultadoNumero).toBeUndefined();
    expect(coleta.realizadaEm).toBeUndefined();
    expect(exameProtocoloSchema.parse({ ...coleta, realizadaEm: "2026-10-20T12:00:00-03:00" }).realizadaEm).toBe("2026-10-20T12:00:00-03:00");
  });
  it("mantém tipo de tentativa distinto da ação e admite cobertura", () => {
    const cobertura = tentativaProtocoloSchema.parse({ ...base, tipo: "TENTATIVA", tipoTentativa: "COBERTURA", origem: "DOCUMENTADA", touroId: id, justificativaSemOrigem: "Cobertura no pasto" });
    expect(cobertura.tipoTentativa).toBe("COBERTURA");
    expect(cobertura.materialId).toBeUndefined();
    expect(tentativaProtocoloSchema.safeParse({ ...cobertura, tipoTentativa: "PRENHEZ" }).success).toBe(false);
  });
  it("exige conclusão explícita por animal e não aceita não realização como avaliação", () => {
    const avaliacao = { ...base, tipo: "AVALIACAO", tipoExameId: id };
    expect(avaliacaoProtocoloSchema.safeParse(avaliacao).success).toBe(false);
    expect(avaliacaoProtocoloSchema.safeParse({ ...avaliacao, resultado: "NAO_AVALIADO" }).success).toBe(false);
    expect(avaliacaoProtocoloSchema.parse({ ...avaliacao, resultado: "INCONCLUSIVO" }).resultado).toBe("INCONCLUSIVO");
  });
});
