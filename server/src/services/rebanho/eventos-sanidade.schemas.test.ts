import { describe, it, expect } from "vitest";
import { criarEventoSanitarioSchema as S } from "./eventos-sanidade.schemas.js";
describe("criarEventoSanitarioSchema", () => {
  it("EXAME exige ccs", () => { expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12", ccs: 512 }).success).toBe(true); expect(S.safeParse({ tipo: "EXAME", data: "2026-05-12" }).success).toBe(false); });
  it("APLICACAO exige produto", () => { expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14", produto: "Mastijet", carencia: 96, loteProduto: "MAST-2231" }).success).toBe(true); expect(S.safeParse({ tipo: "APLICACAO", data: "2026-04-14" }).success).toBe(false); });
  it("OCORRENCIA exige doenca", () => { expect(S.safeParse({ tipo: "OCORRENCIA", data: "2026-04-14", doenca: "Mastite clínica" }).success).toBe(true); });
});
