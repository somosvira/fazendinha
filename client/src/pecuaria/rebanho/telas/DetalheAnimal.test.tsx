// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { DetalheAnimal } from "./DetalheAnimal";
import {
  buscarAuditoriaAnimal, buscarFichaAnimal, definirCategoriaManual, desfazerMovimentacao, editarAnimal, editarPesagem, listarCategorias,
  listarFilhosAnimal, listarMovimentacoes, movimentarAnimais, obterCatalogos, removerCategoriaManual,
} from "../api";
import type { AnimalFicha, CategoriaDTO, Catalogos } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarFichaAnimal: vi.fn(),
  buscarAuditoriaAnimal: vi.fn(),
  obterCatalogos: vi.fn(),
  listarCategorias: vi.fn(),
  listarMovimentacoes: vi.fn(),
  listarFilhosAnimal: vi.fn(),
  definirCategoriaManual: vi.fn(),
  removerCategoriaManual: vi.fn(),
  editarAnimal: vi.fn(),
  editarPesagem: vi.fn(),
  movimentarAnimais: vi.fn(),
  desfazerMovimentacao: vi.fn(),
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
  vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [], total: 0 });
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [], motivosBaixa: [], propriedades: [], lotes: [] } as Catalogos);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: categoriasMock, semCategoria: 0 });
  vi.mocked(listarMovimentacoes).mockResolvedValue({ itens: [], total: 0 });
});

const base: AnimalFicha = {
  id: "animal-1", brinco: "1234", nome: "Mimosa", sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 40, idadeNaBaixa: false,
  dataNascimento: "2022-01-01", dataEntrada: "2022-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Sede" },
  lote: null, aptidao: "LEITE", papelReprodutivo: "RECEPTORA", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
  gmdRecente: null, noLocalDesde: null,
  brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 1, observacao: null,
  composicao: [], historicoLocalizacoes: [{ id: "loc-1", propriedade: { id: 1, nome: "Sede" }, lote: null, desde: "2022-01-01", ate: null, motivo: null, movimentacaoId: null }],
  historicoDestinos: [{ id: "dest-1", aptidao: "LEITE", papelReprodutivo: "RECEPTORA", desde: "2022-01-01", ate: null }],
  historicoPesagens: [], historicoCategoriasManuais: [],
  baixa: null,
  peso: { ultimo: null, gmdRecente: null, gmdDesdeEntrada: null, gmdPeriodo: { dias: null, valor: null, pesagens: 0 } },
  historicoBaixas: [],
  filiacao: { mae: null, pai: null },
  filhosCount: 0,
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

async function montar(animal: AnimalFicha) {
  vi.mocked(buscarFichaAnimal).mockResolvedValue(animal);
  render(<DetalheAnimal id={animal.id} onVoltar={vi.fn()} />, { wrapper: Wrapper });
  await screen.findByText(animal.nome ?? animal.brinco);
}

