// Bateria de regressão da IA (assistente suspenso; ver ARCHITECTURE.md): dispara
// as perguntas contra POST /api/bot/ask (stateless, sem sessão) e grava as
// respostas para comparar com o gabarito (bateria-ia.gabarito.ts, mesmos ids).
// Requer o server de pé e OPENAI_API_KEY configurada.
// Rodar: pnpm --filter rionovo-server run bateria:run [saida.json]
// URL do bot: env BOT_URL (default http://localhost:41873).
import { writeFileSync } from "node:fs";

const BOT_URL = process.env.BOT_URL ?? "http://localhost:41873";

const PERGUNTAS: [string, string][] = [
  ["A1", "Quais foram as entradas e saídas totais de 2025, e o saldo do ano?"],
  ["A2", "Quais foram as 5 maiores categorias de gasto em abril de 2026?"],
  ["A3", "Quanto gastamos com Ração em 2025?"],
  ["A4", "Qual a maior categoria de gasto de 2026 até agora?"],
  ["A5", "Quantos lançamentos liquidados temos no histórico todo?"],
  ["A6", "Quanto já pagamos no total para a Agropecuária Lafeni em todo o histórico?"],
  ["A7", "Como se distribuíram os gastos de 2025 por centro de custo?"],
  ["A8", "Qual foi o valor médio por pagamento dos débitos de março de 2026?"],
  ["B1", "Quanto temos a pagar em aberto no total?"],
  ["B2", "Quanto vence em agosto de 2026?"],
  ["B3", "Temos algum valor a receber em aberto?"],
  ["C1", "Quanto subiu o gasto com curral em 2026 comparado a 2025, em reais e em percentual?"],
  ["C2", "Compare as saídas de fevereiro de 2026 com janeiro de 2026."],
  ["C3", "O gasto com ração de 2025 cresceu quanto em relação a 2024?"],
  ["C4", "Em 2025, quanto gastamos na atividade leiteira vs no plantio de café?"],
  ["D1", "Qual foi o mês de maior saída em 2025?"],
  ["D2", "Qual a média mensal de saídas em 2025?"],
  ["D3", "Mostre as saídas mês a mês do primeiro trimestre de 2026."],
  ["D4", "Qual foi o mês de menor saída em 2026?"],
  ["G1", "Qual foi o total da folha de salários de abril de 2026 e quantas pessoas receberam?"],
  ["G2", "Qual o saldo atual de cada conta bancária?"],
  ["G3", "Quanto temos de Ração Lactação Alta em estoque?"],
  ["H1", "Qual a previsão do preço do leite para 2027?"],
  ["H2", "Qual o telefone do fornecedor MAGC?"],
  ["H3", "Se eu dobrar o rebanho, quanto vou lucrar a mais por mês?"],
];

async function main() {
  const out: Record<string, unknown>[] = [];
  for (const [id, pergunta] of PERGUNTAS) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BOT_URL}/api/bot/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta }),
      });
      const j = (await res.json()) as { resposta?: string; toolsUsadas?: string[]; erro?: string };
      out.push({ id, pergunta, resposta: j.resposta ?? j.erro, toolsUsadas: j.toolsUsadas ?? [], ms: Date.now() - t0 });
      console.log(`${id} ok (${Date.now() - t0}ms) [${(j.toolsUsadas ?? []).join(",")}]`);
    } catch (e) {
      out.push({ id, pergunta, resposta: `ERRO: ${e}`, toolsUsadas: [], ms: Date.now() - t0 });
      console.log(`${id} ERRO`);
    }
  }
  writeFileSync(process.argv[2] ?? "bateria-respostas.json", JSON.stringify(out, null, 2));
  process.exit(0);
}
main();
