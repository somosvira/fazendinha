import { describe, it, expect } from "vitest";
import { criarEventoSanitarioSchema as S } from "./eventos-sanidade.schemas.js";

const PRODUTO_ID = "00000000-0000-4000-8000-000000000007";

describe("criarEventoSanitarioSchema", () => {
  it("EXAME exige ccs", () => { expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12", ccs: 512 }).success).toBe(true); expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12" }).success).toBe(false); });
  it("APLICACAO exige medicamento e consumo de estoque", () => { expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet", produtoId: PRODUTO_ID, quantidadeUsada: 1, carencia: 96, loteProduto: "MAST-2231" }).success).toBe(true); expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet" }).success).toBe(false); });
  it("OCORRENCIA exige doenca", () => { expect(S.safeParse({ tipo: "OCORRENCIA", data: "2026-04-14", doenca: "Mastite clínica" }).success).toBe(true); });
  it("exige produto e quantidade do estoque", () => {
    expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet", produtoId: PRODUTO_ID }).success).toBe(false);
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", quantidadeUsada: 1 }).success).toBe(false);
    expect(S.safeParse({ tipo: "VACINA", data: "2026-04-14", produto: "Brucelose", produtoId: PRODUTO_ID, quantidadeUsada: 1 }).success).toBe(true);
  });
});
