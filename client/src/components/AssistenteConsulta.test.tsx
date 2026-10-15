// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AssistenteConsulta } from "./AssistenteConsulta";
import { consultarAssistente, obterConfiguracaoAssistente, type RespostaAssistente } from "../api/assistente";
import { navegarPara } from "../router";
import { prepararPrint } from "../lib/midia-assistente";
vi.mock("../api/assistente", () => ({ consultarAssistente: vi.fn(), obterConfiguracaoAssistente: vi.fn(), transcreverAudioAssistente: vi.fn() }));
vi.mock("../lib/midia-assistente", () => ({ prepararPrint: vi.fn(), prepararAudio: vi.fn() }));
vi.mock("../router", () => ({ navegarPara: vi.fn() }));
const config = { conversaDisponivel: true, escopo: { propriedadeId: 7, nome: "Sítio teste" }, consultas: ["resumo", "saldo"] as const, artigos: [{ id: "financeiro-compra-prazo", titulo: "Registrar uma compra a prazo" }] };
const resposta: RespostaAssistente = { modo: "dados", resposta: "Entradas: R$ 100,00", fontes: [{ titulo: "Conferir setembro", url: "/financeiro?inicio=2026-09-01&fim=2026-09-30" }], consultadoEm: "2026-10-14T12:00:00Z", escopo: config.escopo };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(obterConfiguracaoAssistente).mockResolvedValue({ ...config, consultas: [...config.consultas] }); vi.mocked(consultarAssistente).mockResolvedValue(resposta); });
afterEach(cleanup);
async function abrir() { fireEvent.click(screen.getByRole("button", { name: "Abrir assistente do Terrano" })); await screen.findByRole("button", { name: "Resumo do mês" }); }
it("começa com duas consultas, permite expandir demais e mantém ajuda disponível", async () => {
  vi.mocked(obterConfiguracaoAssistente).mockResolvedValue({ ...config, consultas: ["resumo", "saldo", "pagar", "receber", "despesas_categoria"] });
  render(<AssistenteConsulta />); await abrir();
  const mais = screen.getByText("Mais consultas financeiras").closest("details")!;
  expect(mais.open).toBe(false);
  expect(screen.getByText("Guias de uso").closest("details")!.open).toBe(true);
  expect(screen.getByText(/somente dados permitidos ao seu perfil/)).toBeTruthy();
  fireEvent.click(mais.querySelector("summary")!);
  expect(mais.open).toBe(true);
  expect(screen.getByRole("button", { name: "A pagar no mês" })).toBeTruthy();
  expect(consultarAssistente).not.toHaveBeenCalled();
});
it("consulta rápida usa os dados reais e a fonte conserva período", async () => {
  render(<AssistenteConsulta />); await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Resumo do mês" }));
  await screen.findByText("Entradas: R$ 100,00");
  expect(consultarAssistente).toHaveBeenCalledWith({ consulta: { visao: "resumo", inicio: null, fim: null } }, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole("button", { name: "Conferir setembro" }));
  expect(navegarPara).toHaveBeenCalledWith(resposta.fontes[0].url);
});
it("funciona sem chave com guias e consultas, mas informa indisponibilidade da conversa livre", async () => {
  vi.mocked(obterConfiguracaoAssistente).mockResolvedValue({ ...config, conversaDisponivel: false, consultas: [...config.consultas] });
  render(<AssistenteConsulta />); await abrir();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
  expect(screen.getByText(/conversa com IA ainda não está configurada/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Registrar uma compra a prazo" }));
  await waitFor(() => expect(consultarAssistente).toHaveBeenCalledWith({ artigoId: "financeiro-compra-prazo" }, expect.any(AbortSignal)));
});
it("não envia respostas ou números do assistente no histórico e preserva follow-up", async () => {
  render(<AssistenteConsulta />); await abrir();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Como ficou setembro?" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));
  await screen.findByText("Entradas: R$ 100,00");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "E agosto?" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));
  await waitFor(() => expect(consultarAssistente).toHaveBeenLastCalledWith({ pergunta: "E agosto?", historico: ["Como ficou setembro?"], pagina: window.location.pathname }, expect.any(AbortSignal)));
  expect(JSON.stringify(vi.mocked(consultarAssistente).mock.calls[1][0])).not.toContain("100,00");
});
it("falha fica explícita e permite uma nova consulta", async () => {
  vi.mocked(consultarAssistente).mockRejectedValueOnce(new Error("Consulta indisponível"));
  render(<AssistenteConsulta />); await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Resumo do mês" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Consulta indisponível");
  expect(screen.queryByText("Entradas: R$ 100,00")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Saldo atual" }));
  await screen.findByText("Entradas: R$ 100,00");
});
it("trocar contexto desmonta, aborta a consulta anterior e não mistura respostas", async () => {
  let concluir!: (r: RespostaAssistente) => void;
  vi.mocked(consultarAssistente).mockReturnValueOnce(new Promise(resolve => { concluir = resolve; }));
  const tela = render(<AssistenteConsulta key="sitio-1" />); await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Resumo do mês" }));
  const signal = vi.mocked(consultarAssistente).mock.calls[0][1]!;
  tela.rerender(<AssistenteConsulta key="sitio-2" />);
  expect(signal.aborted).toBe(true);
  await act(async () => concluir(resposta));
  await abrir();
  expect(screen.queryByText("Entradas: R$ 100,00")).toBeNull();
});
it("uma negação limpa dados anteriores da conversa", async () => {
  render(<AssistenteConsulta />); await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Resumo do mês" }));
  await screen.findByText("Entradas: R$ 100,00");
  vi.mocked(consultarAssistente).mockResolvedValueOnce({ ...resposta, modo: "acesso_negado", resposta: "Acesso restrito", fontes: [] });
  fireEvent.click(screen.getByRole("button", { name: "Saldo atual" }));
  await screen.findByText("Acesso restrito");
  expect(screen.queryByText("Entradas: R$ 100,00")).toBeNull();
});
it("permite print com prévia/remover e só envia a imagem após confirmação da pergunta", async () => {
  const imagem = "data:image/jpeg;base64,fixture";
  vi.mocked(prepararPrint).mockResolvedValue(imagem);
  render(<AssistenteConsulta />); await abrir();
  const arquivo = new File(["fixture"], "print.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText("Selecionar print"), { target: { files: [arquivo] } });
  await screen.findByAltText("Prévia do print");
  expect(consultarAssistente).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remover print" }));
  expect(screen.queryByAltText("Prévia do print")).toBeNull();
  fireEvent.change(screen.getByLabelText("Selecionar print"), { target: { files: [arquivo] } });
  await screen.findByAltText("Prévia do print");
  fireEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));
  await waitFor(() => expect(consultarAssistente).toHaveBeenCalledWith(expect.objectContaining({ imagem, pergunta: "Explique esta tela ou campo do Terrano." }), expect.any(AbortSignal)));
});
it("recusa print inválido sem enviar requisição de IA", async () => {
  vi.mocked(prepararPrint).mockRejectedValue(new Error("Print inválido"));
  render(<AssistenteConsulta />); await abrir();
  fireEvent.change(screen.getByLabelText("Selecionar print"), { target: { files: [new File(["html"], "file.svg", { type: "image/svg+xml" })] } });
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Print inválido");
  expect(consultarAssistente).not.toHaveBeenCalled();
});
