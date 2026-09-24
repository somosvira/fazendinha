// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DetalheAnimal } from "./DetalheAnimal";
import { buscarAuditoriaAnimal, buscarFichaAnimal, definirCategoriaManual, listarCategorias, obterCatalogos, removerCategoriaManual } from "../api";
import type { AnimalFicha, CategoriaDTO, Catalogos } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarFichaAnimal: vi.fn(),
  buscarAuditoriaAnimal: vi.fn(),
  obterCatalogos: vi.fn(),
  listarCategorias: vi.fn(),
  definirCategoriaManual: vi.fn(),
  removerCategoriaManual: vi.fn(),
}));

const catVaca = { id: "cat-vaca", nome: "Vaca" };
const catNovilha = { id: "cat-novilha", nome: "Novilha" };
const categoriasMock: CategoriaDTO[] = [
  { id: "cat-vaca", nome: "Vaca", sexo: "F", automatica: true, ativo: true, ordem: 10, idadeMinMeses: null, idadeMaxMeses: null, partos: "COM", ideagriId: 7, padrao: true, regra: "com parto", animaisAtivos: 1, manuaisAbertas: 0 },
  { id: "cat-novilha", nome: "Novilha", sexo: "F", automatica: true, ativo: true, ordem: 30, idadeMinMeses: 12, idadeMaxMeses: null, partos: "SEM", ideagriId: 6, padrao: true, regra: "12 meses ou mais · sem parto", animaisAtivos: 0, manuaisAbertas: 0 },
];

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarAuditoriaAnimal).mockResolvedValue([]);
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [], motivosSaida: [], propriedades: [], lotes: [] } as Catalogos);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: categoriasMock, semCategoria: 0 });
});

const base: AnimalFicha = {
  id: "animal-1", brinco: "1234", nome: "Mimosa", sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 40,
  dataNascimento: "2022-01-01", dataEntrada: "2022-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Sede" },
  lote: null, aptidao: "LEITE", papelReprodutivo: "RECEPTORA", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
  brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 1, observacao: null,
  composicao: [], historicoLocalizacoes: [{ id: "loc-1", propriedade: { id: 1, nome: "Sede" }, lote: null, desde: "2022-01-01", ate: null, motivo: null, movimentacaoId: null }],
  historicoDestinos: [{ id: "dest-1", aptidao: "LEITE", papelReprodutivo: "RECEPTORA", desde: "2022-01-01", ate: null }],
  historicoPesagens: [], historicoCategoriasManuais: [], saida: null,
};

async function montar(animal: AnimalFicha) {
  vi.mocked(buscarFichaAnimal).mockResolvedValue(animal);
  render(<DetalheAnimal id={animal.id} onVoltar={vi.fn()} />);
  await screen.findByText(animal.nome ?? animal.brinco);
}

