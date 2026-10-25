import { contemSql } from "../../../test/sql-baseline.js";
import { readFileSync } from "node:fs";
import { expect,it } from "vitest";
const sql=readFileSync(new URL("../../../../prisma/migrations/20261025000000_base_unificada/migration.sql",import.meta.url),"utf8");
it("contrato estrutural SQL de entrega/demonstrativo — não substitui PostgreSQL real",()=>{
 for(const t of ["EntregaLeite","ConferenciaEntregaLeite","ComprovanteEntregaLeite"]) expect(contemSql(sql, `"${t}_imutavel" BEFORE UPDATE OR DELETE`)).toBe(true);
 expect(contemSql(sql, 'CREATE UNIQUE INDEX "EntregaLeite_retiradaId_key"')).toBe(true);
 expect(contemSql(sql, 'pg_advisory_xact_lock')).toBe(true);
 expect(contemSql(sql, 'q>maximo OR val>v."valorTotal"')).toBe(true);
 expect(contemSql(sql, 'a."versaoVendaId"<>v.id')).toBe(true);
 expect(contemSql(sql, 'c."volumeAceito" IS NULL AND COALESCE(length(trim(a."motivoAceitePendente")),0)<5')).toBe(true);
 expect(contemSql(sql, 'parcelas não conciliam totais declarados')).toBe(true);
 expect(contemSql(sql, 'histórico comercial não pode ser apagado')).toBe(true);
 expect(contemSql(sql, '"Operacao_demonstrativo_leite_guard" AFTER INSERT OR UPDATE')).toBe(true);
 expect(contemSql(sql, 'DEFERRABLE INITIALLY DEFERRED')).toBe(true);
 expect(contemSql(sql, 'UPDATE public."MovimentoEstoque"')).toBe(false);
 expect(contemSql(sql, 'INSERT INTO public."TransacaoFinanceira"')).toBe(false);
});
