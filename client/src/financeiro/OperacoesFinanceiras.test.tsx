import { preferirTabelas } from "@/lib/visualizacao.fixture";
import { alterarControle } from "../lib/controles.fixture";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { descartarRascunhoOperacao, listarOperacoes, obterRascunhoOperacao } from "./novo-api";
import { limparRascunhoAtivo, prepararPublicacaoRascunho } from "./rascunhoAtivo";
import { abrirRotaNovaOperacao } from "../router";
import { uid } from "../lib/uid.fixture";
import * as permissoes from "./permissoes";
vi.mock("./permissoes", () => ({ podeVerValoresFinanceiros: vi.fn().mockReturnValue(true) }));

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
  vi.mocked(permissoes.podeVerValoresFinanceiros).mockReturnValue(true);
  cleanup(); vi.clearAllMocks(); limparRascunhoAtivo();
  window.history.replaceState(null, "", "/financeiro/operacoes");
  // A API real publica o rascunho na store compartilhada; os dublês fazem o mesmo.
  vi.mocked(obterRascunhoOperacao).mockImplementation(async () => prepararPublicacaoRascunho("leitura")(rascunho));
  vi.mocked(descartarRascunhoOperacao).mockImplementation(async () => { prepararPublicacaoRascunho("escrita")(null); });
});

describe("OperacoesFinanceiras — rascunho", () => {
  it("nega URL de criação para consulta sem depender de configurações de escrita", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes/nova");
    render(<OperacoesFinanceiras podeLancar={false} />);
    await screen.findByText("Você não tem permissão para lançar operações financeiras.");
    expect(obterRascunhoOperacao).not.toHaveBeenCalled();
    expect(screen.queryByText("Formulário novo")).toBeNull();
  });
  it("operador sem valores abre formulário novo sem buscar ou sobrescrever rascunho", async () => {
    vi.mocked(permissoes.podeVerValoresFinanceiros).mockReturnValue(false);
    render(<OperacoesFinanceiras podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    await screen.findByText("Formulário novo");
    expect(obterRascunhoOperacao).not.toHaveBeenCalled();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });
  it("oferece continuar quando existe um rascunho", async () => {
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar operação" }));
    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("descarta o rascunho antes de iniciar uma nova operação", async () => {
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalledOnce());
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
    fireEvent.click(await screen.findByRole("button", { name: /^Filtros/ }));
    expect((await screen.findByLabelText("Filtrar por impacto gerado") as HTMLSelectElement).value).toBe("SEM_EFEITOS");
  });
  it("remover o critério elimina o efeito da URL sem apagar o período", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes?inicio=2026-01-01&fim=2026-12-31&efeito=SEM_EFEITOS");
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Remover filtro: Impacto: Sem impactos gerados" }));
    await waitFor(()=>expect(new URLSearchParams(window.location.search).has("efeito")).toBe(false));
    expect(new URLSearchParams(window.location.search).get("inicio")).toBe("2026-01-01");
    expect(new URLSearchParams(window.location.search).get("fim")).toBe("2026-12-31");
  });
  it("ignora um valor de efeito desconhecido e mantém 'Todos os impactos'", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes?efeito=NAO_EXISTE");
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: /^Filtros/ }));
    expect((await screen.findByLabelText("Filtrar por impacto gerado") as HTMLSelectElement).value).toBe("TODOS");
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

    await alterarControle(screen.getByLabelText("Ir para a página"), { target: { value: "2" } });
    expect((await screen.findAllByText("Operação 16")).length).toBe(2);
    expect(screen.queryAllByText("Operação 15")).toHaveLength(0);
    expect(screen.getByText("16–16 de 16 operações")).toBeTruthy();
  });
});

