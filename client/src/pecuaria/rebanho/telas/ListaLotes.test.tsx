// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { ListaLotes } from "./ListaLotes";
import { RebanhoApiError, criarLote, desfazerMovimentacao, editarLote, listarAnimais, listarLotes, listarMovimentacoes, movimentarAnimais, obterCatalogos } from "../api";
import type { Catalogos, Lote } from "../types";

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

vi.mock("../../../api/propriedades", () => ({
  usePropriedades: () => ({
    data: [{ id: 1, nome: "Sede", apelido: null, cidade: null, uf: null, principal: true, ativo: true, ordem: 0 }],
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
  propriedades: [{ id: 1, nome: "Sede", apelido: null }],
  lotes: [{ id: "l1", nome: "Lote 1", propriedadeId: 1 }, { id: "l2", nome: "Lote 2", propriedadeId: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarLotes).mockResolvedValue(lotesMock);
  vi.mocked(editarLote).mockImplementation((id, patch) => Promise.resolve({ ...lotesMock.find((l) => l.id === id)!, ...patch }));
  vi.mocked(obterCatalogos).mockResolvedValue(catalogosMock);
  vi.mocked(listarAnimais).mockResolvedValue({ itens: [], total: 0, painel: { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 } });
  vi.mocked(listarMovimentacoes).mockResolvedValue({ itens: [], total: 0 });
});
afterEach(cleanup);

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

async function montar(onAbrirLote: (id: string) => void = vi.fn(), podeLancar = true) {
  render(<ListaLotes onAbrirLote={onAbrirLote} podeLancar={podeLancar} />, { wrapper: Wrapper });
  await screen.findAllByText("Lote 1");
}

describe("Lotes do rebanho", () => {
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
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar inativos" }));
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
    fireEvent.change(within(painel).getByLabelText("Nome do lote"), { target: { value: "Lote novo" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar lote" }));
    await waitFor(() => expect(criarLote).toHaveBeenCalledWith({ nome: "Lote novo", propriedadeId: 1, observacao: null }));
    await waitFor(() => expect(listarLotes).toHaveBeenCalledTimes(2));
  });

  it("editar carrega os valores atuais e trava o sítio", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Editar Lote 1"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Nome do lote") as HTMLInputElement).value).toBe("Lote 1");
    expect((within(painel).getByLabelText("Sítio") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(within(painel).getByLabelText("Nome do lote"), { target: { value: "Lote 1 — renomeado" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar lote" }));
    await waitFor(() => expect(editarLote).toHaveBeenCalledWith("l1", { nome: "Lote 1 — renomeado", observacao: null }));
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
    fireEvent.change(screen.getByLabelText("Sítio de destino"), { target: { value: "1" } });
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
    fireEvent.change(screen.getByLabelText("Sítio de destino"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));

    await screen.findByText("1 animal movimentado");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(desfazerMovimentacao).toHaveBeenCalledWith("mov-1", "Desfeito logo após a movimentação"));
  });

  it("usuário só de leitura mantém os filtros de Lotes utilizáveis, com as ações de escrita desabilitadas (K7)", async () => {
    const { container } = render(<ListaLotes onAbrirLote={vi.fn()} podeLancar={false} />, { wrapper: Wrapper });
    await screen.findAllByText("Lote 1");

    const checkboxFiltro = screen.getByRole("checkbox", { name: "Mostrar inativos" }) as HTMLInputElement;
    expect(checkboxFiltro.disabled).toBe(false);
    fireEvent.click(checkboxFiltro);
    await waitFor(() => expect(listarLotes).toHaveBeenCalledWith({ incluirInativos: true }));

    const filtroSitio = screen.getByLabelText("Filtrar por sítio") as HTMLSelectElement;
    expect(filtroSitio.disabled).toBe(false);

    // os controles de escrita (edição/ativação de lote) ficam num fieldset desabilitado à parte dos filtros
    const fieldsetEscrita = container.querySelector("fieldset");
    expect(fieldsetEscrita).not.toBeNull();
    expect((fieldsetEscrita as HTMLFieldSetElement).disabled).toBe(true);

    expect(screen.queryByRole("button", { name: /Novo lote/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Movimentar animais/ })).toBeNull();
  });
});

describe("Lotes — histórico de movimentações (sempre visível)", () => {
  it("busca o histórico geral ao montar e refaz a chamada com os filtros escolhidos", async () => {
    await montar();

    await waitFor(() => expect(listarMovimentacoes).toHaveBeenCalledWith({
      loteId: undefined, propriedadeId: undefined, dataDe: undefined, dataAte: undefined, incluirDesfeitas: true, page: 1, pageSize: 20,
    }));

    fireEvent.change(screen.getByLabelText("Filtrar histórico por sítio"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Filtrar histórico por lote"), { target: { value: "l1" } });
    fireEvent.change(screen.getByLabelText("Data inicial do histórico"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Data final do histórico"), { target: { value: "2026-01-31" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar desfeitas" }));

    await waitFor(() => expect(listarMovimentacoes).toHaveBeenLastCalledWith({
      loteId: "l1", propriedadeId: 1, dataDe: "2026-01-01", dataAte: "2026-01-31", incluirDesfeitas: false, page: 1, pageSize: 20,
    }));
  });

  it("trocar o sítio do filtro limpa o lote selecionado", async () => {
    await montar();
    await screen.findByLabelText("Filtrar histórico por lote");

    fireEvent.change(screen.getByLabelText("Filtrar histórico por sítio"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Filtrar histórico por lote"), { target: { value: "l1" } });
    await waitFor(() => expect(listarMovimentacoes).toHaveBeenLastCalledWith(expect.objectContaining({ loteId: "l1" })));

    fireEvent.change(screen.getByLabelText("Filtrar histórico por sítio"), { target: { value: "" } });
    await waitFor(() => expect(listarMovimentacoes).toHaveBeenLastCalledWith(expect.objectContaining({ loteId: undefined, propriedadeId: undefined })));
  });

  it("lotes e histórico ficam visíveis ao mesmo tempo, sem sub-abas", async () => {
    await montar();
    expect(screen.getByRole("heading", { name: "Lotes", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Histórico de movimentações" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Histórico" })).toBeNull();
  });
});
