// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DetalheAnimal } from "./DetalheAnimal";
import { buscarAuditoriaAnimal, buscarFichaAnimal, obterCatalogos } from "../api";
import type { AnimalFicha, Catalogos } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarFichaAnimal: vi.fn(),
  buscarAuditoriaAnimal: vi.fn(),
  obterCatalogos: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buscarAuditoriaAnimal).mockResolvedValue([]);
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [], motivosSaida: [], propriedades: [], lotes: [] } as Catalogos);
});

const base: AnimalFicha = {
  id: "animal-1", brinco: "1234", nome: "Mimosa", sexo: "F", categoria: "VACA", idadeMeses: 40,
  dataNascimento: "2022-01-01", dataEntrada: "2022-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Sede" },
  lote: null, aptidao: "LEITE", papelReprodutivo: "RECEPTORA", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
  brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 1, observacao: null,
  composicao: [], historicoLocalizacoes: [{ id: "loc-1", propriedade: { id: 1, nome: "Sede" }, lote: null, desde: "2022-01-01", ate: null, motivo: null, movimentacaoId: null }],
  historicoDestinos: [{ id: "dest-1", aptidao: "LEITE", papelReprodutivo: "RECEPTORA", desde: "2022-01-01", ate: null }],
  historicoPesagens: [], saida: null,
};

async function montar(animal: AnimalFicha) {
  vi.mocked(buscarFichaAnimal).mockResolvedValue(animal);
  render(<DetalheAnimal id={animal.id} onVoltar={vi.fn()} />);
  await screen.findByText(animal.nome ?? animal.brinco);
}

describe("DetalheAnimal — ações conforme situação", () => {
  it("animal ativo mostra todas as ações de edição e não mostra estornar", async () => {
    await montar(base);
    for (const nome of ["Editar dados", "Editar composição", "Movimentar", "Mudar destino", "Registrar pesagem", "Dar saída", "Excluir cadastro"]) {
      expect(screen.getByRole("button", { name: nome })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Estornar saída" })).toBeNull();
  });

  it("animal que saiu só mostra Estornar saída, e oculta as demais ações", async () => {
    const saiu: AnimalFicha = { ...base, situacao: "SAIU", saida: { id: "saida-1", data: "2026-01-10", tipo: "VENDA", motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null } };
    await montar(saiu);
    expect(screen.getByRole("button", { name: "Estornar saída" })).toBeTruthy();
    for (const nome of ["Editar dados", "Editar composição", "Movimentar", "Mudar destino", "Registrar pesagem", "Dar saída", "Excluir cadastro"]) {
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
    for (const nome of ["Editar dados", "Movimentar", "Dar saída", "Excluir cadastro", "Desfazer última movimentação"]) {
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