describe("OperacoesFinanceiras — busca por código", () => {
  it("não reserva coluna de ações quando não há comandos disponíveis", async () => {
    vi.mocked(listarOperacoes).mockResolvedValue([{
      id: uid(90), numero: 15, data: "2026-10-01", descricao: "Reposição de estoque", tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", valorTotal: "200.00",
      parceiro: null, movimentosEstoque: [], transacoes: [], compromissos: [], itens: [],
    }] as never);
    const { container } = render(<OperacoesFinanceiras />);
    await screen.findAllByText("Reposição de estoque");
    const tabela = container.querySelector("table")!;
    expect(tabela.querySelector('[data-fin-coluna="acoes"]')).toBeNull();
    expect(tabela.querySelectorAll("thead th")).toHaveLength(7);
  });
  it("encontra o número exibido sem depender do UUID ou da descrição", async () => {
    vi.mocked(listarOperacoes).mockResolvedValue([{
      id: uid(91), numero: 16, data: "2026-10-01", descricao: "Compra de ração", tipo: "SERVICO", status: "CONFIRMADA", valorTotal: "200.00",
      parceiro: null, movimentosEstoque: [], transacoes: [], compromissos: [], itens: [],
    }] as never);
    render(<OperacoesFinanceiras />);
    const campo = await screen.findByRole("textbox", { name: "Buscar operações" });
    for (const consulta of ["OP-0016", "16", "op 0016"]) {
      await alterarControle(campo, { target: { value: consulta } });
      expect(screen.queryByText(/Nenhuma operação encontrada/)).toBeNull();
      expect(screen.getAllByText("Compra de ração").length).toBeGreaterThan(0);
    }
  });
});


it("mantém operações anteriores ao atualizar o período de um perfil somente leitura", async () => {
  vi.mocked(listarOperacoes).mockResolvedValueOnce([{
    id: uid(91), numero: 16, data: "2026-10-01", descricao: "Compra de ração", tipo: "SERVICO", status: "CONFIRMADA", valorTotal: "200.00",
    parceiro: null, movimentosEstoque: [], transacoes: [], compromissos: [], itens: [], documentos: [],
  }]);
  const { container } = render(<OperacoesFinanceiras podeLancar={false} />);
  await screen.findAllByText("Compra de ração");
  let concluir!: (itens: Awaited<ReturnType<typeof listarOperacoes>>) => void;
  vi.mocked(listarOperacoes).mockReturnValueOnce(new Promise(resolve => { concluir = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: /^Período:/ }));
  fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
  expect(await screen.findByText("Atualizando…")).toBeTruthy();
  expect(screen.getAllByText("Compra de ração").length).toBeGreaterThan(0);
  expect(container.querySelector('[aria-busy="true"][inert]')).toBeTruthy();
  await act(async () => concluir([]));
  expect(screen.queryByText("Atualizando…")).toBeNull();
  expect(screen.queryByText("Compra de ração")).toBeNull();
  expect(container.querySelector("[inert]")).toBeNull();
});


