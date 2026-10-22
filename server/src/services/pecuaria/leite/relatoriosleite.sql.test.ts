import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../../../../prisma/migrations/20261020080000_emissoes_e_descarte_leite/migration.sql", import.meta.url), "utf8");
const conferenciaSql = readFileSync(new URL("../../../../prisma/migrations/20261020090000_conferencia_fisica_leite/migration.sql", import.meta.url), "utf8");
describe("histórico SQL de emissão e descarte", () => {
  it("observação física aceita zero, mantém versões sequenciais e bloqueia update/delete", () => {
    expect(conferenciaSql).toContain('"litrosObservados">=0'); expect(conferenciaSql).toContain("NEW.versao<>COALESCE(anterior,0)+1");
    expect(conferenciaSql).toContain('BEFORE INSERT OR UPDATE OR DELETE ON pecuaria."ConferenciaSaldoLeite"'); expect(conferenciaSql).toContain("IF TG_OP<>'INSERT' THEN RAISE EXCEPTION");
    expect(conferenciaSql).not.toContain('UPDATE public."MovimentoEstoque"');
  });
  it("emissão é append-only com período e snapshot persistidos", () => {
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON pecuaria."EmissaoRelatorioLeite"'); expect(sql).toContain("jsonb_typeof(snapshot)='object'"); expect(sql).toContain('"snapshot" JSONB NOT NULL');
  });
  it("descarte conserva identidade/quantidades/autoria e só admite estorno terminal versionado", () => {
    expect(sql).toContain("IF TG_OP='DELETE' THEN RAISE EXCEPTION"); expect(sql).toContain("to_jsonb(NEW)-ARRAY['status','versao','estornadoEm','estornadoPorId','motivoEstorno','movimentoEstornoId']");
    expect(sql).toContain("NEW.versao<>OLD.versao+1"); expect(sql).toContain('"saldoOrigemDepois"="saldoOrigemAntes"-"quantidadeLitros"');
  });
  it("valida saída única com finalidade descarte, origem/sítio/data e inverso, sem operação", () => {
    for (const prova of ["m.origem<>'PERDA'", 'm."operacaoId" IS NOT NULL', "finalidade='DESCARTE'", 'q<>d."quantidadeLitros"', 'inv."reversaoDeId"<>m.id', 'DEFERRABLE INITIALLY DEFERRED', "Perda leiteira exige fato de descarte rastreado"])
      expect(sql).toContain(prova);
  });
});
