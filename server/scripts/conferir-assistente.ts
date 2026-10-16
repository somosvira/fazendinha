// Conciliação somente de leitura, sem OpenAI e sem criar/alterar fixtures.
import { Prisma } from "@prisma/client";
import { env } from "../src/env.js";
import { prisma } from "../src/db.js";
import { normalizarConsulta } from "../src/services/bot/consulta.schema.js";
import { executarConsultaFinanceira } from "../src/services/bot/financeiro.js";

async function main() {
  const url = new URL(env.DATABASE_URL);
  if (url.pathname !== "/fazendinha_seedatev3" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("A conferência exige o banco local fazendinha_seedatev3.");
  const ultima = await prisma.transacaoFinanceira.aggregate({ _max: { data: true } });
  if (!ultima._max.data) throw new Error("Não há transações para conferir.");
  const fim = ultima._max.data.toISOString().slice(0, 10);
  const inicio = `${fim.slice(0, 7)}-01`;
  const de = new Date(`${inicio}T00:00:00Z`); const ate = new Date(`${fim}T23:59:59.999Z`);
  const linhas = await prisma.$queryRaw<{ entradas: Prisma.Decimal; saidas: Prisma.Decimal }[]>(Prisma.sql`
    WITH fatos AS (
      SELECT m.valor,
        CASE WHEN t.tipo = 'REVERSAO' THEN -1 ELSE 1 END AS sinal,
        CASE WHEN t.tipo = 'REVERSAO' THEN m.direcao = 'SAIDA' ELSE m.direcao = 'ENTRADA' END AS entrada
      FROM "MovimentoConta" m JOIN "TransacaoFinanceira" t ON t.id = m."transacaoId"
      LEFT JOIN "TransacaoFinanceira" original ON original.id = t."reversaoDeId"
      WHERE t.data BETWEEN ${de} AND ${ate} AND t.status IN ('CONFIRMADA', 'REVERTIDA')
        AND COALESCE(original.tipo, t.tipo) <> 'TRANSFERENCIA'
    ) SELECT COALESCE(SUM(valor * sinal) FILTER (WHERE entrada), 0) AS entradas,
      COALESCE(SUM(valor * sinal) FILTER (WHERE NOT entrada), 0) AS saidas FROM fatos`);
  const base = { assunto: "resumo", inicio, fim, compararInicio: null, compararFim: null, categoria: null };
  const resposta = await executarConsultaFinanceira(normalizarConsulta(base), null);
  const esperado = [linhas[0].entradas, linhas[0].saidas, linhas[0].entradas.minus(linhas[0].saidas)];
  resposta.valores.forEach((v, i) => { if (!new Prisma.Decimal(v.valor).equals(esperado[i])) throw new Error(`Divergência de caixa em ${v.rotulo}`); });
  for (const [assunto, tipo] of [["pagar", "PAGAR"], ["receber", "RECEBER"]] as const) {
    const [gabarito] = await prisma.$queryRaw<{ total: Prisma.Decimal }[]>(Prisma.sql`
      SELECT COALESCE(SUM(c."valorOriginal" - COALESCE(p.pago, 0)), 0) AS total
      FROM "CompromissoFinanceiro" c LEFT JOIN LATERAL (
        SELECT SUM(l.valor) AS pago FROM "Liquidacao" l
        JOIN "TransacaoFinanceira" t ON t.id = l."transacaoId"
        WHERE l."compromissoId" = c.id AND t.status = 'CONFIRMADA'
      ) p ON TRUE WHERE c.status IN ('PENDENTE', 'PARCIAL') AND c.tipo::text = ${tipo}`);
    const r = await executarConsultaFinanceira(normalizarConsulta({ ...base, assunto, inicio: null, fim: null }), null);
    if (!new Prisma.Decimal(r.valores[0].valor).equals(gabarito.total)) throw new Error(`Divergência nas pendências: ${assunto}`);
  }
  console.log(JSON.stringify({ banco: "fazendinha_seedatev3", periodo: { inicio, fim }, caixa: "conciliado com SQL independente", pendencias: "conciliadas com SQL independente", escrita: false, openai: false }));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Falha na conferência"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
