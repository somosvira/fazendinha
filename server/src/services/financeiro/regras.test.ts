import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { exigirParceiroAtivo, FinanceiroError, traduzirConflitoUnico } from "./regras.js";

describe("regras financeiras — parceiro e conflitos", () => {
  it("exigirParceiroAtivo lança quando não há parceiro ativo", async () => {
    const db = { parceiro: { findFirst: vi.fn().mockResolvedValue(null) } } as never;
    await expect(exigirParceiroAtivo(db, "3")).rejects.toMatchObject({ code: "NAO_ENCONTRADO", campo: "parceiroId" });
  });

  it("exigirParceiroAtivo devolve o parceiro ativo", async () => {
    const db = { parceiro: { findFirst: vi.fn().mockResolvedValue({ id: "3", ativo: true }) } } as never;
    await expect(exigirParceiroAtivo(db, "3")).resolves.toEqual({ id: "3", ativo: true });
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
