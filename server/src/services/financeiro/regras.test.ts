import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { exigirParceiroAtivo, exigirPositivo, FinanceiroError, traduzirConflitoUnico } from "./regras.js";
import { uid } from "../../lib/uid.fixture.js";

describe("exigirPositivo", () => {
  // decimal.js trata zero como "positivo" (sinal +1) — exigirPositivo precisa
  // rejeitar explicitamente, senão um valor 0 (ou que arredonda para 0 em
  // duas casas) passaria como pagamento/transferência válido.
  it("rejeita zero", () => {
    expect(() => exigirPositivo(0)).toThrow(FinanceiroError);
    expect(() => exigirPositivo(0, "valorPago")).toThrow(expect.objectContaining({ code: "VALIDACAO" }));
  });

  it("rejeita um valor que arredonda para zero em duas casas", () => {
    expect(() => exigirPositivo("0.004")).toThrow(FinanceiroError);
  });

  it("rejeita negativo e aceita positivo", () => {
    expect(() => exigirPositivo(-10)).toThrow(FinanceiroError);
    expect(exigirPositivo(10).toString()).toBe("10");
  });
});

describe("regras financeiras — parceiro e conflitos", () => {
  it("exigirParceiroAtivo lança quando não há parceiro ativo", async () => {
    const db = { parceiro: { findFirst: vi.fn().mockResolvedValue(null) } } as never;
    await expect(exigirParceiroAtivo(db, uid(3))).rejects.toMatchObject({ code: "NAO_ENCONTRADO", campo: "parceiroId" });
  });

  it("exigirParceiroAtivo devolve o parceiro ativo", async () => {
    const db = { parceiro: { findFirst: vi.fn().mockResolvedValue({ id: uid(3), ativo: true }) } } as never;
    await expect(exigirParceiroAtivo(db, uid(3))).resolves.toEqual({ id: uid(3), ativo: true });
  });

  it("traduzirConflitoUnico converte P2002 do campo mapeado", () => {
    const erro = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["documento"] } });
    expect(() => traduzirConflitoUnico(erro, { documento: "duplicado" })).toThrow(FinanceiroError);
    try { traduzirConflitoUnico(erro, { documento: "duplicado" }); } catch (e) { expect((e as FinanceiroError).campo).toBe("documento"); }
  });

  it("traduzirConflitoUnico relança o que não é P2002 e P2002 de campo não mapeado", () => {
    expect(() => traduzirConflitoUnico(new Error("x"), { documento: "d" })).toThrow("x");
    const outro = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["nome"] } });
    expect(() => traduzirConflitoUnico(outro, { documento: "d" })).toThrow(outro);
  });
});
