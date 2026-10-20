// @vitest-environment jsdom
import { abrirFiltrosConsulta, aplicarFiltrosConsulta } from "@/lib/controles.fixture";
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { ListaLotes } from "./ListaLotes";
import { RebanhoApiError, criarLote, desfazerMovimentacao, editarLote, listarAnimais, listarLotes, listarMovimentacoes, movimentarAnimais, obterCatalogos } from "../api";
import type { Catalogos, Lote } from "../types";
import { setPropriedadeAtiva } from "../../../propriedadeScope";

/* Mantém RebanhoApiError real (os forms usam instanceof) e substitui só as chamadas. */
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarLotes: vi.fn(),
  criarLote: vi.fn(),
  editarLote: vi.fn(),
  listarAnimais: vi.fn(),
  obterCatalogos: vi.fn(),
  movimentarAnimais: vi.fn(),
  listarMovimentacoes: vi.fn(),
  desfazerMovimentacao: vi.fn(),
}));
vi.mock("../../../estoque/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../estoque/api")>()), listarCentrosCusto: vi.fn().mockResolvedValue([]) }));

vi.mock("../../../api/propriedades", () => ({
  usePropriedades: () => ({
    data: [{ id: 1, nome: "Sede", apelido: "Apelido antigo", cidade: null, uf: null, principal: true, ativo: true, ordem: 0 }],
    loading: false,
    recarregar: vi.fn(),
  }),
  criarPropriedade: vi.fn(),
  editarPropriedade: vi.fn(),
}));

const lotesMock: Lote[] = [
  { id: "l1", nome: "Lote 1", propriedadeId: 1, propriedade: { id: 1, nome: "Sede" }, ativo: true, observacao: null, animaisAtivos: 3 },
  { id: "l2", nome: "Lote 2", propriedadeId: 1, propriedade: { id: 1, nome: "Sede" }, ativo: false, observacao: null, animaisAtivos: 0 },
];

