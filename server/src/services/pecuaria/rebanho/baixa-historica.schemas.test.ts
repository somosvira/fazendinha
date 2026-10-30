import { describe, expect, it } from "vitest";
import { baixaSchema, listarFiltrosSchema, regularizarBaixaHistoricaSchema, revisarClassificacaoBaixaSchema } from "./schemas.js";

const base = { data: "2024-08-12", bancoOrigem: "IDEAGRI-STG", chaveOrigem: "BAIXA:412", evidencia: "Extrato da fazenda com saída confirmada", motivo: "Classificação não disponível no documento" };

describe("baixa histórica com tipo não determinado", () => {
  it("não aceita tipo não determinado pelo cadastro operacional comum", () => {
    expect(baixaSchema.safeParse({ data: base.data, tipo: "NAO_DETERMINADO", regularizacaoHistorica: base }).success).toBe(false);
  });
  it("regularização exige referência, evidência e justificativa, sem aceitar um tipo presumido", () => {
    expect(regularizarBaixaHistoricaSchema.safeParse(base).success).toBe(true);
    for (const campo of ["bancoOrigem", "chaveOrigem", "evidencia", "motivo"] as const) {
      expect(regularizarBaixaHistoricaSchema.safeParse({ ...base, [campo]: " " }).success).toBe(false);
    }
    expect(regularizarBaixaHistoricaSchema.safeParse({ ...base, tipo: "MORTE" }).success).toBe(false);
    expect(regularizarBaixaHistoricaSchema.safeParse({ ...base, motivoId: "123" }).success).toBe(false);
  });
  it("permite filtrar o tipo desconhecido sem misturá-lo a mortes", () => {
    expect(listarFiltrosSchema.parse({ situacao: "BAIXADO", tipoBaixa: "NAO_DETERMINADO" }).tipoBaixa).toBe("NAO_DETERMINADO");
  });
  it("revisão exige tipo conhecido real e motivo; cadastro inválido não reclassifica saída comprovada", () => {
    const revisao = { chave: "39ce15f7-bd59-4405-8757-45f5a627715c", tipo: "VENDA", evidencia: "Documento posteriormente localizado", motivo: "Tipo comprovado pela origem" };
    expect(revisarClassificacaoBaixaSchema.safeParse(revisao).success).toBe(true);
    for (const tipo of ["NAO_DETERMINADO", "CADASTRO_INDEVIDO"]) {
      expect(revisarClassificacaoBaixaSchema.safeParse({ ...revisao, tipo }).success).toBe(false);
    }
    expect(revisarClassificacaoBaixaSchema.safeParse({ ...revisao, data: "2025-01-01" }).success).toBe(false);
    expect(revisarClassificacaoBaixaSchema.safeParse({ ...revisao, motivo: "" }).success).toBe(false);
  });
});
