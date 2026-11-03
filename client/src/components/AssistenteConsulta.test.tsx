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
function clicarAcao(nome: string) {
  if (!screen.queryByRole("button", { name: nome })) fireEvent.click(screen.getByText("Consultas e guias"));
  fireEvent.click(screen.getByRole("button", { name: nome }));
}
it("prioriza a conversa e mantém consultas e guias em um catálogo recolhido", async () => {
  vi.mocked(obterConfiguracaoAssistente).mockResolvedValue({ ...config, consultas: ["resumo", "saldo", "pagar", "receber", "despesas_categoria"] });
  render(<AssistenteConsulta />); await abrir();
  const catalogo = screen.getByRole("button", { name: "Consultas e guias" });
  expect(catalogo.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Registrar uma compra a prazo" })).toBeNull();
  fireEvent.click(catalogo);
  expect(catalogo.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("button", { name: "A pagar no mês" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Registrar uma compra a prazo" })).toBeTruthy();
  expect(consultarAssistente).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "A pagar no mês" }));
  await screen.findByText("Entradas: R$ 100,00");
  expect(catalogo.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(catalogo);
});
it("consulta rápida usa os dados reais e a fonte conserva período", async () => {
  render(<AssistenteConsulta />); await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Resumo do mês" }));
  await screen.findByText("Entradas: R$ 100,00");
  expect(consultarAssistente).toHaveBeenCalledWith({ consulta: { visao: "resumo", inicio: null, fim: null } }, expect.any(AbortSignal));
  expect(screen.getByText("Conferir fontes").closest("details")!.open).toBe(false);
  fireEvent.click(screen.getByText("Conferir fontes"));
  fireEvent.click(screen.getByRole("button", { name: "Conferir setembro" }));
  expect(navegarPara).toHaveBeenCalledWith(resposta.fontes[0].url);
});
it("funciona sem chave com guias e consultas, mas informa indisponibilidade da conversa livre", async () => {
  vi.mocked(obterConfiguracaoAssistente).mockResolvedValue({ ...config, conversaDisponivel: false, consultas: [...config.consultas] });
  render(<AssistenteConsulta />); await abrir();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
  expect(screen.getByText(/conversa com IA ainda não está configurada/)).toBeTruthy();
  clicarAcao("Registrar uma compra a prazo");
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
  clicarAcao("Saldo atual");
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
  clicarAcao("Saldo atual");
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
it("separa conversa por voz de ditado e informa o processamento da resposta falada", async () => {
  render(<AssistenteConsulta />); await abrir();
  expect(screen.getByRole("button", { name: "Gravar áudio" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Conversar por voz" }));
  expect(screen.getByText("Vamos conversar?")).toBeTruthy();
  expect(screen.getByText(/respostas faladas.*OpenAI/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Iniciar conversa" })).toBeTruthy();
  expect(consultarAssistente).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Conversa por texto" }));
  expect(screen.getByRole("textbox")).toBeTruthy();
});
it("revogação da sessão também remove respostas já exibidas", async () => {
  render(<AssistenteConsulta />); await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Resumo do mês" }));
  await screen.findByText("Entradas: R$ 100,00");
  vi.mocked(consultarAssistente).mockRejectedValueOnce(Object.assign(new Error("Autentique-se novamente"), { status: 401 }));
  clicarAcao("Saldo atual");
  await screen.findByText("Autentique-se novamente");
  expect(screen.queryByText("Entradas: R$ 100,00")).toBeNull();
});
it("mostra o modo de voz sem configuração, com início bloqueado e motivo explícito", async () => {
  vi.mocked(obterConfiguracaoAssistente).mockResolvedValue({ ...config, conversaDisponivel: false, consultas: [...config.consultas] });
  render(<AssistenteConsulta />); await abrir();
  const modo = screen.getByRole("button", { name: "Conversar por voz" }) as HTMLButtonElement;
  expect(modo.disabled).toBe(false);
  fireEvent.click(modo);
  expect(screen.getByText(/conversa por voz ainda não está configurada/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Iniciar conversa" }) as HTMLButtonElement).disabled).toBe(true);
  expect(consultarAssistente).not.toHaveBeenCalled();
});
it("conversa ativa permite silenciar e encerrar sem confundir com ditado", async () => {
  const stop = vi.fn(); const close = vi.fn(async () => {});
  const track = { stop, enabled: true };
  const anterior = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) } });
  vi.stubGlobal("MediaRecorder", class {
    static isTypeSupported() { return true; }
    state = "inactive"; mimeType = "audio/webm"; start() { this.state = "recording"; } stop() { this.state = "inactive"; }
  });
  vi.stubGlobal("AudioContext", class {
    resume() { return Promise.resolve(); } close = close;
    createMediaStreamSource() { return { connect() {} }; }
    createAnalyser() { return { fftSize: 512, getFloatTimeDomainData(b: Float32Array) { b.fill(0); } }; }
  });
  try {
    render(<AssistenteConsulta />); await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Conversar por voz" }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar conversa" }));
    await screen.findByText("Pode falar");
    fireEvent.click(screen.getByRole("button", { name: "Silenciar microfone" }));
    expect(track.enabled).toBe(false);
    expect(screen.getByRole("button", { name: "Ativar microfone" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    await screen.findByRole("button", { name: "Iniciar conversa" });
    expect(stop).toHaveBeenCalled(); expect(close).toHaveBeenCalled();
    expect(consultarAssistente).not.toHaveBeenCalled();
  } finally {
    cleanup(); vi.unstubAllGlobals();
    if (anterior) Object.defineProperty(navigator, "mediaDevices", anterior);
    else Reflect.deleteProperty(navigator, "mediaDevices");
  }
});
