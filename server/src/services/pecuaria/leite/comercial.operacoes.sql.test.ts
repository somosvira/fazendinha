import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const sql = readFileSync(
  new URL(
    "../../../../prisma/migrations/20261021120000_operacao_comercial_leite/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
it("expande sem converter vendas ou refaturar histórico; SQL estrutural não comprova PostgreSQL", () => {
  expect(sql).toContain(
    "ALTER TYPE public.\"OrigemMovimentoEstoque\" ADD VALUE 'RETIRADA_LEITE'",
  );
  expect(sql).toContain(
    '"OperacaoComercialLeite_propriedadeId_parceiroId_inicio_fim_key"',
  );
  expect(sql).not.toMatch(
    /INSERT INTO public\."(Operacao|MovimentoEstoque|TransacaoFinanceira)"/,
  );
  for (const t of [
    "RetiradaOperacaoLeite",
    "FechamentoOperacaoLeite",
    "DetalheFechamentoLeite",
    "ComprovanteRetiradaOperacaoLeite",
  ])
    expect(sql).toContain(`"${t}_imutavel" BEFORE UPDATE OR DELETE`);
  expect(sql).toContain('"RetiradaOperacaoLeite_aberta" BEFORE INSERT');
  expect(sql).toContain("FOR NO KEY UPDATE");
  expect(sql).toContain('q IS DISTINCT FROM f."volumeReconhecido"');
  expect(sql).toContain(
    'f."valorTotal"<>round(f."volumeReconhecido"*f."precoUnitario",2)+f.ajuste',
  );
  expect(sql).toContain('f."corrigeOperacaoId" IS DISTINCT FROM anterior');
  expect(sql).toContain(
    '"Operacao_fechamentoLeite_conferir" AFTER INSERT OR UPDATE',
  );
  expect(sql).toContain(
    '"Movimento_retiradaComercialLeite_conferir" AFTER INSERT OR UPDATE',
  );
  expect(sql).toContain("DEFERRABLE INITIALLY DEFERRED");
});
