// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { DetalheLote } from "./DetalheLote";
import {
  buscarLote, buscarResumoLote, desfazerMovimentacao, listarAnimais, listarAuditoriaCadastro, listarMovimentacoesDoLote,
  movimentarAnimais, obterCatalogos, RebanhoApiError,
} from "../api";
import type {
  AnimalResumo, Catalogos, EntradaAuditoria, ListarFiltros, Lote, MovimentacaoDoLote, ResumoLote,
} from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarLote: vi.fn(),
  buscarResumoLote: vi.fn(),
  listarAnimais: vi.fn(),
  listarAuditoriaCadastro: vi.fn(),
  listarMovimentacoesDoLote: vi.fn(),
  desfazerMovimentacao: vi.fn(),
  movimentarAnimais: vi.fn(),
  obterCatalogos: vi.fn(),
  editarLote: vi.fn(),
}));

const lote: Lote = { id: "lote-1", nome: "Lote 1", propriedadeId: 1, propriedade: { id: 1, nome: "Sede" }, ativo: true, observacao: null, animaisAtivos: 2 };

const catalogos: Catalogos = {
  racas: [], motivosBaixa: [],
  propriedades: [{ id: 1, nome: "Sede", apelido: null }],
  lotes: [{ id: "lote-1", nome: "Lote 1", propriedadeId: 1 }, { id: "lote-2", nome: "Lote 2", propriedadeId: 1 }],
};

const catVaca = { id: "cat-vaca", nome: "Vaca" };

function criarAnimal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 30, idadeNaBaixa: false,
    dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
    propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" }, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
    gmdRecente: null, noLocalDesde: null, baixa: null,
    ...overrides,
  };
}

const animaisDoLote = [
  criarAnimal({ id: "a1", brinco: "0001", gmdRecente: 0.512, noLocalDesde: "2025-06-01" }),
  criarAnimal({ id: "a2", brinco: "0002" }),
];
const outroAnimal = criarAnimal({ id: "a3", brinco: "0003", lote: { id: "lote-2", nome: "Lote 2" } });
const animalBaixado = criarAnimal({
  id: "b1", brinco: "0099", situacao: "BAIXADO", lote: null,
  baixa: { data: "2026-02-01", tipo: "VENDA" },
});

const painelLote = { totalAtivos: 2, porCategoria: [{ categoria: catVaca, total: 2 }], porSitio: [], femeasAtivas: 2, receptorasAtivas: 0 };
const painelVazio = { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };

const resumoLote: ResumoLote = {
  ativos: 2,
  porSexo: { F: 2, M: 0 },
  porCategoria: [{ categoriaId: "cat-vaca", categoria: "Vaca", qtd: 2 }],
  idadeMediaMeses: 30,
  peso: { medioKg: 250, minKg: 200, maxKg: 300, semPeso: 1 },
  gmd: { medio: 0.512, comGmd: 1, periodoDias: 90 },
};

