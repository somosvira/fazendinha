import OpenAI from "openai";
import { env } from "../../env.js";

export class BotDesligadoError extends Error {
  constructor() { super("O assistente ainda não foi configurado. Peça ao responsável para configurar a chave da OpenAI no servidor."); }
}

export function criarClienteOpenAI() {
  if (!env.OPENAI_API_KEY?.trim()) throw new BotDesligadoError();
  return new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 0 });
}
