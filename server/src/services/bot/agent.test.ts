import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ create: vi.fn(), responder: vi.fn() }));
vi.mock("./openai.js", () => ({ criarClienteOpenAI: () => ({ chat: { completions: { create: m.create } } }), BotDesligadoError: class extends Error {} }));
vi.mock("./financeiro.js", () => ({ responderConsulta: m.responder }));
import { consultarAssistente } from "./agent.js";
const consulta = { assunto: "saidas" as const, inicio: "2026-09-01", fim: "2026-09-30", compararInicio: null, compararFim: null, categoria: null };
beforeEach(() => { vi.clearAllMocks(); m.create.mockResolvedValue({ choices: [{ finish_reason: "tool_calls", message: { tool_calls: [{ type: "function", function: { name: "consultar_financeiro", arguments: JSON.stringify(consulta) } }] } }] }); m.responder.mockResolvedValue({ resposta: "Calculado no servidor" }); });
it("só interpreta uma vez e deixa toda a resposta ao servidor", async () => {
  const resposta = await consultarAssistente("Quanto gastei?", null, 7);
  expect(m.create).toHaveBeenCalledTimes(1);
  expect(m.responder).toHaveBeenCalledWith(consulta, 7);
  expect(resposta.resposta).toBe("Calculado no servidor");
  const request = m.create.mock.calls[0][0];
  expect(request.tools[0].function.strict).toBe(true);
  expect(request.parallel_tool_calls).toBe(false);
});
it("preserva contexto somente no mesmo sítio", async () => {
  await consultarAssistente("E no mês anterior?", { propriedadeId: 7, consulta }, 7);
  expect(JSON.parse(m.create.mock.calls[0][0].messages[1].content).consultaAnterior).toEqual(consulta);
  await consultarAssistente("E no mês anterior?", { propriedadeId: 7, consulta }, 8);
  expect(JSON.parse(m.create.mock.calls[1][0].messages[1].content).consultaAnterior).toBeNull();
});
it.each(["stop", "length"])("recusa texto livre ou saída incompleta (%s)", async finish_reason => {
  m.create.mockResolvedValue({ choices: [{ finish_reason, message: { content: "Você lucrou R$ 999 mil" } }] });
  await expect(consultarAssistente("Quanto lucrei?", null, 7)).rejects.toThrow("interpretar");
  expect(m.responder).not.toHaveBeenCalled();
});
