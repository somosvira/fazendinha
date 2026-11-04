// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AssistenteConsulta } from "./AssistenteConsulta";
import * as api from "../api/assistente";
import { prepararPrint } from "../lib/midia-assistente";
import { navegarPara } from "../router";
vi.mock("../api/assistente", () => ({
  consultarAssistente: vi.fn(),
  consultarAssistenteComVoz: vi.fn(),
  obterConfiguracaoAssistente: vi.fn(),
  transcreverAudioAssistente: vi.fn(),
  confirmarPesagemAssistente: vi.fn(),
  salvarConversaAssistente: vi.fn(),
  listarConversasAssistente: vi.fn(),
  obterConversaAssistente: vi.fn(),
}));
vi.mock("../api/propriedades", () => ({
  listarPropriedades: vi.fn(async () => [
    { id: 7, nome: "São Francisco", ativo: true },
    { id: 8, nome: "Betânia", ativo: true },
  ]),
}));
vi.mock("../lib/midia-assistente", () => ({
  prepararPrint: vi.fn(),
  prepararAudio: vi.fn(),
}));
vi.mock("../router", () => ({ navegarPara: vi.fn() }));
const config = {
  conversaDisponivel: true,
  contextoHistorico: "fixture",
  podeEditar: true,
  escopo: { propriedadeId: 7, nome: "São Francisco" },
  consultas: ["resumo", "saldo"] as api.VisaoAssistente[],
  artigos: [{ id: "ajuda", titulo: "Registrar uma compra a prazo" }],
};
const resposta: api.RespostaAssistente = {
  modo: "dados",
  resposta: "Entradas: R$ 100,00",
  fontes: [
    {
      titulo: "Conferir setembro",
      url: "/financeiro?inicio=2026-09-01&fim=2026-09-30",
    },
  ],
  consultadoEm: "2026-10-14T12:00:00Z",
  escopo: config.escopo,
};
const proposta: api.RespostaAssistente = {
  ...resposta,
  modo: "proposta",
  resposta: "Confira os dados",
  fontes: [],
  proposta: {
    token: "assinado",
    animal: "1058 · Estrela",
    data: "2026-11-02",
    pesoKg: 450,
    tipo: "Rotina",
    origem: "Manual",
    precisao: "Não informada",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.obterConfiguracaoAssistente).mockResolvedValue(config);
  vi.mocked(api.consultarAssistente).mockResolvedValue(resposta);
  vi.mocked(api.salvarConversaAssistente).mockResolvedValue({
    salvo: true,
    revisao: 1,
  });
  vi.mocked(api.listarConversasAssistente).mockResolvedValue([]);
});
afterEach(cleanup);
async function abrir() {
  render(<AssistenteConsulta />);
  fireEvent.click(
    screen.getByRole("button", { name: "Abrir assistente do Terrano" }),
  );
  await screen.findByRole("button", { name: "Resumo do mês" });
}
function perguntar(texto: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));
}
it("inicia em Consultar, sem rótulos dispensados e com controles compactos", async () => {
  await abrir();
  expect(
    screen
      .getByRole("button", { name: "Consultar" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    screen.queryByText(/Somente consulta|Conversa não salva|Voz Cedar/),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Anexar" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Conversar por voz" }),
  ).toBeTruthy();
});
it("consulta e abre a fonte exata, removendo sugestões após começar", async () => {
  await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Resumo do mês" }));
  await screen.findByText(resposta.resposta);
  expect(screen.queryByRole("button", { name: "Resumo do mês" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Conferir setembro" }));
  expect(navegarPara).toHaveBeenCalledWith(resposta.fontes[0].url);
});
it("envia somente perguntas anteriores como contexto", async () => {
  await abrir();
  perguntar("Como ficou setembro?");
  await screen.findByText(resposta.resposta);
  perguntar("E agosto?");
  await waitFor(() =>
    expect(api.consultarAssistente).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pergunta: "E agosto?",
        historico: ["Como ficou setembro?"],
        modo: "consultar",
      }),
      expect.any(AbortSignal),
      null,
    ),
  );
  expect(
    JSON.stringify(vi.mocked(api.consultarAssistente).mock.calls[1][0]),
  ).not.toContain("100,00");
});
it("arrastar um print mostra prévia sem enviar, e o usuário pode remover", async () => {
  vi.mocked(prepararPrint).mockResolvedValue("data:image/jpeg;base64,fixture");
  await abrir();
  const arquivo = new File(["fixture"], "print.jpg", { type: "image/jpeg" });
  fireEvent.drop(screen.getByRole("dialog"), {
    dataTransfer: { files: [arquivo], types: ["Files"] },
  });
  await screen.findByAltText("Prévia do print");
  expect(api.consultarAssistente).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remover anexo" }));
  expect(screen.queryByAltText("Prévia do print")).toBeNull();
});
it("recusa documentos não suportados e múltiplos anexos", async () => {
  await abrir();
  const arquivo = new File(["exe"], "arquivo.exe");
  fireEvent.drop(screen.getByRole("dialog"), {
    dataTransfer: { files: [arquivo], types: ["Files"] },
  });
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Outros documentos"),
  );
  fireEvent.drop(screen.getByRole("dialog"), {
    dataTransfer: { files: [arquivo, arquivo], types: ["Files"] },
  });
  expect(await screen.findByText("Solte um arquivo por vez.")).toBeTruthy();
  expect(api.consultarAssistente).not.toHaveBeenCalled();
});
it("prepara em Editar, não grava sem confirmação e impede duplo clique", async () => {
  vi.mocked(api.consultarAssistente).mockResolvedValue(proposta);
  vi.mocked(api.confirmarPesagemAssistente).mockReturnValue(
    new Promise(() => {}),
  );
  await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  perguntar("Pese 1058 com 450 kg hoje");
  const confirmar = await screen.findByRole("button", {
    name: "Gravar pesagem",
  });
  expect(api.confirmarPesagemAssistente).not.toHaveBeenCalled();
  fireEvent.click(confirmar);
  fireEvent.click(confirmar);
  expect(api.confirmarPesagemAssistente).toHaveBeenCalledTimes(1);
});
it("trocar modo invalida a proposta pendente", async () => {
  vi.mocked(api.consultarAssistente).mockResolvedValue(proposta);
  await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  perguntar("Pese 1058");
  await screen.findByRole("button", { name: "Gravar pesagem" });
  fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
  expect(
    screen.queryByRole("button", { name: "Gravar pesagem" }),
  ).toBeNull();
  expect(api.confirmarPesagemAssistente).not.toHaveBeenCalled();
});
it("não libera Editar sem permissão e mantém guias sem chave", async () => {
  vi.mocked(api.obterConfiguracaoAssistente).mockResolvedValue({
    ...config,
    podeEditar: false,
    conversaDisponivel: false,
  });
  await abrir();
  expect(screen.getByRole("button", { name: "Editar" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByText("Guias de uso"));
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar uma compra a prazo" }),
  );
  await screen.findByText(resposta.resposta);
});
it("revogação limpa respostas anteriores e não apresenta resultado falso", async () => {
  await abrir();
  perguntar("Saldo?");
  await screen.findByText(resposta.resposta);
  vi.mocked(api.consultarAssistente).mockRejectedValueOnce(
    Object.assign(new Error("Autentique-se novamente"), { status: 401 }),
  );
  perguntar("E este mês?");
  await screen.findByText("Autentique-se novamente");
  expect(screen.queryByText(resposta.resposta)).toBeNull();
});
it("salva somente texto, sem anexo ou token de confirmação", async () => {
  vi.mocked(api.consultarAssistente).mockResolvedValue(proposta);
  await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  perguntar("Pese 1058");
  await screen.findByRole("button", { name: "Gravar pesagem" });
  await waitFor(() => expect(api.salvarConversaAssistente).toHaveBeenCalled());
  expect(
    JSON.stringify(vi.mocked(api.salvarConversaAssistente).mock.calls),
  ).not.toContain("assinado");
});
it("reabre conversa salva sem reativar proposta antiga", async () => {
  vi.mocked(api.listarConversasAssistente).mockResolvedValue([
    { id: "conversa", titulo: "Pesagem anterior", atualizadoEm: "2026-11-02" },
  ]);
  vi.mocked(api.obterConversaAssistente).mockResolvedValue({
    revisao: 1,
    mensagens: [{ pergunta: "Pesagem", resposta: proposta }],
  });
  await abrir();
  fireEvent.click(
    screen.getByRole("button", { name: "Histórico de conversas" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Pesagem anterior/ }),
  );
  await screen.findByText(
    "Pesagem não gravada. Ajuste a mensagem e envie de novo.",
  );
  expect(
    screen.queryByRole("button", { name: "Gravar pesagem" }),
  ).toBeNull();
});
it("desmontar aborta consulta e ignora retorno tardio", async () => {
  let concluir!: (r: api.RespostaAssistente) => void;
  vi.mocked(api.consultarAssistente).mockReturnValue(
    new Promise((resolve) => {
      concluir = resolve;
    }),
  );
  await abrir();
  perguntar("Saldo?");
  const signal = vi.mocked(api.consultarAssistente).mock.calls[0][1]!;
  cleanup();
  expect(signal.aborted).toBe(true);
  await act(async () => concluir(resposta));
});
it("trocar fazenda limpa a conversa e usa o novo escopo sem trocar a tela ao fundo", async () => {
  await abrir();
  perguntar("Saldo?");
  await screen.findByText(resposta.resposta);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Mudar fazenda" }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Betânia" }));
  await waitFor(() =>
    expect(api.obterConfiguracaoAssistente).toHaveBeenLastCalledWith(
      expect.any(AbortSignal),
      8,
    ),
  );
  expect(screen.queryByText(resposta.resposta)).toBeNull();
  expect(navegarPara).not.toHaveBeenCalled();
});
it("PDF soltado aguarda envio e conserva o documento no turno atual", async () => {
  await abrir();
  const pdf = new File(["%PDF-1.4\n%%EOF"], "pesagem.pdf", {
    type: "application/pdf",
  });
  Object.defineProperty(pdf, "slice", {
    value: () => ({
      arrayBuffer: async () => new TextEncoder().encode("%PDF-").buffer,
    }),
  });
  fireEvent.drop(screen.getByRole("dialog"), {
    dataTransfer: { files: [pdf], types: ["Files"] },
  });
  await screen.findByText("pesagem.pdf");
  expect(api.consultarAssistente).not.toHaveBeenCalled();
  perguntar("Confira esta pesagem");
  await waitFor(() =>
    expect(api.consultarAssistente).toHaveBeenCalledWith(
      expect.objectContaining({
        documento: {
          nome: "pesagem.pdf",
          dataUrl: expect.stringMatching(
            /^data:application\/pdf;base64,JVBERi0/,
          ),
        },
      }),
      expect.any(AbortSignal),
      null,
    ),
  );
});
it("fechar conserva a gravação da resposta concluída em andamento", async () => {
  vi.mocked(api.salvarConversaAssistente).mockReturnValue(
    new Promise(() => {}),
  );
  await abrir();
  perguntar("Saldo?");
  await screen.findByText(resposta.resposta);
  await waitFor(() => expect(api.salvarConversaAssistente).toHaveBeenCalled());
  const signal = vi.mocked(api.salvarConversaAssistente).mock.calls[0][2];
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  expect(signal.aborted).toBe(false);
});
it("interromper pergunta ao trocar modo não bloqueia salvamento das seguintes", async () => {
  vi.mocked(api.consultarAssistente).mockReturnValueOnce(new Promise(() => {}));
  await abrir();
  perguntar("Saldo?");
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  await screen.findByText(
    "Solicitação interrompida. Envie novamente para continuar.",
  );
  vi.mocked(api.consultarAssistente).mockResolvedValue(resposta);
  perguntar("Nova pergunta");
  await screen.findByText(resposta.resposta);
  await waitFor(() => expect(api.salvarConversaAssistente).toHaveBeenCalled());
  expect(
    vi.mocked(api.salvarConversaAssistente).mock.calls.at(-1)![1].at(-1)!
      .pergunta,
  ).toBe("Nova pergunta");
});