describe("DetalheAnimal — ações conforme situação", () => {
  it("animal ativo mostra todas as ações de edição e não mostra estornar", async () => {
    await montar(base);
    for (const nome of ["Editar dados", "Editar composição", "Movimentar", "Mudar destino", "Alterar categoria", "Registrar pesagem", "Dar saída", "Excluir cadastro"]) {
      expect(screen.getByRole("button", { name: nome })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Estornar saída" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voltar ao automático" })).toBeNull();
  });

  it("animal que saiu só mostra Estornar saída, e oculta as demais ações", async () => {
    const saiu: AnimalFicha = { ...base, situacao: "SAIU", saida: { id: "saida-1", data: "2026-01-10", tipo: "VENDA", motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null } };
    await montar(saiu);
    expect(screen.getByRole("button", { name: "Estornar saída" })).toBeTruthy();
    for (const nome of ["Editar dados", "Editar composição", "Movimentar", "Mudar destino", "Alterar categoria", "Registrar pesagem", "Dar saída", "Excluir cadastro"]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }
  });

  it("só oferece desfazer localização/destino quando há pelo menos duas linhas de histórico", async () => {
    await montar(base);
    expect(screen.queryByRole("button", { name: "Desfazer última movimentação" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desfazer última mudança" })).toBeNull();
    cleanup();
    const comHistorico: AnimalFicha = {
      ...base,
      historicoLocalizacoes: [...base.historicoLocalizacoes, { id: "loc-0", propriedade: { id: 2, nome: "Outro sítio" }, lote: null, desde: "2021-01-01", ate: "2022-01-01", motivo: null, movimentacaoId: null }],
      historicoDestinos: [...base.historicoDestinos, { id: "dest-0", aptidao: "CORTE", papelReprodutivo: "NENHUM", desde: "2021-01-01", ate: "2022-01-01" }],
    };
    await montar(comHistorico);
    expect(screen.getByRole("button", { name: "Desfazer última movimentação" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desfazer última mudança" })).toBeTruthy();
  });
});

describe("DetalheAnimal — permissão, linha atual e composição", () => {
  it("sem permissão de lançar não mostra nenhuma ação de escrita", async () => {
    vi.mocked(buscarFichaAnimal).mockResolvedValue({
      ...base,
      historicoLocalizacoes: [...base.historicoLocalizacoes, { id: "loc-0", propriedade: { id: 2, nome: "Outro" }, lote: null, desde: "2021-01-01", ate: "2022-01-01", motivo: null, movimentacaoId: null }],
      historicoPesagens: [{ id: "p1", data: "2023-01-01", pesoKg: 400, tipo: "ROTINA", origem: "MANUAL" }],
    });
    render(<DetalheAnimal id="animal-1" onVoltar={vi.fn()} podeLancar={false} />);
    await screen.findByText("Mimosa");
    for (const nome of ["Editar dados", "Movimentar", "Alterar categoria", "Dar saída", "Excluir cadastro", "Desfazer última movimentação"]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }
    expect(screen.queryByRole("button", { name: /Excluir pesagem/ })).toBeNull();
  });

  it("localização atual é a linha aberta mesmo se não vier primeiro", async () => {
    await montar({
      ...base,
      historicoLocalizacoes: [
        { id: "loc-velha", propriedade: { id: 2, nome: "Mexicana" }, lote: null, desde: "2022-01-01", ate: "2022-01-01", motivo: null, movimentacaoId: null },
        { id: "loc-1", propriedade: { id: 1, nome: "Principal" }, lote: null, desde: "2022-01-01", ate: null, motivo: null, movimentacaoId: null },
      ],
    });
    expect(screen.getByText((_, el) => el?.tagName === "P" && /^Principal/.test(el.textContent ?? ""))).toBeTruthy();
  });

  it("mostra o nome da raça e marca a inativa", async () => {
    await montar({ ...base, composicao: [{ racaId: "r-gl", sigla: "GL", nome: "Girolando", racaAtiva: false, fracao64: 32 }] });
    expect(screen.getByText(/Girolando \(GL\)/)).toBeTruthy();
    expect(screen.getByText(/inativa/)).toBeTruthy();
  });
});

describe("DetalheAnimal — categoria", () => {
  it("categoria automática não mostra o selo Manual nem o botão de voltar", async () => {
    await montar(base);
    expect(screen.getByText("Vaca")).toBeTruthy();
    expect(screen.queryByText("Manual")).toBeNull();
    expect(screen.queryByRole("button", { name: "Voltar ao automático" })).toBeNull();
  });

  it("categoria manual mostra o selo Manual, o título com o cálculo e o botão de voltar", async () => {
    await montar({ ...base, categoria: catNovilha, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    expect(screen.getByText("Novilha")).toBeTruthy();
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar ao automático" })).toBeTruthy();
    expect(screen.queryByText(/cálculo já concorda/)).toBeNull();
  });

  it("quando o cálculo já concorda com a manual, mostra a dica de voltar ao automático", async () => {
    await montar({ ...base, categoria: catVaca, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    expect(screen.getByText(/O cálculo já concorda — pode voltar ao automático\./)).toBeTruthy();
  });

  it("sem categoria mostra 'Sem categoria'", async () => {
    await montar({ ...base, categoria: null, categoriaOrigem: "SEM_CATEGORIA", categoriaCalculada: null });
    expect(screen.getByText("Sem categoria")).toBeTruthy();
  });

  it("alterar categoria envia categoriaId, data e motivo", async () => {
    vi.mocked(definirCategoriaManual).mockResolvedValue({ ...base, categoria: catNovilha, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    await montar(base);
    fireEvent.click(screen.getByRole("button", { name: "Alterar categoria" }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nova categoria"), { target: { value: "cat-novilha" } });
    fireEvent.change(within(painel).getByLabelText("Motivo"), { target: { value: "Reclassificação manual" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar categoria" }));
    await waitFor(() => expect(definirCategoriaManual).toHaveBeenCalledWith("animal-1", { categoriaId: "cat-novilha", data: expect.any(String), motivo: "Reclassificação manual" }));
  });

  it("o select de alterar categoria não inclui a categoria atual", async () => {
    await montar(base);
    fireEvent.click(screen.getByRole("button", { name: "Alterar categoria" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).queryByRole("option", { name: "Vaca" })).toBeNull();
    expect(within(painel).getByRole("option", { name: "Novilha" })).toBeTruthy();
  });

  it("voltar ao automático mostra o impacto e envia o motivo", async () => {
    vi.mocked(removerCategoriaManual).mockResolvedValue({ ...base, categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca });
    await montar({ ...base, categoria: catNovilha, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao automático" }));
    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByText(/O animal passa a ser Vaca pelo cálculo\./)).toBeTruthy();
    fireEvent.change(within(modal).getByLabelText("Motivo"), { target: { value: "Volta ao cálculo" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(removerCategoriaManual).toHaveBeenCalledWith("animal-1", { motivo: "Volta ao cálculo" }));
  });

  it("mostra o histórico de categorias manuais e o estado vazio quando não há nenhuma", async () => {
    await montar(base);
    expect(screen.getByText("Categoria calculada pelas regras da fazenda.")).toBeTruthy();
    cleanup();
    await montar({
      ...base,
      historicoCategoriasManuais: [{ id: "h1", categoria: catNovilha, desde: "2025-01-01", ate: "2025-06-01", motivo: "Erro de cadastro", motivoEncerramento: "Corrigido" }],
    });
    expect(screen.getByText("Erro de cadastro")).toBeTruthy();
    expect(screen.getByText("Corrigido")).toBeTruthy();
  });
});
