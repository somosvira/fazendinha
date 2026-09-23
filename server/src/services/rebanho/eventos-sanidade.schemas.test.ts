import { describe, it, expect } from "vitest";
import { criarEventoSanitarioSchema as S } from "./eventos-sanidade.schemas.js";
describe("criarEventoSanitarioSchema", () => {
  it("EXAME exige ccs", () => { expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12", ccs: 512 }).success).toBe(true); expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12" }).success).toBe(false); });
  it("APLICACAO exige medicamento e consumo de estoque", () => { expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet", produtoId: 7, quantidadeUsada: 1, carencia: 96, loteProduto: "MAST-2231" }).success).toBe(true); expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet" }).success).toBe(false); });
  it("OCORRENCIA exige doenca", () => { expect(S.safeParse({ tipo: "OCORRENCIA", data: "2026-04-14", doenca: "Mastite clínica" }).success).toBe(true); });
  it("exige produto e quantidade do estoque", () => {
    expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet", produtoId: 7 }).success).toBe(false);
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", quantidadeUsada: 1 }).success).toBe(false);
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", produtoId: 7, quantidadeUsada: 1 }).success).toBe(true);
  });
  it("quantidadeUsada respeita limite e granularidade de Decimal(12,3)", () => {
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", produtoId: 7, quantidadeUsada: 999_999_999.999 }).success).toBe(true);
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", produtoId: 7, quantidadeUsada: 1_000_000_000 }).success).toBe(false);
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", produtoId: 7, quantidadeUsada: 0.0004 }).success).toBe(false);
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", produtoId: 7, quantidadeUsada: 0.005 }).success).toBe(true);
  });
});