const operacoesConsulta = [
  { id: uid(80), numero: 80, descricao: "Reposição mensal", tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", valorTotal: "200.00", compromissos: [] },
  { id: uid(81), numero: 81, descricao: "Venda mensal", tipo: "VENDA", status: "CONFIRMADA", valorTotal: "100.00", compromissos: [] },
  { id: uid(82), numero: 82, descricao: "Visita técnica", tipo: "SERVICO", status: "CANCELADA", valorTotal: null, compromissos: [] },
].map(item => ({ ...item, data: "2026-10-01", parceiro: null, movimentosEstoque: [], transacoes: [], itens: [], documentos: [] }));

describe("OperacoesFinanceiras — filtros das colunas e painel completo", () => {
  it("não repete busca e período nos cabeçalhos de Operação e Data", async () => {
    vi.mocked(listarOperacoes).mockResolvedValue(operacoesConsulta as never);
    render(<OperacoesFinanceiras />);
    const tabela = await screen.findByRole("table", {name:"Operações do período"});
    expect(within(tabela).getByRole("columnheader",{name:"Data"}).querySelector("button")).toBeNull();
    expect(within(tabela).getByRole("columnheader",{name:"Operação"}).querySelector("button")).toBeNull();
    expect(within(tabela).getByRole("button",{name:"Filtrar por tipo de operação"})).toBeTruthy();
  });

  it("edita a coluna em rascunho, confirma e permite remover o critério", async () => {
    vi.mocked(listarOperacoes).mockResolvedValue(operacoesConsulta as never);
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Filtrar por tipo de operação" }));
    const painel = screen.getByRole("dialog", { name: "Filtro de tipo de operação" });
    fireEvent.click(within(painel).getByRole("radio", { name: "Compra para estoque" }));
    expect(screen.getAllByText("Venda mensal").length).toBeGreaterThan(0);
    fireEvent.click(within(painel).getByRole("button", { name: "Aplicar" }));
    expect(screen.queryByText("Venda mensal")).toBeNull();
    expect(screen.queryByText("Visita técnica")).toBeNull();
    expect(screen.getByRole("button", { name: "Filtrar por tipo de operação, filtro ativo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro: Tipo: Compra para estoque" }));
    expect(screen.getAllByText("Venda mensal").length).toBeGreaterThan(0);
  });

  it("compartilha seleção com o modal e cancela sem alterar a consulta", async () => {
    vi.mocked(listarOperacoes).mockResolvedValue(operacoesConsulta as never);
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Filtrar por status" }));
    let painel = screen.getByRole("dialog", { name: "Filtro de status" });
    fireEvent.click(within(painel).getByRole("radio", { name: "Confirmada" }));
    fireEvent.click(within(painel).getByRole("button", { name: "Aplicar" }));
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    painel = screen.getByRole("dialog", { name: "Filtros" });
    expect((within(painel).getByLabelText("Filtrar por status") as HTMLButtonElement).value).toBe("CONFIRMADA");
    await alterarControle(within(painel).getByLabelText("Filtrar por tipo de operação"), { target: { value: "VENDA" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Cancelar" }));
    expect(screen.getAllByText("Reposição mensal").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    painel = screen.getByRole("dialog", { name: "Filtros" });
    await alterarControle(within(painel).getByLabelText("Filtrar por tipo de operação"), { target: { value: "VENDA" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.queryByText("Reposição mensal")).toBeNull();
    expect(screen.getAllByText("Venda mensal").length).toBeGreaterThan(0);
  });

  it("valida limites e não trata valor oculto como zero", async () => {
    vi.mocked(listarOperacoes).mockResolvedValue(operacoesConsulta as never);
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Filtrar por valor" }));
    const painel = screen.getByRole("dialog", { name: "Filtro de valor" });
    fireEvent.change(within(painel).getByLabelText("Valor mínimo"), { target: { value: "150" } });
    fireEvent.change(within(painel).getByLabelText("Valor máximo"), { target: { value: "100" } });
    expect((within(painel).getByRole("button", { name: "Aplicar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(painel).getByLabelText("Valor máximo"), { target: { value: "250" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Aplicar" }));
    expect(screen.getAllByText("Reposição mensal").length).toBeGreaterThan(0);
    expect(screen.queryByText("Venda mensal")).toBeNull();
    expect(screen.queryByText("Visita técnica")).toBeNull();
  });

  it("não oferece filtro de valor ao perfil sem verValores", async () => {
    vi.mocked(permissoes.podeVerValoresFinanceiros).mockReturnValue(false);
    vi.mocked(listarOperacoes).mockResolvedValue(operacoesConsulta as never);
    render(<OperacoesFinanceiras podeLancar={false} />);
    await screen.findAllByText("Reposição mensal");
    expect(screen.queryByRole("button", { name: "Filtrar por valor" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    expect(screen.queryByLabelText("Valor mínimo")).toBeNull();
  });
});

// A consulta continua disponível em tabela; estes cenários verificam suas colunas e comandos.
beforeEach(preferirTabelas);
