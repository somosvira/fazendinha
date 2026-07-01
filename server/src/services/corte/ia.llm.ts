// Camada LLM da IA do corte — só roda quando há OPENAI_API_KEY.
// Usa o SDK oficial `openai` (mesmo provider do bot). O contexto do plantel vai no system prompt.

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
          "Você é o assistente de pecuária de corte da Fazenda Rio Novo (gado de corte, " +
          "ciclo cria-recria-terminação, Sul de Minas). Responda em PT-BR, de forma concisa e " +
          "direta, usando SOMENTE os dados do contexto abaixo (lotes, GMD, @, sanidade, custo). " +
          "Não invente números; se a resposta não estiver no contexto, diga que não tem esse dado.\n\n" +
          "=== CONTEXTO DO PLANTEL DE CORTE ===\n" +
          contextoTexto,
      },
      { role: "user", content: pergunta },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}
