import { describe, expect, it } from "vitest";
import { CHAVES_WORKLIST_REBANHO } from "../../services/rebanho/dashboard.types.js";
import { chaveWorklistSchema } from "./worklists.js";

describe("validação da rota de worklists do rebanho", () => {
  it.each(CHAVES_WORKLIST_REBANHO)("aceita a chave canônica %s", (chave) => {
    expect(chaveWorklistSchema.parse(chave)).toBe(chave);
  });

  it("rejeita chave desconhecida", () => {
    expect(chaveWorklistSchema.safeParse("alerta-inventado").success).toBe(false);
  });
});
