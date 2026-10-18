// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ status: vi.fn(), consultar: vi.fn(), transcrever: vi.fn() }));
vi.mock("../api/assistente", () => ({ statusAssistente: m.status, consultarAssistente: m.consultar, transcreverAudio: m.transcrever }));
import { IA } from "./IA";
const contexto = { propriedadeId: 1, consulta: { assunto: "saidas", inicio: "2026-09-01", fim: "2026-09-30", compararInicio: null, compararFim: null, categoria: null } };
beforeEach(() => { vi.clearAllMocks(); m.status.mockResolvedValue({ configurado: true }); m.consultar.mockResolvedValue({ resposta: "Saídas de caixa: R$ 300,00", fontes: [{ titulo: "Conferir no Financeiro", url: "/financeiro?inicio=2026-09-01&fim=2026-09-30" }], contexto }); m.transcrever.mockResolvedValue({ texto: "Quanto saiu este mês?" }); });
afterEach(cleanup);
async function preparar() { render(<IA />); await waitFor(() => expect((screen.getByLabelText("O que você quer saber?") as HTMLTextAreaElement).disabled).toBe(false)); }
async function enviar(texto: string) { fireEvent.change(screen.getByLabelText("O que você quer saber?"), { target: { value: texto } }); fireEvent.click(screen.getByRole("button", { name: "Perguntar" })); await screen.findAllByText("Saídas de caixa: R$ 300,00"); }
it("consulta, continua no mesmo contexto e limpa em nova conversa", async () => {
  await preparar(); await enviar("Quanto saiu?");
  expect(m.consultar).toHaveBeenLastCalledWith("Quanto saiu?", null, expect.any(AbortSignal));
  await enviar("E no mês passado?");
  expect(m.consultar).toHaveBeenLastCalledWith("E no mês passado?", contexto, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole("button", { name: "Nova conversa" }));
  expect(screen.queryByText("Saídas de caixa: R$ 300,00")).toBeNull();
  await enviar("Qual o saldo?"); expect(m.consultar).toHaveBeenLastCalledWith("Qual o saldo?", null, expect.any(AbortSignal));
});
it("áudio é transcrito e revisado antes de consultar", async () => {
  await preparar();
  const file = new File(["som"], "pergunta.webm", { type: "audio/webm" });
  fireEvent.change(screen.getByLabelText("Arquivo de áudio"), { target: { files: [file] } });
  await screen.findByText(/Confira o que eu ouvi/);
  expect((screen.getByLabelText("O que você quer saber?") as HTMLTextAreaElement).value).toBe("Quanto saiu este mês?");
  expect(m.consultar).not.toHaveBeenCalled();
  await enviar("Quanto saiu no mês passado?");
  expect(m.consultar).toHaveBeenCalledWith("Quanto saiu no mês passado?", null, expect.any(AbortSignal));
});
it("indisponibilidade não exibe dados demonstrativos", async () => {
  m.status.mockResolvedValue({ configurado: false }); render(<IA />);
  await screen.findByText(/ainda precisa ser configurado/);
  expect((screen.getByRole("button", { name: "Perguntar" }) as HTMLButtonElement).disabled).toBe(true);
  expect(m.consultar).not.toHaveBeenCalled();
});
it("ignora resposta antiga depois de reiniciar a conversa", async () => {
  let resolver!: (valor: unknown) => void;
  m.consultar.mockReturnValue(new Promise(r => { resolver = r; }));
  await preparar(); fireEvent.change(screen.getByLabelText("O que você quer saber?"), { target: { value: "Quanto saiu?" } });
  fireEvent.click(screen.getByRole("button", { name: "Perguntar" }));
  fireEvent.click(screen.getByRole("button", { name: "Nova conversa" }));
  await act(async () => resolver({ resposta: "Resposta antiga", fontes: [], contexto }));
  expect(screen.queryByText("Resposta antiga")).toBeNull();
});
