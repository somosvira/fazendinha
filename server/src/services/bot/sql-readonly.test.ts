import { describe, it, expect } from "vitest";
import { validarSqlReadonly } from "./sql-readonly.js";

describe("validarSqlReadonly", () => {
  it("aceita SELECT simples e força LIMIT", () => {
    const r = validarSqlReadonly('SELECT * FROM "Animal"');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toMatch(/LIMIT 200$/);
  });

  it("aceita WITH ... SELECT", () => {
    const r = validarSqlReadonly('WITH x AS (SELECT 1 AS n) SELECT n FROM x LIMIT 5');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toMatch(/LIMIT 5$/);
  });

  it("preserva LIMIT existente", () => {
    const r = validarSqlReadonly('SELECT 1 LIMIT 7');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toBe("SELECT 1 LIMIT 7");
  });

  it("remove ';' final único", () => {
    const r = validarSqlReadonly("SELECT 1 LIMIT 1;  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sql).toBe("SELECT 1 LIMIT 1");
  });

  it("rejeita múltiplos statements", () => {
    const r = validarSqlReadonly("SELECT 1; DROP TABLE x");
    expect(r.ok).toBe(false);
  });

  it("rejeita não-SELECT", () => {
    expect(validarSqlReadonly('UPDATE "Animal" SET nome = 1').ok).toBe(false);
    expect(validarSqlReadonly('DELETE FROM "Animal"').ok).toBe(false);
    expect(validarSqlReadonly('DROP TABLE "Animal"').ok).toBe(false);
  });

  it("rejeita DML/DDL escondido em SELECT", () => {
    expect(validarSqlReadonly('SELECT 1 WHERE (DELETE FROM x)').ok).toBe(false);
    expect(validarSqlReadonly('SELECT 1; truncate "Animal"').ok).toBe(false);
  });

  it("rejeita consulta vazia", () => {
    expect(validarSqlReadonly("   ").ok).toBe(false);
  });
});