describe("DetalheAnimal — ações conforme situação", () => {
  it("animal ativo mostra todas as ações de edição e não mostra estornar", async () => {
    await montar(base);
    for (const nome of ["Editar dados", "Editar composição", "Movimentar", "Mudar finalidade", "Alterar categoria", "Registrar pesagem", "Dar baixa", "Excluir cadastro"]) {
      expect(screen.getByRole("button", { name: nome })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Estornar baixa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voltar ao automático" })).toBeNull();
  });

  it("animal baixado só mostra Estornar baixa, e oculta as demais ações", async () => {
    const baixado: AnimalFicha = { ...base, situacao: "BAIXADO", baixa: { id: "baixa-1", data: "2026-01-10", tipo: "VENDA", motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null } };
    await montar(baixado);
    expect(screen.getByRole("button", { name: "Estornar baixa" })).toBeTruthy();
    for (const nome of ["Editar dados", "Editar composição", "Movimentar", "Mudar finalidade", "Alterar categoria", "Registrar pesagem", "Dar baixa", "Excluir cadastro"]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }
  });

  it("mostra tipo, data e motivo (com classe) da baixa registrada no histórico de baixas", async () => {
    const baixado: AnimalFicha = {
      ...base, situacao: "BAIXADO",
      baixa: { id: "baixa-1", data: "2026-09-12", tipo: "VENDA", motivo: { nome: "Baixa produção", classe: "DESCARTE_VOLUNTARIO" }, observacao: null, estornadaEm: null, estornoMotivo: null },
      historicoBaixas: [{ id: "baixa-1", data: "2026-09-12", tipo: "VENDA", motivo: { nome: "Baixa produção", classe: "DESCARTE_VOLUNTARIO" }, observacao: null, estornadaEm: null, estornoMotivo: null, criadoPor: "Ana" }],
    };
    await montar(baixado);
    expect(screen.getByText("Venda")).toBeTruthy();
    expect(screen.getByText("12/09/2026")).toBeTruthy();
    expect(screen.getByText("Baixa produção (descarte voluntário)")).toBeTruthy();
    expect(screen.getByText("Valendo")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
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
      historicoPesagens: [{ id: "p1", data: "2023-01-01", pesoKg: 400, tipo: "ROTINA", origem: "MANUAL", observacao: null }],
    });
    render(<DetalheAnimal id="animal-1" onVoltar={vi.fn()} podeLancar={false} />, { wrapper: Wrapper });
    await screen.findByText("Mimosa");
    for (const nome of ["Editar dados", "Movimentar", "Alterar categoria", "Dar baixa", "Excluir cadastro", "Desfazer última movimentação"]) {
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
    expect(screen.getByText((_, el) => el?.tagName === "STRONG" && /^Principal/.test(el.textContent ?? ""))).toBeTruthy();
  });

  it("mostra o nome da raça e marca a inativa", async () => {
    await montar({ ...base, composicao: [{ racaId: "r-gl", sigla: "GL", nome: "Girolando", racaAtiva: false, origem: "INFORMADA", fracao64: 32 }] });
    expect(screen.getByText((_, el) => el?.tagName === "SPAN" && /^Girolando \(GL\)/.test(el.textContent ?? ""))).toBeTruthy();
    expect(screen.getByText(/inativa/)).toBeTruthy();
  });
});

describe("DetalheAnimal — categoria", () => {
  it("categoria automática não mostra o selo Manual nem o botão de voltar", async () => {
    await montar(base);
    expect(screen.getAllByText("Vaca").length).toBeGreaterThan(0);
    expect(screen.queryByText("Manual")).toBeNull();
    expect(screen.queryByRole("button", { name: "Voltar ao automático" })).toBeNull();
  });

  it("categoria manual mostra o selo Manual, o título com o cálculo e o botão de voltar", async () => {
    await montar({ ...base, categoria: catNovilha, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    expect(screen.getAllByText("Novilha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual").length).toBeGreaterThan(0);
    // o card de categoria diz o que as regras dariam
    expect(screen.getByText(/Pelas regras seria Vaca/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar ao automático" })).toBeTruthy();
    expect(screen.queryByText(/cálculo já concorda/)).toBeNull();
  });

  it("quando o cálculo já concorda com a manual, mostra a dica de voltar ao automático", async () => {
    await montar({ ...base, categoria: catVaca, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    expect(screen.getByText(/O cálculo já concorda — pode voltar ao automático\./)).toBeTruthy();
  });

  it("sem categoria mostra 'Sem categoria'", async () => {
    await montar({ ...base, categoria: null, categoriaOrigem: "SEM_CATEGORIA", categoriaCalculada: null });
    expect(screen.getAllByText("Sem categoria").length).toBeGreaterThan(0);
    expect(screen.getByText(/nenhuma regra ativa se aplica/)).toBeTruthy();
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
    // sem troca manual, o card mostra a categoria atual e de onde ela vem (não só um aviso genérico)
    expect(screen.getByText(/calculada pela regra/)).toBeTruthy();
    expect(screen.queryByText("Trocas manuais")).toBeNull();
    cleanup();
    await montar({
      ...base,
      historicoCategoriasManuais: [{ id: "h1", categoria: catNovilha, desde: "2025-01-01", ate: "2025-06-01", motivo: "Erro de cadastro", motivoEncerramento: "Corrigido" }],
    });
    expect(screen.getByText("Erro de cadastro")).toBeTruthy();
    expect(screen.getByText("Corrigido")).toBeTruthy();
  });
});

describe("DetalheAnimal — editar dados (R1)", () => {
  it("trocar o sexo para macho zera partos antes da entrada, mesmo já tendo partos", async () => {
    vi.mocked(editarAnimal).mockResolvedValue({ ...base, sexo: "M", partosAntesDaEntrada: 0 });
    await montar(base); // base.sexo === "F", partosAntesDaEntrada: 1
    fireEvent.click(screen.getByRole("button", { name: "Editar dados" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByLabelText("Partos antes da entrada")).toBeTruthy();
    fireEvent.change(within(painel).getByLabelText("Sexo"), { target: { value: "M" } });
    expect(within(painel).queryByLabelText("Partos antes da entrada")).toBeNull();
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar dados" }));
    await waitFor(() => expect(editarAnimal).toHaveBeenCalledWith("animal-1", expect.objectContaining({ sexo: "M", partosAntesDaEntrada: 0 })));
  });
});

describe("DetalheAnimal — pesagens (K1)", () => {
  it("mostra a observação da pesagem na tabela e a carrega ao editar", async () => {
    await montar({
      ...base,
      historicoPesagens: [{ id: "p1", data: "2023-06-01", pesoKg: 410, tipo: "ROTINA", origem: "MANUAL", observacao: "Balança descalibrada" }],
    });
    expect(screen.getByText("Balança descalibrada")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Editar pesagem/ }));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Observação") as HTMLTextAreaElement).value).toBe("Balança descalibrada");
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar pesagem" }));
    await waitFor(() => expect(editarPesagem).toHaveBeenCalledWith("p1", expect.objectContaining({ observacao: "Balança descalibrada" })));
  });
});

describe("DetalheAnimal — ficha de baixado (K4/K5)", () => {
  it("mostra o último sítio/lote/aptidão e a idade na baixa quando idadeNaBaixa", async () => {
    const baixado: AnimalFicha = {
      ...base, situacao: "BAIXADO", idadeMeses: 40, idadeNaBaixa: true,
      propriedade: { id: 1, nome: "Sede" }, lote: { id: "lote-1", nome: "Lote 1" }, aptidao: "LEITE", papelReprodutivo: "RECEPTORA",
      baixa: { id: "baixa-1", data: "2026-01-10", tipo: "VENDA", motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null },
    };
    await montar(baixado);
    // faixa de resumo: idade congelada na baixa e o último local
    expect(screen.getByText("Idade na baixa")).toBeTruthy();
    const local = screen.getByText("Último local").parentElement!;
    expect(local.textContent).toContain("Lote 1");
    expect(local.textContent).toContain("Sede");
  });

  it("destaca a baixa em vigor no topo da ficha: tipo, data, motivo, observação e quem registrou", async () => {
    const baixado: AnimalFicha = {
      ...base, situacao: "BAIXADO",
      baixa: { id: "baixa-1", data: "2026-09-24", tipo: "MORTE", motivo: { nome: "Raio", classe: "MORTE" }, observacao: "Tempestade no pasto", estornadaEm: null, estornoMotivo: null },
      historicoBaixas: [{ id: "baixa-1", data: "2026-09-24", tipo: "MORTE", motivo: { nome: "Raio", classe: "MORTE" }, observacao: "Tempestade no pasto", estornadaEm: null, estornoMotivo: null, criadoPor: "Ana" }],
    };
    await montar(baixado);
    const faixa = screen.getByText("Animal baixado").closest("[role=status]")!;
    expect(faixa.textContent).toContain("Morte em 24/09/2026");
    expect(faixa.textContent).toContain("Motivo: Raio");
    expect(faixa.textContent).toContain("Tempestade no pasto");
    expect(faixa.textContent).toContain("registrada por Ana");
    // animal baixado não tem ações de manejo, nem nas pesagens
    expect(screen.queryByRole("button", { name: /Editar pesagem|Excluir pesagem/ })).toBeNull();
  });

  it("animal ativo não mostra os rótulos de 'último'/'na baixa'", async () => {
    await montar({ ...base, idadeNaBaixa: false });
    expect(screen.queryByText("Último local")).toBeNull();
    expect(screen.queryByText("Animal baixado")).toBeNull();
    expect(screen.queryByText(/na baixa/)).toBeNull();
  });
});

describe("DetalheAnimal — movimentar (K8)", () => {
  it("mostra o toast com Desfazer após movimentar, igual ao da página do lote", async () => {
    vi.mocked(obterCatalogos).mockResolvedValue({ racas: [], motivosBaixa: [], propriedades: [{ id: 1, nome: "Sede", apelido: null }], lotes: [] } as Catalogos);
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-1", movidos: 1 });
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 1 });
    await montar(base);
    fireEvent.click(screen.getByRole("button", { name: "Movimentar" }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Sítio de destino"), { target: { value: "1" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));

    await screen.findByText("1 animal movimentado");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(desfazerMovimentacao).toHaveBeenCalledWith("mov-1", "Desfeito logo após a movimentação"));
  });
});

describe("DetalheAnimal — peso e GMD no cabeçalho", () => {
  it("com pesagem, mostra o peso atual e o GMD recente ao lado da idade", async () => {
    await montar({ ...base, peso: { ultimo: { kg: 262, data: "2026-09-01" }, gmdRecente: 0.51, gmdDesdeEntrada: null, gmdPeriodo: { dias: null, valor: null, pesagens: 0 } } });
    const tile = screen.getByText("Peso atual").parentElement!;
    expect(tile.textContent).toContain("262 kg");
    expect(tile.textContent).toContain("+0,510 kg/dia");
  });

  it("sem pesagem, mostra 'Sem pesagem' no lugar do peso", async () => {
    await montar(base);
    expect(screen.getByText("Peso atual").parentElement!.textContent).toContain("Sem pesagem");
  });
});

describe("DetalheAnimal — seletor de período do GMD", () => {
  it("trocar o período refaz a busca da ficha com o periodoDias escolhido", async () => {
    await montar(base);
    // padrão: desde a entrada (a curva inteira do animal)
    expect(buscarFichaAnimal).toHaveBeenLastCalledWith("animal-1", { periodoDias: "entrada" });

    fireEvent.change(screen.getByLabelText("Período do GMD"), { target: { value: "30" } });
    await waitFor(() => expect(buscarFichaAnimal).toHaveBeenLastCalledWith("animal-1", { periodoDias: 30 }));
  });

  it("voltar para 'Desde a entrada' busca com periodoDias=entrada (sem o parâmetro o servidor usa 90 dias)", async () => {
    await montar(base);
    fireEvent.change(screen.getByLabelText("Período do GMD"), { target: { value: "90" } });
    await waitFor(() => expect(buscarFichaAnimal).toHaveBeenLastCalledWith("animal-1", { periodoDias: 90 }));
    fireEvent.change(screen.getByLabelText("Período do GMD"), { target: { value: "entrada" } });
    await waitFor(() => expect(buscarFichaAnimal).toHaveBeenLastCalledWith("animal-1", { periodoDias: "entrada" }));
  });
});

describe("DetalheAnimal — localização com motivo", () => {
  it("mostra o motivo de cada linha do histórico de localização, ou travessão quando não há", async () => {
    await montar({
      ...base,
      historicoLocalizacoes: [
        { id: "loc-2", propriedade: { id: 1, nome: "Sede" }, lote: { id: "l1", nome: "Lote 1" }, desde: "2026-01-01", ate: null, motivo: "Movido para engorda", movimentacaoId: "mov-1" },
        { id: "loc-1", propriedade: { id: 1, nome: "Sede" }, lote: null, desde: "2022-01-01", ate: "2026-01-01", motivo: null, movimentacaoId: null },
      ],
    });
    expect(screen.getByText("Motivo")).toBeTruthy();
    expect(screen.getByText("Movido para engorda")).toBeTruthy();
  });
});

describe("DetalheAnimal — movimentações", () => {
  it("busca as movimentações filtradas pelo animal, incluindo as desfeitas", async () => {
    await montar(base);
    await waitFor(() => expect(listarMovimentacoes).toHaveBeenCalledWith(expect.objectContaining({ animalId: "animal-1", incluirDesfeitas: true })));
  });
});

describe("DetalheAnimal — filiação", () => {
  it("mostra 'Não informada/o' quando mãe e pai são null", async () => {
    await montar(base);
    expect(screen.getByText("Não informada")).toBeTruthy();
    expect(screen.getByText("Não informado")).toBeTruthy();
  });

  it("mostra a mãe como link quando é um animal da fazenda e o pai como pill Externo quando é genitor externo", async () => {
    await montar({
      ...base,
      filiacao: {
        mae: { tipo: "ANIMAL", id: "mae-1", nome: "Estrela", sexo: "F", brinco: "999", baixado: false },
        pai: { tipo: "EXTERNO", id: "ext-1", nome: "Touro Reprodutor X", codigo: "TX1", fornecedor: "Central" },
      },
    });
    expect(screen.getByRole("button", { name: "999 — Estrela" })).toBeTruthy();
    expect(screen.getByText("Touro Reprodutor X")).toBeTruthy();
    expect(screen.getByText("Externo")).toBeTruthy();
  });

  it("com filhosCount > 0, busca e lista os filhos", async () => {
    vi.mocked(listarFilhosAnimal).mockResolvedValue([
      { id: "filho-1", brinco: "500", nome: null, sexo: "M", dataNascimento: "2025-01-10", situacao: "ATIVO" },
    ]);
    await montar({ ...base, filhosCount: 1 });
    await waitFor(() => expect(listarFilhosAnimal).toHaveBeenCalledWith("animal-1"));
    expect(await screen.findByRole("button", { name: "500" })).toBeTruthy();
  });
});
