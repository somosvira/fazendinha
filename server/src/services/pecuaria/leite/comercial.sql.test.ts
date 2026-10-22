import { readFileSync } from "node:fs";
import { expect,it } from "vitest";
const sql=readFileSync(new URL("../../../../prisma/migrations/20261020070000_comercial_leite/migration.sql",import.meta.url),"utf8");
it("contrato estrutural SQL de entrega/demonstrativo — não substitui PostgreSQL real",()=>{
 for(const t of ["EntregaLeite","ConferenciaEntregaLeite","ComprovanteEntregaLeite"]) expect(sql).toContain(`"${t}_imutavel" BEFORE UPDATE OR DELETE`);
 expect(sql).toContain('CREATE UNIQUE INDEX "EntregaLeite_retiradaId_key"');
 expect(sql).toContain('pg_advisory_xact_lock');
 expect(sql).toContain('q>maximo OR val>v."valorTotal"');
 expect(sql).toContain('a."versaoVendaId"<>v.id');
 expect(sql).toContain('c."volumeAceito" IS NULL AND COALESCE(length(trim(a."motivoAceitePendente")),0)<5');
 expect(sql).toContain('parcelas não conciliam totais declarados');
 expect(sql).toContain('histórico comercial não pode ser apagado');
 expect(sql).toContain('"Operacao_demonstrativo_leite_guard" AFTER INSERT OR UPDATE');
 expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
 expect(sql).not.toContain('UPDATE public."MovimentoEstoque"');
 expect(sql).not.toContain('INSERT INTO public."TransacaoFinanceira"');
});
