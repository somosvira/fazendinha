// Camada LLM da IA da lavoura — só roda quando há ANTHROPIC_API_KEY.
// Espelha rebanho/ia.llm.ts: usa o SDK oficial @anthropic-ai/sdk (nunca fetch
// cru). Modelo default claude-opus-4-8, thinking adaptativo, sem prefill. O
// contexto da lavoura vai no system prompt.

import Anthropic from "@anthropic-ai/sdk";

export async function responderComLLM(
  pergunta: string,
  contextoTexto: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system:
      "Você é Caatinga, assistente agronômico da Fazenda Rio Novo (lavoura de café arábica no Sul de Minas). " +
      "Responda em PT-BR, de forma concisa e direta, usando SOMENTE os dados do contexto abaixo. Se a resposta " +
      "não estiver no contexto, diga que não tem esse dado.\n\n=== CONTEXTO DA LAVOURA ===\n" +
      contextoTexto,
    messages: [{ role: "user", content: pergunta }],
  });
  return msg.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}
