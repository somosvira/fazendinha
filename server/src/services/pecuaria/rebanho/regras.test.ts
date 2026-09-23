import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { alvosConflitoUnico, RebanhoError, traduzirConflitoUnico } from "./regras.js";

const p2002 = (meta: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta });

const capturar = (fn: () => never) => {
  try { fn(); } catch (e) { return e; }
  throw new Error("não lançou");
};

describe("alvosConflitoUnico", () => {
  it("lê target em lista, string e dentro do driverAdapterError", () => {
    expect(alvosConflitoUnico({ target: ["propriedadeId", "nome"] })).toEqual(["propriedadeId", "nome"]);
    expect(alvosConflitoUnico({ target: "Lote_propriedadeId_nome_key" })).toEqual(["Lote_propriedadeId_nome_key"]);
    expect(alvosConflitoUnico({
      driverAdapterError: { cause: { constraint: { fields: ["\"propriedadeId\"", "\"nome\""] } } },
    })).toEqual(["\"propriedadeId\"", "\"nome\""]);
    expect(alvosConflitoUnico(undefined)).toEqual([]);
  });
});

describe("traduzirConflitoUnico", () => {
  it("lote duplicado: constraint composta vira CONFLITO no campo nome (lista de campos)", () => {
    const e = capturar(() => traduzirConflitoUnico(p2002({ target: ["propriedadeId", "nome"] }), { nome: "duplicado" }));
    expect(e).toBeInstanceOf(RebanhoError);
    expect(e).toMatchObject({ code: "CONFLITO", campo: "nome", message: "duplicado" });
  });

  it("lote duplicado: reconhece pelo nome do índice (driver adapter)", () => {
    const e = capturar(() => traduzirConflitoUnico(p2002({ target: "Lote_propriedadeId_nome_key" }), { nome: "duplicado" }));
    expect(e).toMatchObject({ code: "CONFLITO", campo: "nome" });
  });

  it("lote duplicado: reconhece campos entre aspas do driverAdapterError", () => {
    const meta = { driverAdapterError: { cause: { constraint: { fields: ["\"propriedadeId\"", "\"nome\""] } } } };
    const e = capturar(() => traduzirConflitoUnico(p2002(meta), { nome: "duplicado" }));
    expect(e).toMatchObject({ code: "CONFLITO", campo: "nome" });
  });

  it("P2002 sem campo mapeado vira CONFLITO genérico (não 500)", () => {
    const e = capturar(() => traduzirConflitoUnico(p2002({ target: ["sisbov"] }), { brincoEletronico: "x" }));
    expect(e).toMatchObject({ code: "CONFLITO", campo: undefined });
  });

  it("relança o que não é P2002", () => {
    expect(() => traduzirConflitoUnico(new Error("x"), { nome: "d" })).toThrow("x");
  });
});