it("salvar com sucesso não apresenta erro falso", async () => {
  await abrir();
  perguntar("Saldo?");
  await screen.findByText(resposta.resposta);
  await waitFor(() => expect(api.salvarConversaAssistente).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.queryByText(/Não foi possível salvar/)).toBeNull();
});
it("mostra a consulta em formato de dados e salva os dados com a conversa", async () => {
  vi.mocked(api.consultarAssistente).mockResolvedValue({
    ...resposta,
    dados: {
      titulo: "Financeiro de novembro",
      contexto: "São Francisco · regime de caixa",
      numeros: [
        { rotulo: "A pagar no período", valor: "R$ 6.480,00", detalhe: "1 compromisso · 1 vencido", destaque: true },
        { rotulo: "Resultado realizado", valor: "R$ 0,00" },
      ],
      leitura: "O que pesa no mês são os compromissos a pagar.",
      tabela: { colunas: [{ titulo: "Vencimento" }, { titulo: "Compromisso" }, { titulo: "Valor", valor: true }], linhas: [{ celulas: ["01/11 · vencido", "Ração", "R$ 6.480,00"], atraso: true }] },
    },
  });
  await abrir();
  perguntar("Como está o financeiro?");
  const cartao = await screen.findByRole("article", { name: "Financeiro de novembro" });
  expect(cartao.textContent).toContain("R$ 6.480,00");
  expect(cartao.querySelector(".destaque dt")?.textContent).toBe("A pagar no período");
  expect(cartao.querySelector("tr.atraso")).toBeTruthy();
  // O texto corrido continua para voz e cópia, mas não duplica o cartão na tela.
  expect(screen.queryByText("Entradas: R$ 100,00")).toBeNull();
  await vi.waitFor(() => expect(api.salvarConversaAssistente).toHaveBeenCalled());
  const salvas = vi.mocked(api.salvarConversaAssistente).mock.calls.at(-1)!;
  expect(JSON.stringify(salvas)).toContain("Financeiro de novembro");
});
it("compara com a pesagem anterior e Corrigir devolve a mensagem para edição", async () => {
  vi.mocked(api.consultarAssistente).mockResolvedValue({ ...proposta, proposta: { ...proposta.proposta!, anterior: { data: "2026-10-03", pesoKg: 436 } } });
  await abrir();
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  perguntar("Pese 1058 com 450 kg");
  await screen.findByRole("button", { name: "Gravar pesagem" });
  expect(screen.getByText(/Última pesagem: 436 kg em 03\/10\/2026 \(\+14 kg em 30 dias, 0,47 kg\/dia\)/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Corrigir" }));
  expect(screen.queryByRole("button", { name: "Gravar pesagem" })).toBeNull();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Pese 1058 com 450 kg");
  expect(api.confirmarPesagemAssistente).not.toHaveBeenCalled();
});
