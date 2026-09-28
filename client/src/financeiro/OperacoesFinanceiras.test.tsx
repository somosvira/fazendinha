// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./lib/testQueryClient";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { descartarRascunhoOperacao, listarOperacoes, obterRascunhoOperacao } from "./novo-api";
import { limparRascunhoAtivo, prepararPublicacaoRascunho } from "./rascunhoAtivo";
import { abrirRotaNovaOperacao } from "../router";
import { uid } from "../lib/uid.fixture";

vi.mock("../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn().mockResolvedValue(null),
    inscrever: () => () => {},
    obterFila: () => filaVazia,
    aguardarFilaLivre: () => Promise.resolve(),
    filaTravada: () => false,
  };
});

vi.mock("./novo-api", () => ({
  listarOperacoes: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] }),
  obterRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./FormOperacao", () => ({
  FormOperacao: ({ rascunho, operacaoBase, tipoInicial, produtoInicial }: { rascunho: { versao: number } | null; operacaoBase: unknown; tipoInicial?: string; produtoInicial?: string }) => (
    <div data-versao={rascunho?.versao}>{tipoInicial === "AJUSTE_ESTOQUE" ? `Formulário de ajuste do produto ${produtoInicial ?? "nenhum"}` : operacaoBase ? "Formulário de correção" : rascunho ? "Formulário com rascunho" : "Formulário novo"}</div>
  ),
}));

vi.mock("./OperacaoFinanceiraDetalhe", () => ({
  OperacaoFinanceiraDetalhe: ({ onCorrigir }: { onCorrigir: (operacao: unknown) => void }) => (
    <button type="button" onClick={() => onCorrigir({ id: uid(12), transacoes: [], compromissos: [], itens: [] })}>Corrigir</button>
  ),
}));

const rascunho = { id: uid(8), versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { descricao: "Compra mensal" } } };

beforeEach(() => {
  cleanup(); vi.clearAllMocks(); limparRascunhoAtivo();
  window.history.replaceState(null, "", "/financeiro/operacoes");
  // A API real publica o rascunho na store compartilhada; os dublês fazem o mesmo.
  vi.mocked(obterRascunhoOperacao).mockImplementation(async () => prepararPublicacaoRascunho("leitura")(rascunho));
  vi.mocked(descartarRascunhoOperacao).mockImplementation(async () => { prepararPublicacaoRascunho("escrita")(null); });
});

describe("OperacoesFinanceiras — rascunho", () => {
  it("oferece continuar quando existe um rascunho", async () => {
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar operação" }));
    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("descarta o rascunho antes de iniciar uma nova operação", async () => {
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalled());
    expect(await screen.findByText("Formulário novo")).toBeTruthy();
  });

  it("o atalho da sidebar abre o rascunho mais recente com a lista já montada", async () => {
    render(<OperacoesFinanceiras />);
    await screen.findByRole("button", { name: "Continuar operação" });
    // Um autosave posterior à carga da lista (ex.: o formulário aberto antes do "voltar").
    act(() => { prepararPublicacaoRascunho("escrita")({ ...rascunho, versao: 5 }); });

    act(() => { abrirRotaNovaOperacao(); });

    const formulario = await screen.findByText("Formulário com rascunho");
    expect(formulario.getAttribute("data-versao")).toBe("5");
    expect(window.location.pathname).toBe("/financeiro/operacoes/nova");
  });

  // Regressão: os efeitos dos filhos rodam antes dos do App. Ao recarregar em
  // /financeiro/operacoes/nova, a leitura da tela sai antes do limpar do App e
  // não pode ser perdida, senão o formulário monta vazio sobre o rascunho salvo.
  it("abre o formulário com o rascunho mesmo se a store for limpa com a leitura a caminho", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes/nova");
    vi.mocked(obterRascunhoOperacao).mockImplementation(async () => {
      const publicar = prepararPublicacaoRascunho("leitura");
      await Promise.resolve();
      return publicar(rascunho);
    });
    render(<OperacoesFinanceiras />);
    limparRascunhoAtivo();
    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
  });

  it("o atalho do Estoque abre o ajuste de estoque já com o produto escolhido", async () => {
    render(<OperacoesFinanceiras />);
    await screen.findByRole("button", { name: "Continuar operação" });

    act(() => { abrirRotaNovaOperacao({ ajusteEstoqueProdutoId: uid(7) }); });

    expect(await screen.findByText(`Formulário de ajuste do produto ${uid(7)}`)).toBeTruthy();
    expect(window.location.pathname + window.location.search).toBe(`/financeiro/operacoes/nova?tipo=AJUSTE_ESTOQUE&produto=${uid(7)}`);
  });

  it("recarregar a URL do ajuste mantém o tipo e o produto", async () => {
    window.history.replaceState(null, "", `/financeiro/operacoes/nova?tipo=AJUSTE_ESTOQUE&produto=${uid(12)}`);
    render(<OperacoesFinanceiras />);
    expect(await screen.findByText(`Formulário de ajuste do produto ${uid(12)}`)).toBeTruthy();
  });

  it("o atalho da sidebar troca uma correção em curso pelo rascunho", async () => {
    window.history.replaceState(null, "", `/financeiro/operacoes/${uid(12)}`);
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Corrigir" }));
    expect(await screen.findByText("Formulário de correção")).toBeTruthy();

    act(() => { abrirRotaNovaOperacao(); });

    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
  });
});

