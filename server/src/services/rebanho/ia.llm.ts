// Camada LLM da IA do rebanho — só roda quando há OPENAI_API_KEY.
// Usa o SDK oficial `openai` (mesmo provider do bot). O contexto do rebanho vai no system prompt.

import OpenAI from "openai";

export async function responderComLLM(
  pergunta: string,
  contextoTexto: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content:
          "Você é o assistente da Fazenda Rio Novo (gado leiteiro). Responda em PT-BR, " +
          "de forma concisa e direta, usando SOMENTE os dados do contexto abaixo. Se a resposta " +
          "não estiver no contexto, diga que não tem esse dado.\n\n=== CONTEXTO DO REBANHO ===\n" +
          contextoTexto,
      },
      { role: "user", content: pergunta },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