/* A tabela responsiva renderiza tabela E cartões; no jsdom os dois existem,
 * então pegamos sempre a primeira ocorrência (mesma convenção de
 * ConfiguracoesFinanceiras.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

const catalogosMock: Catalogos = {
  racas: [], motivosBaixa: [],
  propriedades: [{ id: 1, nome: "Sede", apelido: "Apelido antigo" }],
  lotes: [{ id: "l1", nome: "Lote 1", propriedadeId: 1 }, { id: "l2", nome: "Lote 2", propriedadeId: 1 }],
};

beforeEach(() => {
  setPropriedadeAtiva(null);
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver",class {observe(){} unobserve(){} disconnect(){}});
  window.history.replaceState(null,"","/pecuaria/rebanho/lotes");
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarLotes).mockResolvedValue(lotesMock);
  vi.mocked(editarLote).mockImplementation((id, patch) => Promise.resolve({ ...lotesMock.find((l) => l.id === id)!, ...patch }));
  vi.mocked(obterCatalogos).mockResolvedValue(catalogosMock);
  vi.mocked(listarAnimais).mockResolvedValue({ itens: [], total: 0, painel: { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 } });
  vi.mocked(listarMovimentacoes).mockResolvedValue({ itens: [], total: 0 });
});
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

async function montar(onAbrirLote: (id: string) => void = vi.fn(), podeLancar = true) {
  render(<ListaLotes onAbrirLote={onAbrirLote} podeLancar={podeLancar} />, { wrapper: Wrapper });
  await screen.findAllByText("Lote 1");
}

describe("Lotes do rebanho", () => {
  it("pagina 15 lotes e reinicia ao buscar", async () => {
    vi.mocked(listarLotes).mockResolvedValue(Array.from({ length: 31 }, (_, indice) => ({ ...lotesMock[0], id: `l${indice + 1}`, nome: `Grupo ${String(indice + 1).padStart(2, "0")}`, animaisAtivos: indice + 1 })));
    render(<ListaLotes onAbrirLote={vi.fn()} podeLancar={false} />, { wrapper: Wrapper });
    const tabela = await screen.findByRole("table", { name: "Lotes" });
    await within(tabela).findByText("Grupo 01");
    expect(within(tabela).getAllByRole("row")).toHaveLength(16);
    expect(screen.queryByText("Distribuição dos animais nos lotes")).toBeNull();
    const paginacao = screen.getByRole("navigation", { name: "Paginação de lotes" });
    fireEvent.click(within(paginacao).getByRole("button", { name: "Próxima" }));
    expect(within(tabela).getByText("Grupo 16")).toBeTruthy();
    expect(within(tabela).queryByText("Grupo 01")).toBeNull();
    fireEvent.click(within(paginacao).getByRole("button", { name: "Próxima" }));
    expect(within(tabela).getAllByRole("row")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Buscar lote"), { target: { value: "Grupo 02" } });
    await waitFor(() => expect(within(tabela).getByText("Grupo 02")).toBeTruthy());
    expect(within(paginacao).queryByRole("button", { name: "Anterior" })).toBeNull();
  });

  it("ajusta a página quando a recarga reduz a lista", async () => {
    const muitos = Array.from({ length: 16 }, (_, indice) => ({ ...lotesMock[0], id: `l${indice + 1}`, nome: `Grupo ${indice + 1}` }));
    vi.mocked(listarLotes).mockResolvedValueOnce(muitos).mockResolvedValue([muitos[0]]);
    vi.mocked(editarLote).mockResolvedValue(muitos[15]);
    render(<ListaLotes onAbrirLote={vi.fn()} />, { wrapper: Wrapper });
    const tabela = await screen.findByRole("table", { name: "Lotes" });
    await within(tabela).findByText("Grupo 1");
    const paginacao = screen.getByRole("navigation", { name: "Paginação de lotes" });
    fireEvent.click(within(paginacao).getByRole("button", { name: "Próxima" }));
    fireEvent.click(within(tabela).getByRole("button", { name: "Desativar Grupo 16" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(within(tabela).getByText("Grupo 1")).toBeTruthy());
    expect(within(paginacao).queryByRole("button", { name: "Anterior" })).toBeNull();
  });

  it("lista lotes com sítio, animais ativos e situação", async () => {
    await montar();
    const tabela = screen.getByRole("table", { name: "Lotes" });
    const linha1 = within(tabela).getByText("Lote 1").closest("tr")!;
    expect(within(linha1).getByText("Sede")).toBeTruthy();
    expect(within(linha1).getByText("3")).toBeTruthy();
    expect(within(linha1).getByText("Ativo")).toBeTruthy();
    const linha2 = within(tabela).getByText("Lote 2").closest("tr")!;
    expect(within(linha2).getByText("Inativo")).toBeTruthy();
  });

  it("mostrar inativos refaz a listagem pedindo incluirInativos", async () => {
    await montar();
    expect(listarLotes).toHaveBeenCalledWith({ incluirInativos: false });
    await abrirFiltrosConsulta();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar inativos" }));
    await aplicarFiltrosConsulta();
    await waitFor(() => expect(listarLotes).toHaveBeenCalledWith({ incluirInativos: true }));
  });

  it("clicar na linha abre a página do lote", async () => {
    const onAbrirLote = vi.fn();
    await montar(onAbrirLote);
    fireEvent.click(within(screen.getByRole("table", { name: "Lotes" })).getByText("Lote 1"));
    expect(onAbrirLote).toHaveBeenCalledWith("l1");
  });

  it("cria lote com o sítio já pré-selecionado", async () => {
    vi.mocked(criarLote).mockResolvedValue(lotesMock[0]);
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo lote/ }));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sítio") as HTMLSelectElement).value).toBe("1");
    await alterarControle(within(painel).getByLabelText("Nome do lote"), { target: { value: "Lote novo" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar lote" }));
    await waitFor(() => expect(criarLote).toHaveBeenCalledWith({ nome: "Lote novo", propriedadeId: 1, observacao: null, centroCustoId: null }));
    await waitFor(() => expect(listarLotes).toHaveBeenCalledTimes(2));
  });

  it("editar carrega os valores atuais e trava o sítio", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Editar Lote 1"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Nome do lote") as HTMLInputElement).value).toBe("Lote 1");
    expect((within(painel).getByLabelText("Sítio") as HTMLInputElement).disabled).toBe(true);
    await alterarControle(within(painel).getByLabelText("Nome do lote"), { target: { value: "Lote 1 — renomeado" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar lote" }));
    await waitFor(() => expect(editarLote).toHaveBeenCalledWith("l1", { nome: "Lote 1 — renomeado", observacao: null, centroCustoId: null }));
  });

  it("desativar avisa os animais ativos e pede confirmação; reativar não pede", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Reativar Lote 2"));
    await waitFor(() => expect(editarLote).toHaveBeenCalledWith("l2", { ativo: true }));
    expect(screen.queryByRole("heading", { name: /Desativar/ })).toBeNull();

    fireEvent.click(primeiro("button", "Desativar Lote 1"));
    expect(await screen.findByRole("heading", { name: "Desativar Lote 1?" })).toBeTruthy();
    expect(screen.getByText(/tem 3 animais ativos/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarLote).toHaveBeenCalledWith("l1", { ativo: false }));
  });

  it("erro 409 do servidor (lote com animais) aparece no ErrorBox sem esconder o botão", async () => {
    vi.mocked(editarLote).mockRejectedValueOnce(new RebanhoApiError("Mova os 3 animais antes de desativar o lote", 409, "CONFLITO", "ativo"));
    await montar();
    fireEvent.click(primeiro("button", "Desativar Lote 1"));
    await screen.findByRole("heading", { name: "Desativar Lote 1?" });
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(await screen.findByText("Mova os 3 animais antes de desativar o lote")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(primeiro("button", "Desativar Lote 1")).toBeTruthy();
  });

  it("'Movimentar animais' abre o seletor e depois o formulário com destino livre", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({
      itens: [{
        id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: { id: "cat-vaca", nome: "Vaca" }, categoriaOrigem: "AUTOMATICA" as const, categoriaCalculada: { id: "cat-vaca", nome: "Vaca" }, idadeMeses: 30, idadeNaBaixa: false,
        dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
        propriedade: { id: 1, nome: "Sede" }, lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM",
        composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
        gmdRecente: null, noLocalDesde: null, baixa: null,
      }],
      total: 1,
      painel: { totalAtivos: 1, porCategoria: [], porSitio: [], femeasAtivas: 1, receptorasAtivas: 0 },
    });
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-1", movidos: 1 });
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Movimentar animais/ }));

    expect(await screen.findByRole("heading", { name: "Selecionar animais" })).toBeTruthy();
    fireEvent.click(primeiro("checkbox", "Selecionar 0001"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar (1)" }));

    const painel = await screen.findByRole("heading", { name: "Movimentar animal" });
    expect(painel).toBeTruthy();
    await alterarControle(screen.getByLabelText("Sítio de destino"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith({ animalIds: ["a1"], propriedadeId: 1, loteId: null, data: expect.any(String), motivo: null }));
    // move e desfazer recarregam as duas seções (lotes + histórico)
    await waitFor(() => expect(listarLotes).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(listarMovimentacoes).toHaveBeenCalledTimes(2));
  });

  it("movimentar mostra o toast com Desfazer, igual ao da página do lote (K8)", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({
      itens: [{
        id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: { id: "cat-vaca", nome: "Vaca" }, categoriaOrigem: "AUTOMATICA" as const, categoriaCalculada: { id: "cat-vaca", nome: "Vaca" }, idadeMeses: 30, idadeNaBaixa: false,
        dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
        propriedade: { id: 1, nome: "Sede" }, lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM",
        composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
        gmdRecente: null, noLocalDesde: null, baixa: null,
      }],
      total: 1,
      painel: { totalAtivos: 1, porCategoria: [], porSitio: [], femeasAtivas: 1, receptorasAtivas: 0 },
    });
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-1", movidos: 1 });
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 1 });
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Movimentar animais/ }));
    expect(await screen.findByRole("heading", { name: "Selecionar animais" })).toBeTruthy();
    await screen.findAllByText("0001");
    fireEvent.click(primeiro("checkbox", "Selecionar 0001"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar (1)" }));
    await alterarControle(screen.getByLabelText("Sítio de destino"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));

    await screen.findByText("1 animal movimentado");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(desfazerMovimentacao).toHaveBeenCalledWith("mov-1", "Desfeito logo após a movimentação"));
  });

  it("usuário só de leitura mantém os filtros de Lotes utilizáveis, com as ações de escrita desabilitadas (K7)", async () => {
    const { container } = render(<ListaLotes onAbrirLote={vi.fn()} podeLancar={false} />, { wrapper: Wrapper });
    await screen.findAllByText("Lote 1");

    await abrirFiltrosConsulta();
    const checkboxFiltro = screen.getByRole("checkbox", { name: "Mostrar inativos" }) as HTMLInputElement;
    expect(checkboxFiltro.disabled).toBe(false);
    fireEvent.click(checkboxFiltro);
    await aplicarFiltrosConsulta();
    await waitFor(() => expect(listarLotes).toHaveBeenCalledWith({ incluirInativos: true }));

    await abrirFiltrosConsulta();
    const filtroSitio = within(screen.getByRole("dialog",{name:"Filtros"})).getByRole("combobox",{name:"Filtrar por sítio"}) as HTMLSelectElement;
    expect(filtroSitio.disabled).toBe(false);

    // os controles de escrita (edição/ativação de lote) ficam num fieldset desabilitado à parte dos filtros
    const fieldsetEscrita = container.querySelector("fieldset");
    expect(fieldsetEscrita).not.toBeNull();
    expect((fieldsetEscrita as HTMLFieldSetElement).disabled).toBe(false);
    expect(screen.queryByRole("button",{name:/^Editar /})).toBeNull();

    expect(screen.queryByRole("button", { name: /Novo lote/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Movimentar animais/ })).toBeNull();
  });
});

describe("Lotes — histórico de movimentações (sempre visível)", () => {
  it("consulta o histórico usando sítios e lotes múltiplos", async () => {
    await montar();
    await waitFor(()=>expect(listarMovimentacoes).toHaveBeenCalledWith(expect.objectContaining({page:1,pageSize:20})));
    fireEvent.click(screen.getAllByRole("button",{name:"Filtros"}).at(-1)!);
    fireEvent.click(screen.getByRole("button",{name:"Sítios da movimentação"}));
    fireEvent.click(screen.getByRole("option",{name:"Sede"}));
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
    expect(vi.mocked(listarMovimentacoes).mock.calls.at(-1)?.[0]?.propriedadeIds).toBeUndefined();
    fireEvent.click(screen.getByRole("button",{name:"Lotes da movimentação"}));
    fireEvent.click(screen.getByRole("option",{name:"Lote 1"}));
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(()=>expect(listarMovimentacoes).toHaveBeenLastCalledWith(expect.objectContaining({propriedadeIds:[1],loteIds:["l1"]})));
  });
  it("trocar sítios invalida os lotes anteriores",async()=>{
    window.history.replaceState(null,"","/pecuaria/rebanho/lotes?movSitioIds=1&movLoteIds=l1");
    await montar();
    await waitFor(()=>expect(listarMovimentacoes).toHaveBeenLastCalledWith(expect.objectContaining({loteIds:["l1"]})));
    fireEvent.click(screen.getAllByRole("button",{name:"Filtros"}).at(-1)!);
    fireEvent.click(screen.getByRole("button",{name:"Sítios da movimentação"}));
    fireEvent.click(screen.getByRole("option",{name:"Sede"}));
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
    expect(vi.mocked(listarMovimentacoes).mock.calls.at(-1)?.[0]?.loteIds).toEqual(["l1"]);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(()=>expect(listarMovimentacoes).toHaveBeenLastCalledWith(expect.objectContaining({loteIds:undefined})));
  });

  it("lotes e histórico ficam visíveis ao mesmo tempo, sem sub-abas", async () => {
    await montar();
    expect(screen.getByRole("tab", { name: "Lotes", selected: true })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Histórico de movimentações" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Histórico" })).toBeNull();
  });
});

it("data inválida na URL de movimentações mostra erro sem consultar nem quebrar o filtro",async()=>{
 window.history.replaceState({},"","/pecuaria/rebanho/lotes?movDe=2026-02-30&movAte=2026-03-01");
 await montar();
 expect(await screen.findByText("Informe datas válidas para o histórico de movimentações.")).toBeTruthy();
 expect(listarMovimentacoes).not.toHaveBeenCalled();
 expect(screen.getByRole("button",{name:/^Período das movimentações/})).toBeTruthy();
});

it("restaura os filtros principais sem apagar o recorte do histórico e acompanha voltar/avançar", async () => {
  window.history.replaceState({}, "", "/pecuaria/rebanho/lotes?buscaLote=2&sitioLote=1&lotesInativos=true&movDesfeitas=false");
  render(<ListaLotes onAbrirLote={vi.fn()} />, { wrapper: Wrapper });
  await screen.findAllByText("Lote 2");
  expect((screen.getByLabelText("Buscar lote") as HTMLInputElement).value).toBe("2");
  await abrirFiltrosConsulta();
  expect(screen.getByRole("checkbox", { name: "Mostrar inativos" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
  expect(new URLSearchParams(window.location.search).get("movDesfeitas")).toBe("false");
  window.history.replaceState({}, "", "/pecuaria/rebanho/lotes?buscaLote=1&movDesfeitas=false");
  fireEvent(window, new PopStateEvent("popstate"));
  await screen.findAllByText("Lote 1");
  expect((screen.getByLabelText("Buscar lote") as HTMLInputElement).value).toBe("1");
  expect(screen.queryByText("Lote 2")).toBeNull();
});

it("mantém a página da listagem no reload enquanto aguarda os lotes", async () => {
  window.history.replaceState({}, "", "/pecuaria/rebanho/lotes?paginaLotes=2");
  vi.mocked(listarLotes).mockResolvedValue(Array.from({ length: 25 }, (_, indice) => ({ ...lotesMock[0], id: `l-${indice}`, nome: `Grupo ${indice + 1}` })));
  render(<ListaLotes onAbrirLote={vi.fn()} />, { wrapper: Wrapper });
  await screen.findAllByText("Grupo 21");
  expect(new URLSearchParams(window.location.search).get("paginaLotes")).toBe("2");
  expect(screen.queryByText("Grupo 1")).toBeNull();
});

it("usa o sítio global sem oferecer um segundo filtro contraditório", async () => {
  setPropriedadeAtiva(1);
  window.history.replaceState({}, "", "/pecuaria/rebanho/lotes?sitioLote=2");
  await montar();
  expect(screen.queryByLabelText("Filtrar por sítio")).toBeNull();
  expect(new URLSearchParams(window.location.search).has("sitioLote")).toBe(false);
});