describe("OperacoesFinanceiras — filtro de efeito vindo da rastreabilidade", () => {
  // A Base financeira linka "Sem efeitos vinculados" para
  // /financeiro/operacoes?...&efeito=SEM_EFEITOS (issue #284 / review #287, P-C).
  it("abre já filtrado por SEM_EFEITOS quando a URL pede", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes?inicio=2026-01-01&fim=2026-12-31&efeito=SEM_EFEITOS");
    render(<OperacoesFinanceiras />);
    expect((await screen.findByLabelText("Filtrar por efeito") as HTMLSelectElement).value).toBe("SEM_EFEITOS");
  });
  it("ignora um valor de efeito desconhecido e mantém 'Todos os efeitos'", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes?efeito=NAO_EXISTE");
    render(<OperacoesFinanceiras />);
    expect((await screen.findByLabelText("Filtrar por efeito") as HTMLSelectElement).value).toBe("TODOS");
  });
});

describe("OperacoesFinanceiras — paginação", () => {
  it("mostra quinze operações por página e permite ir diretamente à próxima", async () => {
    vi.mocked(listarOperacoes).mockResolvedValue(Array.from({ length: 16 }, (_, indice) => ({
      id: indice + 1, data: "2026-09-18T12:00:00.000Z", descricao: `Operação ${indice + 1}`, tipo: "SERVICO", status: "CONFIRMADA", valorTotal: "10.00",
      parceiro: null, movimentosEstoque: [], transacoes: [], compromissos: [], itens: [],
    })) as never);

    render(<OperacoesFinanceiras />);
    expect((await screen.findAllByText("Operação 15")).length).toBe(2);
    expect(screen.queryAllByText("Operação 16")).toHaveLength(0);
    expect(screen.getByText("1–15 de 16 operações")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Ir para a página"), { target: { value: "2" } });
    expect((await screen.findAllByText("Operação 16")).length).toBe(2);
    expect(screen.queryAllByText("Operação 15")).toHaveLength(0);
    expect(screen.getByText("16–16 de 16 operações")).toBeTruthy();
  });
});

describe("OperacoesFinanceiras — offline em período não visitado", () => {
  it("avisa em vez de mostrar o período anterior, mantendo o filtro de período", async () => {
    render(<OperacoesFinanceiras />);
    await screen.findByRole("button", { name: /^Período/ });
    onlineManager.setOnline(false);
    fireEvent.click(screen.getByRole("button", { name: /^Período/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(await screen.findByText(/Sem conexão e sem operações salvas para este período/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Período/ })).toBeTruthy();
    onlineManager.setOnline(true);
  });
});
