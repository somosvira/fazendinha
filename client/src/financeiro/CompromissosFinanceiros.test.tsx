// @vitest-environment jsdom
import { abrirFiltrosConsulta, aplicarFiltrosConsulta } from "@/lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { descartarRascunhoOperacao, listarCompromissos, obterConfiguracoesFinanceiras, obterRascunhoOperacao } from "./novo-api";
import { uid } from "../lib/uid.fixture";

vi.mock("./novo-api", () => ({
  listarCompromissos: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] }),
  obterRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
  liquidarCompromisso: vi.fn(),
}));

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.history.replaceState(null, "", "/financeiro/compromissos");
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("CompromissosFinanceiros — criação", () => {
  it("pede confirmação antes de substituir um rascunho", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue({ id: uid(8), versao: 1, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: {} });
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a pagar" }));
    expect(await screen.findByRole("heading", { name: "Criar um novo valor a pagar?" })).toBeTruthy();
    expect(screen.getByText(/Você já tem um rascunho de operação em andamento/)).toBeTruthy();
    expect(screen.getByText(/dados preenchidos e documentos anexados serão excluídos permanentemente/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver rascunho atual" }).className).toContain("bg-green-50");
    expect(screen.getByRole("button", { name: "Criar mesmo assim" }).className).toContain("bg-destructive");
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Criar mesmo assim" }));
    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalledOnce());
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
  });

  it("segue diretamente quando não existe rascunho", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue(null);
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a receber" }));
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
    expect(window.location.pathname + window.location.search).toBe("/financeiro/operacoes/nova?compromisso=RECEBER");
    expect(screen.queryByRole("heading", { name: /Criar um novo valor/ })).toBeNull();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("abre o rascunho atual sem descartar seus dados", async () => {
    vi.mocked(obterRascunhoOperacao).mockResolvedValue({ id: uid(8), versao: 1, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: {} });
    const onNav = vi.fn();
    render(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a receber" }));
    expect(await screen.findByRole("heading", { name: "Criar um novo valor a receber?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver rascunho atual" }));

    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/financeiro/operacoes/nova"));
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("não oferece conta inativa ao liquidar um compromisso", async () => {
    vi.mocked(listarCompromissos).mockResolvedValue([{
      id: uid(11),
      seq: 11,
      tipo: "PAGAR",
      status: "PENDENTE",
      valorOriginal: "100",
      valorLiquidado: "0",
      saldoPendente: "100",
      dataVencimento: "2026-09-30",
      numeroParcela: 1,
      totalParcelas: 2,
      vencido: false,
      parceiro: null,
      operacao: { id: uid(5), numero: 5, tipo: "SERVICO", descricao: "Serviço veterinário" },
    }]);
    vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue({
      contas: [
        { id: uid(1), nome: "Conta ativa", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "100", dataSaldoAbertura: "2026-09-01", saldoAtual: "100", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false },
        { id: uid(2), nome: "Conta inativa", tipo: "CAIXA", instituicao: null, identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-09-01", saldoAtual: "0", incluirNoSaldoGeral: true, ativo: false, temMovimentos: false },
      ],
      parceiros: [], categorias: [], centrosCusto: [], produtos: [],
    });
    render(<CompromissosFinanceiros onNav={vi.fn()} />);

    const tabela = within(await screen.findByRole("table", { name: "Compromissos financeiros" }));
    expect(tabela.getByText("(1/2) Serviço veterinário")).toBeTruthy();
    fireEvent.click(tabela.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Conta" }), { key: "Enter" });
    expect(await screen.findByRole("option", { name: /Conta ativa/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Conta inativa/ })).toBeNull();
  });
});


it("pagina compromissos após busca e filtros sem recortar os totais", async () => {
  const itens = Array.from({ length: 31 }, (_, i) => ({ id: uid(100 + i), seq: 100 + i, tipo: "PAGAR" as const, status: "PENDENTE" as const, valorOriginal: "100", valorLiquidado: "0", saldoPendente: "100", dataVencimento: "2026-10-10", numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null, operacao: { id: uid(200 + i), numero: 200 + i, tipo: "SERVICO", descricao: `Compromisso ${i + 1}` } }));
  vi.mocked(listarCompromissos).mockResolvedValue(itens);
  render(<CompromissosFinanceiros onNav={vi.fn()} />);
  const tabela = within(await screen.findByRole("table", { name: "Compromissos financeiros" }));
  expect(tabela.getAllByRole("row")).toHaveLength(16);
  expect(screen.getByText("Total pendente").parentElement?.textContent).toContain("3.100,00");
  fireEvent.click(within(screen.getByRole("navigation", { name: "Paginação dos compromissos" })).getByRole("button", { name: "Próxima" }));
  expect(tabela.getByText("Compromisso 16")).toBeTruthy();
  expect(screen.getByText("Total pendente").parentElement?.textContent).toContain("3.100,00");
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar compromisso" }), { target: { value: "OP-0230" } });
  expect(tabela.getAllByRole("row")).toHaveLength(2);
  expect(tabela.getByText("Compromisso 31")).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Paginação dos compromissos" }).textContent).toContain("1–1 de 1");
});


it("combina situações e filtra vencimentos somente na listagem, mantendo os cards gerais", async () => {
  window.history.replaceState(null, "", "/financeiro/compromissos?inicio=2026-09-01&fim=2026-09-30");
  const compromisso = (id: number, tipo: "PAGAR" | "RECEBER", data: string, valor: string, descricao: string) => ({
    id: uid(id), seq: id, tipo, status: "PENDENTE" as const, valorOriginal: valor, valorLiquidado: "0", saldoPendente: valor,
    dataVencimento: data, numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null,
    operacao: { id: uid(id + 100), numero: id, tipo: "SERVICO", descricao },
  });
  vi.mocked(listarCompromissos).mockResolvedValue([
    compromisso(11, "PAGAR", "2026-09-15", "100", "Custeio setembro"),
    compromisso(12, "PAGAR", "2026-10-15", "200", "Custeio outubro"),
    compromisso(13, "RECEBER", "2026-09-20", "70", "Receita setembro"),
  ]);
  const { container } = render(<CompromissosFinanceiros onNav={vi.fn()} podeLancar={false} />);
  const tabela = within(await screen.findByRole("table", { name: "Compromissos financeiros" }));
  const cards = [...container.querySelectorAll("section.fin-indicador")].map(c => c.textContent);
  expect(cards).toHaveLength(3);
  expect(cards[0]).toContain("300,00");
  expect(cards[1]).toContain("70,00");
  expect(tabela.getByText("Custeio setembro")).toBeTruthy();
  expect(tabela.queryByText("Custeio outubro")).toBeNull();
  expect(tabela.queryByText("Receita setembro")).toBeNull();

  await abrirFiltrosConsulta();
  fireEvent.click(screen.getByRole("button", { name: "Tipo de compromisso" }));
  fireEvent.click(await screen.findByRole("option", { name: "A receber" }));
  fireEvent.keyDown(screen.getAllByRole("dialog").at(-1)!, { key: "Escape" });
  await aplicarFiltrosConsulta();
  expect(tabela.getByText("Custeio setembro")).toBeTruthy();
  expect(tabela.getByText("Receita setembro")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Período de vencimento/ }));
  fireEvent.click(screen.getByRole("button", { name: "Todo o período" }));
  expect(tabela.getByText("Custeio outubro")).toBeTruthy();
  expect([...container.querySelectorAll("section.fin-indicador")].map(c => c.textContent)).toEqual(cards);
  expect(listarCompromissos).toHaveBeenCalledTimes(1);
});

it("preserva compromissos durante a atualização e mostra erro sem apresentar totais zerados", async () => {
  vi.mocked(listarCompromissos).mockResolvedValueOnce([{
    id: uid(11), seq: 11, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "100", valorLiquidado: "0", saldoPendente: "100",
    dataVencimento: "2026-09-30", numeroParcela: 1, totalParcelas: 1, vencido: false, parceiro: null,
    operacao: { id: uid(5), numero: 5, tipo: "SERVICO", descricao: "Serviço veterinário" },
  }]);
  const { container, rerender } = render(<CompromissosFinanceiros onNav={vi.fn()} podeLancar={false} />);
  await screen.findByRole("table", { name: "Compromissos financeiros" });
  let falhar!: (erro: Error) => void;
  vi.mocked(listarCompromissos).mockReturnValueOnce(new Promise((_, reject) => { falhar = reject; }));
  rerender(<CompromissosFinanceiros onNav={vi.fn()} podeLancar />);
  expect(await screen.findByText("Atualizando…")).toBeTruthy();
  expect(screen.getAllByText("Serviço veterinário").length).toBeGreaterThan(0);
  expect(container.querySelector('[aria-busy="true"][inert]')).toBeTruthy();
  await act(async () => falhar(new Error("Falha de rede")));
  expect(screen.getByText("Falha de rede")).toBeTruthy();
  expect(screen.queryByRole("table", { name: "Compromissos financeiros" })).toBeNull();
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
});


it("abre o compromisso vinculado pela URL e remove o alvo ao fechar", async () => {
  window.history.replaceState(null, "", `/financeiro/compromissos?situacao=pagar&compromisso=${uid(101)}`);
  vi.mocked(listarCompromissos).mockResolvedValue([{
    id: uid(101), seq: 101, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "100", valorLiquidado: "0", saldoPendente: "100", dataVencimento: "2026-10-30", numeroParcela: 1, totalParcelas: 1, parceiro: null,
    operacao: { id: uid(102), numero: 102, tipo: "SERVICO", descricao: "Consulta veterinária" },
  }]);
  render(<CompromissosFinanceiros onNav={vi.fn()} podeLancar={false} />);
  const dialogo = await screen.findByRole("dialog", { name: "Detalhes do compromisso" });
  expect(within(dialogo).getByText("Consulta veterinária")).toBeTruthy();
  expect(within(dialogo).queryByRole("button", { name: "Registrar pagamento" })).toBeNull();
  fireEvent.click(within(dialogo).getByRole("button", { name: "Fechar" }));
  expect(new URLSearchParams(window.location.search).get("situacao")).toBe("pagar");
  expect(new URLSearchParams(window.location.search).has("compromisso")).toBe(false);
});

const compromissosSelecao = [
  { id: uid(301), seq: 301, tipo: "PAGAR" as const, status: "PENDENTE" as const, valorOriginal: "100", valorLiquidado: "0", saldoPendente: "100", dataVencimento: "2026-09-15", vencido: true, numeroParcela: 1, totalParcelas: 1, parceiro: null, operacao: { id: uid(401), numero: 401, tipo: "SERVICO", descricao: "Despesa atrasada" } },
  { id: uid(302), seq: 302, tipo: "RECEBER" as const, status: "PENDENTE" as const, valorOriginal: "70", valorLiquidado: "0", saldoPendente: "70", dataVencimento: "2026-09-16", vencido: true, numeroParcela: 1, totalParcelas: 1, parceiro: null, operacao: { id: uid(402), numero: 402, tipo: "VENDA", descricao: "Receita atrasada" } },
  { id: uid(303), seq: 303, tipo: "PAGAR" as const, status: "CANCELADO" as const, valorOriginal: "150", valorLiquidado: "0", saldoPendente: "150", dataVencimento: "2026-09-10", vencido: false, numeroParcela: 1, totalParcelas: 1, parceiro: null, operacao: { id: uid(403), numero: 403, tipo: "SERVICO", descricao: "Despesa cancelada" } },
  { id: uid(304), seq: 304, tipo: "PAGAR" as const, status: "PENDENTE" as const, valorOriginal: "200", valorLiquidado: "0", saldoPendente: "200", dataVencimento: "2026-12-10", vencido: false, numeroParcela: 1, totalParcelas: 1, parceiro: null, operacao: { id: uid(404), numero: 404, tipo: "SERVICO", descricao: "Despesa futura" } },
];

it("sincroniza cards e seletor de tipo, sem somar entradas e saídas", async () => {
  vi.mocked(listarCompromissos).mockResolvedValue(compromissosSelecao);
  render(<CompromissosFinanceiros onNav={vi.fn()} podeLancar={false} />);
  const tabela = within(await screen.findByRole("table", { name: "Compromissos financeiros" }));
  expect(tabela.queryByText("Receita atrasada")).toBeNull();
  expect(tabela.queryByText("Despesa cancelada")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver compromissos a receber" }));
  expect(screen.getByRole("button", { name: "A receber" }).getAttribute("aria-pressed")).toBe("true");
  expect(tabela.getByText("Receita atrasada")).toBeTruthy();
  expect(tabela.queryByText("Despesa atrasada")).toBeNull();
  expect(screen.getByText("Total a receber").parentElement?.textContent).toContain("70,00");
  fireEvent.click(screen.getByRole("button", { name: "Ver compromissos a pagar" }));
  expect(screen.getByRole("button", { name: "A pagar" }).getAttribute("aria-pressed")).toBe("true");
  expect(tabela.getByText("Despesa futura")).toBeTruthy();
  expect(screen.getByText("Total a pagar").parentElement?.textContent).toContain("300,00");
  expect(listarCompromissos).toHaveBeenCalledTimes(1);
});

it("o card de vencidos filtra os dois tipos e mantém os totais separados", async () => {
  vi.mocked(listarCompromissos).mockResolvedValue(compromissosSelecao);
  render(<CompromissosFinanceiros onNav={vi.fn()} podeLancar={false} />);
  const tabela = within(await screen.findByRole("table", { name: "Compromissos financeiros" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver compromissos vencidos" }));
  expect(tabela.getByText("Despesa atrasada")).toBeTruthy();
  expect(tabela.getByText("Receita atrasada")).toBeTruthy();
  expect(tabela.queryByText("Despesa futura")).toBeNull();
  expect(tabela.queryByText("Despesa cancelada")).toBeNull();
  expect(tabela.getAllByText("Vencido")).toHaveLength(2);
  expect(screen.getByText("Total a pagar").parentElement?.textContent).toContain("100,00");
  expect(screen.getByText("Total a receber").parentElement?.textContent).toContain("70,00");
  expect(new URLSearchParams(window.location.search).get("vencidos")).toBe("1");
});

it("a coluna de situação edita em rascunho e cancelado mostra original sem saldo a pagar", async () => {
  vi.mocked(listarCompromissos).mockResolvedValue(compromissosSelecao);
  render(<CompromissosFinanceiros onNav={vi.fn()} podeLancar={false} />);
  const tabela = within(await screen.findByRole("table", { name: "Compromissos financeiros" }));
  fireEvent.click(tabela.getByRole("button", { name: "Filtrar por situação, filtro ativo" }));
  const filtro = within(screen.getByRole("dialog", { name: "Filtro de situação" }));
  fireEvent.click(filtro.getByRole("checkbox", { name: "Cancelado" }));
  fireEvent.click(filtro.getByRole("checkbox", { name: "Pendente" }));
  fireEvent.click(filtro.getByRole("checkbox", { name: "Parcial" }));
  expect(tabela.queryByText("Despesa cancelada")).toBeNull();
  fireEvent.click(filtro.getByRole("button", { name: "Aplicar" }));
  const linha = within(tabela.getByText("Despesa cancelada").closest("tr")!);
  const celulas = linha.getAllByRole("cell");
  expect(celulas[4].textContent?.replace(/\s/g, " ")).toContain("R$ 150,00");
  expect(celulas[5].textContent?.replace(/\s/g, " ")).toContain("R$ 0,00");
  expect(tabela.queryByText("Despesa atrasada")).toBeNull();
});
