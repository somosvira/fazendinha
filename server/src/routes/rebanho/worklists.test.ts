import { describe, expect, it } from "vitest";
import { chaveWorklistSchema } from "./worklists.js";

describe("validação da rota de worklists do rebanho", () => {
  it.each(["secagem-atrasada", "vazia-pos-pev", "ccs-alta", "dg-pendente", "parto-proximo"])("aceita a chave %s", (chave) => {
    expect(chaveWorklistSchema.parse(chave)).toBe(chave);
  });

  it("rejeita chave desconhecida", () => {
    expect(chaveWorklistSchema.safeParse("alerta-inventado").success).toBe(false);
  });
});
