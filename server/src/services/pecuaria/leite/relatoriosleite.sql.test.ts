import { contemSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
const conferenciaSql = readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql", import.meta.url), "utf8");
describe("histórico SQL de emissão e descarte", () => {
  it("observação física aceita zero, mantém versões sequenciais e bloqueia update/delete", () => {
    expect(contemSql(conferenciaSql, '"litrosObservados" >= (0)::numeric')).toBe(true); expect(contemSql(conferenciaSql, "NEW.versao<>COALESCE(anterior,0)+1")).toBe(true);
    expect(contemSql(conferenciaSql, 'BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."ConferenciaSaldoLeite"')).toBe(true); expect(contemSql(conferenciaSql, "IF TG_OP<>'INSERT' THEN RAISE EXCEPTION")).toBe(true);
    expect(contemSql(conferenciaSql, 'UPDATE public."MovimentoEstoque"')).toBe(false);
  });
  it("emissão é append-only com período e snapshot persistidos", () => {
    expect(contemSql(sql, 'BEFORE UPDATE OR DELETE ON pecuaria."EmissaoRelatorioLeite"')).toBe(true); expect(contemSql(sql, "jsonb_typeof(snapshot)='object'")).toBe(true); expect(contemSql(sql, 'snapshot jsonb NOT NULL')).toBe(true);
  });
  it("descarte conserva identidade/quantidades/autoria e só admite estorno terminal versionado", () => {
    expect(contemSql(sql, "IF TG_OP='DELETE' THEN RAISE EXCEPTION")).toBe(true); expect(contemSql(sql, "to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId']")).toBe(true);
    expect(contemSql(sql, "NEW.versao<>OLD.versao+1")).toBe(true); expect(contemSql(sql, '"saldoOrigemDepois" = ("saldoOrigemAntes" - "quantidadeLitros")')).toBe(true);
  });
  it("valida saída única com finalidade descarte, origem/sítio/data e inverso, sem operação", () => {
    for (const prova of ["m.origem<>'PERDA'", 'm."operacaoId" IS NOT NULL', "finalidade='DESCARTE'", 'q<>d."quantidadeLitros"', 'inv."reversaoDeId"<>m.id', 'DEFERRABLE INITIALLY DEFERRED', "Perda leiteira exige fato de descarte rastreado"])
      expect(contemSql(sql, prova)).toBe(true);
  });
});
