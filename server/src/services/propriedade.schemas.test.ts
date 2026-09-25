import { describe, it, expect } from "vitest";
import type { Context } from "hono";
import { propriedadeSchema, PropriedadeError, resolverEscopoEscrita, resolverEscopoLeitura } from "./propriedade.js";

describe("propriedadeSchema", () => {
  it("aceita o mínimo (só nome)", () => {
    const r = propriedadeSchema.safeParse({ nome: "Recria" });
    expect(r.success).toBe(true);
  });

  it("aceita campos completos", () => {
    const r = propriedadeSchema.safeParse({ nome: "Recria", apelido: "Recria", cidade: "Uberaba", uf: "MG", principal: false, ativo: true, ordem: 1 });
    expect(r.success).toBe(true);
  });

  it("exige nome não-vazio", () => {
    expect(propriedadeSchema.safeParse({ nome: "" }).success).toBe(false);
  });

  it("UF precisa ter 2 letras", () => {
    expect(propriedadeSchema.safeParse({ nome: "X", uf: "MGX" }).success).toBe(false);
    expect(propriedadeSchema.safeParse({ nome: "X", uf: "M" }).success).toBe(false);
    expect(propriedadeSchema.safeParse({ nome: "X", uf: "MG" }).success).toBe(true);
  });
});

// Contexto falso: com o header explícito, nem resolverEscopoLeitura nem resolverEscopoEscrita
// tocam o banco (retornam ou lançam antes disso), então não precisam mockar `../db.js`.
const ctx = (headers: Record<string, string> = {}): Context =>
  ({ req: { header: (k: string) => headers[k], query: () => undefined } }) as unknown as Context;

describe("resolverEscopoLeitura / resolverEscopoEscrita — validação do header X-Propriedade-Id (S2)", () => {
  it("aceita um id numérico dentro da faixa", async () => {
    await expect(resolverEscopoLeitura(ctx({ "X-Propriedade-Id": "3" }))).resolves.toBe(3);
    await expect(resolverEscopoEscrita(ctx({ "X-Propriedade-Id": "3" }))).resolves.toBe(3);
  });

  it("rejeita um valor não numérico com ESCOPO_INVALIDO", async () => {
    await expect(resolverEscopoLeitura(ctx({ "X-Propriedade-Id": "abc" }))).rejects.toMatchObject({ code: "ESCOPO_INVALIDO" });
    await expect(resolverEscopoLeitura(ctx({ "X-Propriedade-Id": "abc" }))).rejects.toBeInstanceOf(PropriedadeError);
  });

  it("rejeita um id acima do teto INT4 do Postgres", async () => {
    await expect(resolverEscopoLeitura(ctx({ "X-Propriedade-Id": "99999999999" }))).rejects.toMatchObject({ code: "ESCOPO_INVALIDO" });
  });

  it("rejeita zero e negativos", async () => {
    await expect(resolverEscopoLeitura(ctx({ "X-Propriedade-Id": "0" }))).rejects.toMatchObject({ code: "ESCOPO_INVALIDO" });
    await expect(resolverEscopoLeitura(ctx({ "X-Propriedade-Id": "-1" }))).rejects.toMatchObject({ code: "ESCOPO_INVALIDO" });
  });

  it("resolverEscopoEscrita: um id explícito no payload ignora o header (mesmo se inválido)", async () => {
    await expect(resolverEscopoEscrita(ctx({ "X-Propriedade-Id": "abc" }), 7)).resolves.toBe(7);
  });
});
