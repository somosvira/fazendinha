import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  alvosConflitoUnico, exigirAfetadas, hojeFazenda, hojeFazendaDate, MENSAGEM_ALTERADO_AO_SALVAR, RebanhoError, traduzirConflitoUnico,
  travarAnimais, travarBrinco, travarBrincos, travarLoteAtivo, type DbPecuaria,
} from "./regras.js";

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

describe("travas (advisory lock numa query só)", () => {
  const dbFalso = (linhasLote: unknown[] = []) => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const queryRaw = vi.fn().mockResolvedValue(linhasLote);
    return { db: { $executeRaw: executeRaw, $queryRaw: queryRaw } as unknown as DbPecuaria, executeRaw, queryRaw };
  };
  // tagged template: (strings, ...valores)
  const valores = (fn: ReturnType<typeof vi.fn>, chamada = 0) => fn.mock.calls[chamada].slice(1);
  const sql = (fn: ReturnType<typeof vi.fn>, chamada = 0) => (fn.mock.calls[chamada][0] as string[]).join("?");

  it("travarAnimais: uma query só, chaves sem repetição, ordem fixa no banco (ORDER BY do hash)", async () => {
    const { db, executeRaw } = dbFalso();
    await travarAnimais(db, ["b", "a", "b"]);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(valores(executeRaw)).toEqual([["pec-animal:b", "pec-animal:a"]]);
    expect(sql(executeRaw)).toMatch(/pg_advisory_xact_lock/);
    expect(sql(executeRaw)).toMatch(/unnest\(\?::text\[\]\)/);
    expect(sql(executeRaw)).toMatch(/ORDER BY h/);
  });

  it("lista vazia não vai ao banco", async () => {
    const { db, executeRaw } = dbFalso();
    await travarAnimais(db, []);
    await travarBrincos(db, []);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("travarBrincos mantém o formato de chave pec-brinco:<sítio>:<brinco> e trava todos de uma vez", async () => {
    const { db, executeRaw } = dbFalso();
    await travarBrincos(db, [{ propriedadeId: 2, brincoNormalizado: "10" }, { propriedadeId: 1, brincoNormalizado: "7" }]);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(valores(executeRaw)).toEqual([["pec-brinco:2:10", "pec-brinco:1:7"]]);
    await travarBrinco(db, 3, "A1");
    expect(valores(executeRaw, 1)).toEqual([["pec-brinco:3:A1"]]);
  });

  it("travarLoteAtivo: lote inexistente, de outro sítio ou inativo é NAO_ENCONTRADO no campo loteId", async () => {
    const vazio = dbFalso([]);
    await expect(travarLoteAtivo(vazio.db, "L1", 1)).rejects.toMatchObject({ code: "NAO_ENCONTRADO", campo: "loteId" });
    expect(sql(vazio.queryRaw)).toMatch(/FOR SHARE/);
    const achado = dbFalso([{ id: "L1" }]);
    await expect(travarLoteAtivo(achado.db, "L1", 1)).resolves.toBeUndefined();
  });
});

describe("hojeFazenda / hojeFazendaDate (R3/R6 — fuso America/Sao_Paulo, não UTC)", () => {
  afterEach(() => vi.useRealTimers());

  it("23h30 em São Paulo ainda é o dia anterior, mesmo já sendo o dia seguinte em UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T02:30:00Z")); // 2026-09-24 23:30 em SP (UTC-3)
    expect(hojeFazenda()).toBe("2026-09-24");
    expect(hojeFazendaDate().toISOString().slice(0, 10)).toBe("2026-09-24");
  });

  it("madrugada em São Paulo já é o dia seguinte", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T04:00:00Z")); // 2026-09-25 01:00 em SP
    expect(hojeFazenda()).toBe("2026-09-25");
  });
});

describe("exigirAfetadas", () => {
  it("passa quando o updateMany condicional pegou todas as linhas esperadas", () => {
    expect(() => exigirAfetadas({ count: 3 }, 3)).not.toThrow();
  });

  it("menos linhas que o esperado = alterado ao mesmo tempo (CONFLITO)", () => {
    const e = capturar(() => { exigirAfetadas({ count: 0 }, 1); throw new Error("não lançou"); });
    expect(e).toBeInstanceOf(RebanhoError);
    expect(e).toMatchObject({ code: "CONFLITO", message: MENSAGEM_ALTERADO_AO_SALVAR });
  });
});
