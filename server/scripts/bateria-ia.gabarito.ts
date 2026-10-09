// Gabarito da bateria de regressão da IA (assistente suspenso; ver ARCHITECTURE.md):
// calcula cada valor esperado DIRETO no Postgres (SQL cru, independente do motor
// de consulta e dos where do Prisma). Recalcula sozinho — sobrevive a mudanças
// de dados. Rodar: pnpm --filter rionovo-server run bateria:gabarito [saida.json]
// As perguntas correspondentes estão em bateria-ia.run.ts (mesmos ids).
import { writeFileSync } from "node:fs";
import { prisma } from "../src/db.js";

const q = (s: string) => prisma.$queryRawUnsafe<Record<string, unknown>[]>(s);

// Regime de caixa: LIQUIDADO + estornado=false, por dataLiquidacao.
const CAIXA = `l.situacao='LIQUIDADO' AND l.estornado=false`;

async function main() {
  const g: Record<string, unknown> = {};

  // ── A. Financeiro realizado ──
  g.A1_fluxo_2025 = await q(`
    SELECT l.natureza, COUNT(*)::int n, ROUND(SUM(l.valor),2)::float total
    FROM "Lancamento" l WHERE ${CAIXA} AND l."dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31'
    GROUP BY 1 ORDER BY 1`);
  g.A2_abr26_categorias = await q(`
    SELECT c.nome categoria, ROUND(SUM(l.valor),2)::float total, COUNT(*)::int n
    FROM "Lancamento" l JOIN "Categoria" c ON c.id=l."categoriaId"
    WHERE ${CAIXA} AND l.natureza='DEBITO' AND l."dataLiquidacao" BETWEEN '2026-04-01' AND '2026-04-30'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 5`);
  g.A3_racao_2025 = await q(`
    SELECT ROUND(SUM(l.valor),2)::float total, COUNT(*)::int n
    FROM "Lancamento" l JOIN "Categoria" c ON c.id=l."categoriaId"
    WHERE ${CAIXA} AND l.natureza='DEBITO' AND c.nome='Ração' AND l."dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31'`);
  g.A4_maior_categoria_2026 = await q(`
    SELECT c.nome categoria, ROUND(SUM(l.valor),2)::float total
    FROM "Lancamento" l JOIN "Categoria" c ON c.id=l."categoriaId"
    WHERE ${CAIXA} AND l.natureza='DEBITO' AND l."dataLiquidacao">='2026-01-01'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 3`);
  g.A5_total_liquidados = await q(`SELECT COUNT(*)::int n FROM "Lancamento" l WHERE ${CAIXA}`);
  g.A6_lafeni_historico = await q(`
    SELECT ROUND(SUM(l.valor),2)::float total, COUNT(*)::int n
    FROM "Lancamento" l JOIN "ClienteFornecedor" cf ON cf.id=l."clienteFornecedorId"
    WHERE ${CAIXA} AND l.natureza='DEBITO' AND cf.nome ILIKE '%lafeni%'`);
  g.A7_centro_custo_2025 = await q(`
    SELECT cc.nome, ROUND(SUM(l.valor),2)::float total
    FROM "Lancamento" l JOIN "CentroCusto" cc ON cc.id=l."centroCustoId"
    WHERE ${CAIXA} AND l.natureza='DEBITO' AND l."dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31'
    GROUP BY 1 ORDER BY 2 DESC`);
  g.A8_media_pagamento_mar26 = await q(`
    SELECT COUNT(*)::int n, ROUND(AVG(l.valor),2)::float media, ROUND(SUM(l.valor),2)::float total
    FROM "Lancamento" l WHERE ${CAIXA} AND l.natureza='DEBITO' AND l."dataLiquidacao" BETWEEN '2026-03-01' AND '2026-03-31'`);

  // ── B. A vencer ──
  g.B1_a_pagar_total = await q(`
    SELECT COUNT(*)::int n, ROUND(SUM(valor),2)::float total FROM "Lancamento"
    WHERE situacao='ABERTO' AND estornado=false AND natureza='DEBITO'`);
  g.B2_vence_ago26 = await q(`
    SELECT COUNT(*)::int n, ROUND(SUM(valor),2)::float total FROM "Lancamento"
    WHERE situacao='ABERTO' AND estornado=false AND natureza='DEBITO' AND "dataVencimento" BETWEEN '2026-08-01' AND '2026-08-31'`);
  g.B3_a_receber = await q(`
    SELECT COUNT(*)::int n, ROUND(SUM(valor),2)::float total FROM "Lancamento"
    WHERE situacao='ABERTO' AND estornado=false AND natureza='CREDITO'`);

  // ── C. Comparações (delta calculado no SQL) ──
  g.C1_curral_2026_vs_2025 = await q(`
    WITH a AS (SELECT SUM(l.valor) t FROM "Lancamento" l JOIN "Categoria" c ON c.id=l."categoriaId"
      WHERE ${CAIXA} AND l.natureza='DEBITO' AND c.nome ILIKE '%curral%' AND l."dataLiquidacao" BETWEEN '2026-01-01' AND '2026-12-31'),
    b AS (SELECT SUM(l.valor) t FROM "Lancamento" l JOIN "Categoria" c ON c.id=l."categoriaId"
      WHERE ${CAIXA} AND l.natureza='DEBITO' AND c.nome ILIKE '%curral%' AND l."dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31')
    SELECT ROUND(a.t,2)::float a2026, ROUND(b.t,2)::float a2025, ROUND(a.t-b.t,2)::float delta,
           ROUND((a.t-b.t)/b.t*100,2)::float delta_pct FROM a,b`);
  g.C2_fev26_vs_jan26_saidas = await q(`
    WITH a AS (SELECT SUM(valor) t FROM "Lancamento" l WHERE ${CAIXA} AND natureza='DEBITO' AND "dataLiquidacao" BETWEEN '2026-02-01' AND '2026-02-28'),
    b AS (SELECT SUM(valor) t FROM "Lancamento" l WHERE ${CAIXA} AND natureza='DEBITO' AND "dataLiquidacao" BETWEEN '2026-01-01' AND '2026-01-31')
    SELECT ROUND(a.t,2)::float fev, ROUND(b.t,2)::float jan, ROUND(a.t-b.t,2)::float delta, ROUND((a.t-b.t)/b.t*100,2)::float delta_pct FROM a,b`);
  g.C3_racao_2025_vs_2024 = await q(`
    WITH a AS (SELECT SUM(l.valor) t FROM "Lancamento" l JOIN "Categoria" c ON c.id=l."categoriaId"
      WHERE ${CAIXA} AND l.natureza='DEBITO' AND c.nome='Ração' AND l."dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31'),
    b AS (SELECT SUM(l.valor) t FROM "Lancamento" l JOIN "Categoria" c ON c.id=l."categoriaId"
      WHERE ${CAIXA} AND l.natureza='DEBITO' AND c.nome='Ração' AND l."dataLiquidacao" BETWEEN '2024-01-01' AND '2024-12-31')
    SELECT ROUND(a.t,2)::float a2025, ROUND(b.t,2)::float a2024, ROUND(a.t-b.t,2)::float delta, ROUND((a.t-b.t)/b.t*100,2)::float delta_pct FROM a,b`);
  g.C4_leiteira_vs_cafe_2025 = await q(`
    SELECT cc.nome, ROUND(SUM(l.valor),2)::float total
    FROM "Lancamento" l JOIN "CentroCusto" cc ON cc.id=l."centroCustoId"
    WHERE ${CAIXA} AND l.natureza='DEBITO' AND l."dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31'
      AND (cc.nome ILIKE '%leiteira%' OR cc.nome ILIKE '%café%')
    GROUP BY 1 ORDER BY 2 DESC`);

  // ── D. Séries / estatística ──
  g.D1_mes_maior_saida_2025 = await q(`
    SELECT to_char("dataLiquidacao",'YYYY-MM') mes, ROUND(SUM(valor),2)::float saidas
    FROM "Lancamento" l WHERE ${CAIXA} AND natureza='DEBITO' AND "dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 2`);
  g.D2_media_mensal_saidas_2025 = await q(`
    WITH m AS (SELECT to_char("dataLiquidacao",'YYYY-MM') mes, SUM(valor) t
      FROM "Lancamento" l WHERE ${CAIXA} AND natureza='DEBITO' AND "dataLiquidacao" BETWEEN '2025-01-01' AND '2025-12-31' GROUP BY 1)
    SELECT COUNT(*)::int meses, ROUND(AVG(t),2)::float media_mensal FROM m`);
  g.D3_saidas_tri1_2026 = await q(`
    SELECT to_char("dataLiquidacao",'YYYY-MM') mes, ROUND(SUM(valor),2)::float saidas
    FROM "Lancamento" l WHERE ${CAIXA} AND natureza='DEBITO' AND "dataLiquidacao" BETWEEN '2026-01-01' AND '2026-03-31'
    GROUP BY 1 ORDER BY 1`);
  g.D4_meses_2026_saidas = await q(`
    SELECT to_char("dataLiquidacao",'YYYY-MM') mes, ROUND(SUM(valor),2)::float saidas
    FROM "Lancamento" l WHERE ${CAIXA} AND natureza='DEBITO' AND "dataLiquidacao">='2026-01-01'
    GROUP BY 1 ORDER BY 2 ASC`);

  // ── G. Outros módulos ──
  // Semântica da tool folha_pagamento: débitos realizados com busca='salário'
  // (categoria OU grupo OU centro de custo contendo o termo), agrupados por pessoa.
  g.G1_folha_abr26 = await q(`
    SELECT COUNT(DISTINCT COALESCE(cf.nome, l.descricao))::int pessoas, ROUND(SUM(l.valor),2)::float total
    FROM "Lancamento" l
    JOIN "Categoria" c ON c.id=l."categoriaId"
    JOIN "GrupoCategoria" gc ON gc.id=c."grupoCategoriaId"
    JOIN "CentroCusto" cc ON cc.id=l."centroCustoId"
    LEFT JOIN "ClienteFornecedor" cf ON cf.id=l."clienteFornecedorId"
    WHERE ${CAIXA} AND l.natureza='DEBITO' AND l."dataLiquidacao" BETWEEN '2026-04-01' AND '2026-04-30'
      AND (c.nome ILIKE '%salário%' OR gc.nome ILIKE '%salário%' OR cc.nome ILIKE '%salário%')`);
  g.G2_saldo_contas = await q(`
    SELECT cb.nome,
      ROUND(cb."saldoInicial" + COALESCE(SUM(CASE WHEN l.natureza='CREDITO' THEN l.valor ELSE -l.valor END),0),2)::float saldo
    FROM "ContaBancaria" cb LEFT JOIN "Lancamento" l
      ON l."contaBancariaId"=cb.id AND l.situacao='LIQUIDADO' AND l.estornado=false
    GROUP BY cb.id, cb.nome, cb."saldoInicial" ORDER BY 2 DESC`);
  g.G3_estoque_racao = await q(`
    SELECT pr.nome, pr.unidade,
      COALESCE(SUM(CASE WHEN m.tipo='ENTRADA' THEN m.quantidade WHEN m.tipo='SAIDA' THEN -m.quantidade ELSE m.quantidade END),0)::float saldo
    FROM "Produto" pr LEFT JOIN "MovimentoEstoque" m ON m."produtoId"=pr.id
    WHERE pr.nome ILIKE '%ração%' GROUP BY 1,2`);

  // ── H. Guard-rails ──
  g.H2_telefone_magc = await q(`SELECT nome, telefone, documento FROM "ClienteFornecedor" WHERE nome ILIKE '%MAGC%'`);

  writeFileSync(process.argv[2] ?? "bateria-gabarito.json", JSON.stringify(g, null, 2));
  console.log(JSON.stringify(g, null, 1));
  process.exit(0);
}
main();
