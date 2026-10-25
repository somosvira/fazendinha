import { contemSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const sql = readFileSync(
  new URL(
    "../../../../prisma/migrations/20261025000000_base_unificada/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
it("instala o estado final sem faturar histórico; SQL estrutural não comprova PostgreSQL", () => {
  expect(contemSql(sql, "'RETIRADA_LEITE'")).toBe(true);
  expect(contemSql(sql, '"OperacaoComercialLeite_propriedadeId_parceiroId_inicio_fim_key"')).toBe(true);
  expect(sql).not.toMatch(
    /INSERT INTO public\."(Operacao|MovimentoEstoque|TransacaoFinanceira)"/,
  );
  for (const t of [
    "RetiradaOperacaoLeite",
    "FechamentoOperacaoLeite",
    "DetalheFechamentoLeite",
    "ComprovanteRetiradaOperacaoLeite",
  ])
    expect(contemSql(sql, `"${t}_imutavel" BEFORE UPDATE OR DELETE`)).toBe(true);
  expect(contemSql(sql, '"RetiradaOperacaoLeite_aberta" BEFORE INSERT')).toBe(true);
  expect(contemSql(sql, "FOR NO KEY UPDATE")).toBe(true);
  expect(contemSql(sql, 'q IS DISTINCT FROM f."volumeReconhecido"')).toBe(true);
  expect(contemSql(sql, 'f."valorTotal"<>round(f."volumeReconhecido"*f."precoUnitario",2)+f.ajuste')).toBe(true);
  expect(contemSql(sql, 'f."corrigeOperacaoId" IS DISTINCT FROM anterior')).toBe(true);
  expect(contemSql(sql, '"Operacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE')).toBe(true);
  expect(contemSql(sql, '"Movimento_retiradaComercialLeite_conferir" AFTER INSERT OR UPDATE')).toBe(true);
  expect(contemSql(sql, "DEFERRABLE INITIALLY DEFERRED")).toBe(true);
});