const movimentacaoBase: MovimentacaoDoLote = {
  id: "mov-1", data: "2026-01-10", direcao: "ENTRADA", quantidade: 2, quantidadeTotal: 2,
  origens: ["Sede · Lote Antigo"], destino: { propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" } },
  motivo: "Reagrupamento", criadoPor: "Fulano", criadoEm: "2026-01-10T12:00:00Z", desfeitaEm: null, desfeitaMotivo: null, podeDesfazer: true,
};

const entradaAuditoria1: EntradaAuditoria = {
  em: "2026-01-10T14:32:00Z", acao: "EDITAR", entidade: "Lote", usuarioNome: "Fulano", resumo: "Editou o lote",
  entidadeId: "lote-1", alteracoes: [{ campo: "nome", rotulo: "Nome", antes: "Lote Velho", depois: "Lote 1" }],
};
const entradaAuditoria2: EntradaAuditoria = {
  em: "2026-01-05T09:00:00Z", acao: "CRIAR", entidade: "Lote", usuarioNome: "Fulano", resumo: "Criou o lote",
  entidadeId: "lote-1", alteracoes: [],
};

function montarListarAnimais(opts: { baixados?: AnimalResumo[] } = {}) {
  const baixados = opts.baixados ?? [];
  vi.mocked(listarAnimais).mockImplementation((filtros: ListarFiltros) => {
    if (filtros.loteId === "lote-1" && filtros.situacao === "BAIXADO") {
      return Promise.resolve({ itens: baixados, total: baixados.length, painel: painelVazio });
    }
    if (filtros.loteId === "lote-1") return Promise.resolve({ itens: animaisDoLote, total: 2, painel: painelLote });
    return Promise.resolve({ itens: [outroAnimal], total: 1, painel: painelVazio });
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

async function montar(onVoltar = vi.fn()) {
  render(<DetalheLote id="lote-1" onVoltar={onVoltar} />, { wrapper: Wrapper });
  await screen.findByText("Lote 1");
}

/* A TabelaFinanceira renderiza tabela E cartões simultaneamente no jsdom;
 * pegamos sempre a primeira ocorrência (mesma convenção de ListaLotes.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarLote).mockResolvedValue(lote);
  vi.mocked(buscarResumoLote).mockResolvedValue(resumoLote);
  vi.mocked(obterCatalogos).mockResolvedValue(catalogos);
  vi.mocked(listarMovimentacoesDoLote).mockResolvedValue({ itens: [], total: 0 });
  vi.mocked(listarAuditoriaCadastro).mockResolvedValue({ itens: [], total: 0 });
  montarListarAnimais();
});

describe("DetalheLote — animais do lote", () => {
  it("lista os animais ativos do lote", async () => {
    await montar();
    await screen.findAllByText("0001");
    expect(screen.getAllByText("0002").length).toBeGreaterThan(0);
  });

  it("movimentação em massa chama movimentarAnimais com os ids selecionados e o sítio do lote", async () => {
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-novo", movidos: 2 });
    await montar();
    await screen.findAllByText("0001");
    fireEvent.click(primeiro("checkbox", "Selecionar 0001"));
    fireEvent.click(primeiro("checkbox", "Selecionar 0002"));
    fireEvent.click(primeiro("button", "Movimentar selecionados (2)"));

    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sítio de destino") as HTMLSelectElement).value).toBe("1");
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith({ animalIds: ["a1", "a2"], propriedadeId: 1, loteId: null, data: expect.any(String), motivo: null }));
  });

  it("'Trazer animais' seleciona um animal de outro lote e move para este lote", async () => {
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-novo", movidos: 1 });
    await montar();
    fireEvent.click(primeiro("button", /Trazer animais/));

    await screen.findAllByText("0003");
    fireEvent.click(primeiro("checkbox", "Selecionar 0003"));
    fireEvent.click(primeiro("button", "Continuar (1)"));

    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText(/Lote 1/)).toBeTruthy();
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));
    await waitFor(() => expect(movimentarAnimais).toHaveBeenCalledWith({ animalIds: ["a3"], propriedadeId: 1, loteId: "lote-1", data: expect.any(String), motivo: null }));
  });

  it("mostra as colunas novas GMD e 'no lote desde' do animal", async () => {
    await montar();
    await screen.findAllByText("0001");
    expect(screen.getAllByText("+0,512 kg/dia").length).toBeGreaterThan(0);
    expect(screen.getAllByText("01/06/2025").length).toBeGreaterThan(0);
  });
});

describe("DetalheLote — resumo do lote", () => {
  it("mostra os indicadores calculados a partir do resumo do lote", async () => {
    await montar();
    await screen.findByText("Resumo do lote");
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("2 fêmeas · 0 machos")).toBeTruthy();
    expect(screen.getByText("250 kg")).toBeTruthy();
    expect(screen.getByText("200 kg – 300 kg · 1 sem peso")).toBeTruthy();
    expect(screen.getAllByText("+0,512 kg/dia").length).toBeGreaterThan(0);
    expect(screen.getByText("1 de 2 animais com pesagem suficiente")).toBeTruthy();
    expect(screen.getAllByText("2a 6m").length).toBeGreaterThan(0);
  });

  it("trocar o período do GMD recarrega o resumo com o novo período", async () => {
    await montar();
    await screen.findByText("Resumo do lote");
    expect(buscarResumoLote).toHaveBeenCalledWith("lote-1", { periodoDias: "entrada" });
    fireEvent.change(screen.getByLabelText("Período do GMD"), { target: { value: "180" } });
    await waitFor(() => expect(buscarResumoLote).toHaveBeenCalledWith("lote-1", { periodoDias: 180 }));
  });
});

describe("DetalheLote — saíram por baixa", () => {
  it("mostra o estado vazio quando nenhum animal do lote saiu por baixa", async () => {
    await montar();
    expect(await screen.findByText("Nenhum animal deste lote saiu por baixa.")).toBeTruthy();
  });

  it("lista os animais baixados com tipo, data e categoria", async () => {
    montarListarAnimais({ baixados: [animalBaixado] });
    await montar();
    await screen.findAllByText("0099");
    expect(screen.getAllByText(/Venda/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/01\/02\/2026/).length).toBeGreaterThan(0);
  });
});

describe("DetalheLote — alterações do lote", () => {
  it("expande uma entrada e mostra as alterações antes → depois", async () => {
    vi.mocked(listarAuditoriaCadastro).mockResolvedValue({ itens: [entradaAuditoria1], total: 1 });
    await montar();
    const entrada = await screen.findByText("Editou o lote");
    expect(screen.queryByText("Lote Velho")).toBeNull();
    fireEvent.click(entrada);
    expect(await screen.findByText("Lote Velho")).toBeTruthy();
    expect(screen.getByText("Nome")).toBeTruthy();
  });

  it("'Carregar mais' busca a próxima página e acumula as entradas", async () => {
    vi.mocked(listarAuditoriaCadastro).mockImplementation((_entidade, opts) => {
      if (opts?.page === 2) return Promise.resolve({ itens: [entradaAuditoria2], total: 2 });
      return Promise.resolve({ itens: [entradaAuditoria1], total: 2 });
    });
    await montar();
    await screen.findByText("Editou o lote");
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitFor(() => expect(listarAuditoriaCadastro).toHaveBeenCalledWith("Lote", { entidadeId: "lote-1", page: 2, pageSize: 10 }));
    expect(await screen.findByText("Criou o lote")).toBeTruthy();
    expect(screen.getByText("Editou o lote")).toBeTruthy();
  });
});

describe("DetalheLote — histórico e desfazer", () => {
  it("mostra o erro 409 do servidor ao tentar desfazer uma movimentação bloqueada", async () => {
    vi.mocked(listarMovimentacoesDoLote).mockResolvedValue({ itens: [movimentacaoBase], total: 1 });
    vi.mocked(desfazerMovimentacao).mockRejectedValueOnce(new RebanhoApiError("Nada foi desfeito. B401: o animal já foi movimentado de novo", 409, "CONFLITO"));
    await montar();
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    const modal = await screen.findByRole("dialog");
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));
    expect(await screen.findByText("Nada foi desfeito. B401: o animal já foi movimentado de novo")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("desfazer com sucesso fecha o modal e recarrega o histórico", async () => {
    vi.mocked(listarMovimentacoesDoLote).mockResolvedValueOnce({ itens: [movimentacaoBase], total: 1 });
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 2 });
    await montar();
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    const modal = await screen.findByRole("dialog");
    vi.mocked(listarMovimentacoesDoLote).mockResolvedValueOnce({ itens: [{ ...movimentacaoBase, desfeitaEm: "2026-01-11", desfeitaMotivo: "Motivo do estorno" }], total: 1 });
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Motivo do estorno" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Desfazer movimentação" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(listarMovimentacoesDoLote).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Desfeita em/)).toBeTruthy();
  });
});
