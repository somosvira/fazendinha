import { preferirTabelas } from "@/lib/visualizacao.fixture";
// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { ManejoAnimal } from "../manejo/ManejoAnimal";
import { ReproducaoAnimal } from "../reproducao/Reproducao";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { DetalheAnimal } from "./DetalheAnimal";
import {
  RebanhoApiError, buscarAuditoriaAnimal, buscarFichaAnimal, definirCategoriaManual, desfazerMovimentacao, editarAnimal, editarPesagem, listarCategorias,
  listarFilhosAnimal, listarMovimentacoes, movimentarAnimais, obterCatalogos, removerCategoriaManual,
} from "../api";
import type { AnimalFicha, CategoriaDTO, Catalogos } from "../types";

vi.mock("../manejo/ManejoAnimal", () => ({ ManejoAnimal: vi.fn(() => null), reqManejo: vi.fn().mockResolvedValue([]) }));

vi.mock("../reproducao/Reproducao", () => ({ ReproducaoAnimal: vi.fn(() => null) }));

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
  window.history.replaceState(null, "", "/pecuaria/rebanho/animais/animal-1");
  vi.clearAllMocks();
  window.history.replaceState(null, "", window.location.pathname);
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
  const menu = screen.queryByText("Mais ações");
  if (menu) fireEvent.click(menu);
}

describe("DetalheAnimal — ações conforme situação", () => {
  it("animal ativo mostra todas as ações de edição e não mostra estornar", async () => {
    await montar(base);
    for (const nome of ["Editar dados", "Editar composição", "Movimentar", "Mudar finalidade", "Alterar categoria", "Registrar pesagem", "Dar baixa", "Excluir cadastro"]) {
      expect(screen.getAllByRole("button", { name: nome }).length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Consultar baixa e autoria" }));
    expect(screen.getByText("Venda")).toBeTruthy();
    expect(screen.getByText("12/09/2026")).toBeTruthy();
    expect(screen.getByText("Baixa produção (descarte voluntário)")).toBeTruthy();
    expect(screen.getByText("Valendo")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("apresenta finalidade Reprodução no histórico sem substituir o papel", async () => {
    await montar({ ...base, aptidao: "REPRODUCAO", historicoDestinos: [{ ...base.historicoDestinos[0], aptidao: "REPRODUCAO" }] });
    const cadastro = document.getElementById("cadastro")!;
    expect(within(cadastro).getByText("Finalidade")).toBeTruthy();
    expect(within(cadastro).getByText("Reprodução")).toBeTruthy();
    expect(within(cadastro).getByText("Papel reprodutivo")).toBeTruthy();
    expect(within(cadastro).getByText("Receptora")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Finalidade" })).toBeNull();
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
    expect(within(document.querySelector<HTMLElement>('[aria-label="Localização atual"]')!).getByText("Principal · Sem lote")).toBeTruthy();
  });

  it("mostra o nome da raça e marca a inativa", async () => {
    await montar({ ...base, composicao: [{ racaId: "r-gl", sigla: "GL", nome: "Girolando", racaAtiva: false, origem: "INFORMADA", fracao64: 32, fracaoCalculada64: 0 }] });
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

  it("categoria manual mantém os controles de correção sem exibir selo Manual", async () => {
    await montar({ ...base, categoria: catNovilha, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    expect(screen.getAllByText("Novilha").length).toBeGreaterThan(0);
    expect(screen.queryByText("Manual")).toBeNull();
    // o card de categoria diz o que as regras dariam
    fireEvent.click(screen.getByRole("button", { name: "Categoria" }));
    expect(screen.getByText(/Pelas regras seria Vaca/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar ao automático" })).toBeTruthy();
    expect(screen.queryByText(/cálculo já concorda/)).toBeNull();
  });

  it("quando o cálculo já concorda com a manual, mostra a dica de voltar ao automático", async () => {
    await montar({ ...base, categoria: catVaca, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    fireEvent.click(screen.getByRole("button", { name: "Categoria" }));
    expect(screen.getByText(/O cálculo já concorda — pode voltar ao automático\./)).toBeTruthy();
  });

  it("sem categoria mostra 'Sem categoria'", async () => {
    await montar({ ...base, categoria: null, categoriaOrigem: "SEM_CATEGORIA", categoriaCalculada: null });
    expect(screen.getAllByText("Sem categoria").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Categoria" }));
    expect(screen.getByText(/nenhuma regra ativa se aplica/)).toBeTruthy();
  });

  it("alterar categoria envia categoriaId, data e motivo", async () => {
    vi.mocked(definirCategoriaManual).mockResolvedValue({ ...base, categoria: catNovilha, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    await montar(base);
    fireEvent.click(screen.getByRole("button", { name: "Alterar categoria" }));
    const painel = await screen.findByRole("dialog");
    await alterarControle(within(painel).getByLabelText("Nova categoria"), { target: { value: "cat-novilha" } });
    await alterarControle(within(painel).getByLabelText("Motivo"), { target: { value: "Reclassificação manual" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar categoria" }));
    await waitFor(() => expect(definirCategoriaManual).toHaveBeenCalledWith("animal-1", { categoriaId: "cat-novilha", data: expect.any(String), motivo: "Reclassificação manual" }));
  });

  it("o select de alterar categoria não inclui a categoria atual", async () => {
    await montar(base);
    fireEvent.click(screen.getByRole("button", { name: "Alterar categoria" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).queryByRole("option", { hidden: true,  name: "Vaca" })).toBeNull();
    expect(within(painel).getByRole("option", { hidden: true,  name: "Novilha" })).toBeTruthy();
  });

  it("voltar ao automático mostra o impacto e envia o motivo", async () => {
    vi.mocked(removerCategoriaManual).mockResolvedValue({ ...base, categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca });
    await montar({ ...base, categoria: catNovilha, categoriaOrigem: "MANUAL", categoriaCalculada: catVaca });
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao automático" }));
    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByText(/O animal passa a ser Vaca pelo cálculo\./)).toBeTruthy();
    await alterarControle(within(modal).getByLabelText("Motivo"), { target: { value: "Volta ao cálculo" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(removerCategoriaManual).toHaveBeenCalledWith("animal-1", { motivo: "Volta ao cálculo" }));
  });

  it("mostra o histórico de categorias manuais e o estado vazio quando não há nenhuma", async () => {
    await montar(base);
    // sem troca manual, o card mostra a categoria atual e de onde ela vem (não só um aviso genérico)
    fireEvent.click(screen.getByRole("button", { name: "Categoria" }));
    expect(screen.getByText(/calculada pela regra/)).toBeTruthy();
    expect(screen.queryByText("Trocas manuais")).toBeNull();
    cleanup();
    await montar({
      ...base,
      historicoCategoriasManuais: [{ id: "h1", categoria: catNovilha, desde: "2025-01-01", ate: "2025-06-01", motivo: "Erro de cadastro", motivoEncerramento: "Corrigido" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Categoria" }));
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
    await alterarControle(within(painel).getByLabelText("Sexo"), { target: { value: "M" } });
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
    expect(screen.getByText("Sede · Lote 1")).toBeTruthy();
    expect(screen.queryByText("Último local")).toBeNull();
  });

  it("resume a baixa no topo e mantém motivo, observação e autoria no histórico", async () => {
    const baixado: AnimalFicha = {
      ...base, situacao: "BAIXADO",
      baixa: { id: "baixa-1", data: "2026-09-24", tipo: "MORTE", motivo: { nome: "Raio", classe: "MORTE" }, observacao: "Tempestade no pasto", estornadaEm: null, estornoMotivo: null },
      historicoBaixas: [{ id: "baixa-1", data: "2026-09-24", tipo: "MORTE", motivo: { nome: "Raio", classe: "MORTE" }, observacao: "Tempestade no pasto", estornadaEm: null, estornoMotivo: null, criadoPor: "Ana" }],
    };
    await montar(baixado);
    const faixa = screen.getByText(/Animal baixado · Morte/).closest<HTMLElement>("[role=status]")!;
    expect(faixa.textContent).toContain("Morte em 24/09/2026");
    expect(faixa.textContent).not.toContain("Tempestade no pasto");
    fireEvent.click(within(faixa).getByRole("button", { name: "Histórico" }));
    fireEvent.click(screen.getByRole("button", { name: "Consultar baixa e autoria" }));
    expect(screen.getByRole("cell", { name: "Raio (morte)" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Tempestade no pasto" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Ana" })).toBeTruthy();
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
    await alterarControle(within(painel).getByLabelText("Sítio de destino"), { target: { value: "1" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));

    await screen.findByText("1 animal movimentado");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(desfazerMovimentacao).toHaveBeenCalledWith("mov-1", "Desfeito logo após a movimentação"));
  });
});

describe("DetalheAnimal — medidas em Geral", () => {
  it("mostra GMD no Peso e conserva a idade na Identificação", async () => {
    await montar({ ...base, peso: { ultimo: { kg: 262, data: "2026-09-01" }, gmdRecente: 0.51, gmdDesdeEntrada: null, gmdPeriodo: { dias: null, valor: null, pesagens: 0 } } });
    expect(within(document.getElementById("cadastro")!).getByText("Idade")).toBeTruthy();
    expect(within(document.getElementById("peso")!).getByText("+0,510 kg/dia")).toBeTruthy();
  });

  it("mantém cabeçalho sem medidas ao trocar abas e preserva os pais montados", async () => {
    await montar(base);
    const cabecalho = document.querySelector<HTMLElement>(".ficha-animal-cabecalho")!;
    expect(within(cabecalho).queryByText("Idade")).toBeNull();
    expect(within(cabecalho).queryByText("Peso atual")).toBeNull();
    expect(cabecalho.querySelector("time")).toBeNull();
    const cadastro = document.getElementById("cadastro");
    fireEvent.click(screen.getByRole("tab", { name: "Sanidade" }));
    fireEvent.click(screen.getByRole("tab", { name: "Geral" }));
    expect(document.getElementById("cadastro")).toBe(cadastro);
    expect(cabecalho.closest("[hidden]")).toBeNull();
  });

  it("sem pesagem, mostra estado vazio na seção Peso", async () => {
    await montar(base);
    expect(within(document.getElementById("peso")!).getByText("Nenhuma pesagem registrada.")).toBeTruthy();
  });
});

describe("DetalheAnimal — seletor de período do GMD", () => {
  it("trocar o período refaz a busca da ficha com o periodoDias escolhido", async () => {
    await montar(base);
    // padrão: desde a entrada (a curva inteira do animal)
    expect(buscarFichaAnimal).toHaveBeenLastCalledWith("animal-1", { periodoDias: "entrada" });

    await alterarControle(screen.getByLabelText("Período do GMD"), { target: { value: "30" } });
    await waitFor(() => expect(buscarFichaAnimal).toHaveBeenLastCalledWith("animal-1", { periodoDias: 30 }));
  });

  it("voltar para 'Desde a entrada' busca com periodoDias=entrada (sem o parâmetro o servidor usa 90 dias)", async () => {
    await montar(base);
    await alterarControle(screen.getByLabelText("Período do GMD"), { target: { value: "90" } });
    await waitFor(() => expect(buscarFichaAnimal).toHaveBeenLastCalledWith("animal-1", { periodoDias: 90 }));
    await alterarControle(screen.getByLabelText("Período do GMD"), { target: { value: "entrada" } });
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
    expect(within(document.getElementById("historico")!).getByText("Movido para engorda")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver histórico" }));
    const dialogo = screen.getByRole("dialog", { name: "Histórico de movimentações" });
    expect(within(dialogo).queryByRole("heading", { name: "Localização" })).toBeNull();
    expect(within(dialogo).queryByRole("heading", { name: "Finalidade" })).toBeNull();
    expect(within(dialogo).queryByRole("heading", { name: "Baixas" })).toBeNull();
  });
});

describe("DetalheAnimal — movimentações", () => {
  it("busca as movimentações filtradas pelo animal, incluindo as desfeitas", async () => {
    await montar(base);
    fireEvent.click(screen.getByRole("button", { name: "Ver histórico" }));
    await waitFor(() => expect(listarMovimentacoes).toHaveBeenCalledWith(expect.objectContaining({ animalId: "animal-1", incluirDesfeitas: true })));
  });
});

describe("DetalheAnimal — filiação", () => {
  it("mostra 'Não informada/o' quando mãe e pai são null", async () => {
    await montar(base);
    expect(within(document.getElementById("identificacao-genetica")!).getByText("Não informada")).toBeTruthy();
    expect(within(document.getElementById("identificacao-genetica")!).getByText("Não informado")).toBeTruthy();
  });

  it("mostra a mãe como link quando é um animal da fazenda e o pai como pill Externo quando é genitor externo", async () => {
    await montar({
      ...base,
      filiacao: {
        mae: { tipo: "ANIMAL", id: "mae-1", nome: "Estrela", sexo: "F", brinco: "999", baixado: false },
        pai: { tipo: "EXTERNO", id: "ext-1", nome: "Touro Reprodutor X", codigo: "TX1", fornecedor: "Central" },
      },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Geral" }));
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
    fireEvent.click(screen.getByRole("tab", { name: "Geral" }));
    expect(await screen.findByRole("button", { name: "500" })).toBeTruthy();
  });
});


describe("Ficha por domínio", () => {
  it("mantém todas as seções montadas e agrupa ações secundárias", async () => {
    vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
    render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} />, { wrapper: Wrapper });
    await screen.findByRole("heading", { name: /Mimosa.*#1234/ });
    const ilustracao = screen.getByRole("img", { name: "Ilustração genérica de bovino" });
    expect(ilustracao.getAttribute("src")).toBe("/images/pecuaria/vaca.png");
    expect(ilustracao.getAttribute("width")).toBe("110");
    const nav = screen.getByRole("tablist", { name: "Seções da ficha" });
    expect(within(nav).getAllByRole("tab").map(aba => aba.textContent)).toEqual(["Geral", "Produção", "Reprodução", "Sanidade", "Nutrição"]);
    for (const id of ["cadastro", "identificacao-genetica", "ficha-painel-sanidade", "peso", "ficha-painel-nutricao", "historico"]) expect(document.getElementById(id)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filiação e composição racial" }).getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("identificacao-genetica-conteudo")?.hidden).toBe(false);
    expect(document.getElementById("peso-conteudo")?.hidden).toBe(false);
    expect(document.getElementById("historico-conteudo")?.hidden).toBe(false);
    expect(within(document.getElementById("cadastro")!).getByRole("button", { name: "Editar dados" })).toBeTruthy();
    fireEvent.click(screen.getByText("Mais ações"));
    expect(screen.getByRole("button", { name: "Excluir cadastro" })).toBeTruthy();
    const peso = document.getElementById("peso");
    fireEvent.click(within(nav).getByRole("tab", { name: "Sanidade" }));
    expect(document.getElementById("ficha-painel-geral")?.hidden).toBe(true);
    fireEvent.click(within(nav).getByRole("tab", { name: "Geral" }));
    expect(document.getElementById("peso")).toBe(peso);
    expect(document.getElementById("ficha-painel-geral")?.hidden).toBe(false);
    expect(window.location.hash).toBe("#geral");
  });
  it("restaura a seção de um link direto e da navegação pelo histórico", async () => {
    window.history.replaceState(null, "", "#sanidade");
    vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
    render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} />, { wrapper: Wrapper });
    await screen.findByRole("heading", { name: /Mimosa.*#1234/ });
    expect(document.getElementById("ficha-painel-sanidade")?.hidden).toBe(false);
    window.history.replaceState(null, "", "#historico");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(document.getElementById("ficha-painel-geral")?.hidden).toBe(false);
    expect(document.getElementById("ficha-painel-sanidade")?.hidden).toBe(true);
  });
});

it("preserva autorização histórica da reprodução para matriz baixada", async () => {
 const baixado: AnimalFicha = { ...base, situacao: "BAIXADO", baixa: { id: "b", data: "2026-01-10", tipo: "VENDA", motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null } };
 await montar(baixado);
 fireEvent.click(screen.getByRole("tab", { name: "Reprodução" }));
 expect(vi.mocked(ReproducaoAnimal).mock.calls.at(-1)?.[0].podeLancar).toBe(true);
 expect(screen.queryByRole("button", { name: "Registrar reprodução" })).toBeNull();
});


it.each(["resumo", "cadastro", "auditoria", "peso-manejo", "historico", "identificacao-genetica", "producao-leite"])("revela link antigo #%s e respeita a navegação pelo histórico", async (ancora) => {
  window.history.replaceState(null, "", `#${ancora}`);
  vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
  render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} />, { wrapper: Wrapper });
  await screen.findByRole("heading", { name: /Mimosa.*#1234/ });
  const nomeAba = ancora === "producao-leite" ? "Produção" : "Geral";
  expect(screen.getByRole("tab", { name: nomeAba }).getAttribute("aria-selected")).toBe("true");
  const destino = ancora === "peso-manejo" || ancora === "resumo" ? "peso" : ancora === "auditoria" ? "historico" : ancora;
  expect(document.getElementById(destino)).toBeTruthy();
  expect(document.getElementById(`${destino}-conteudo`)?.hidden).toBe(false);
  if (ancora !== "producao-leite") {
    fireEvent.click(document.querySelector<HTMLButtonElement>(`#${destino} button[aria-controls="${destino}-conteudo"]`)!);
    expect(document.getElementById(`${destino}-conteudo`)?.hidden).toBe(true);
  }
  fireEvent.click(screen.getByRole("tab", { name: "Sanidade" }));
  window.history.replaceState(null, "", `#${ancora}`);
  fireEvent.popState(window);
  await waitFor(() => expect(screen.getByRole("tab", { name: nomeAba }).getAttribute("aria-selected")).toBe("true"));
  await waitFor(() => expect(document.getElementById(`${destino}-conteudo`)?.hidden).toBe(false));
});

it("não apresenta a aba reprodução para machos", async () => {
  await montar({ ...base, sexo: "M" });
  expect(screen.queryByRole("tab", { name: "Reprodução" })).toBeNull();
});


it("oferece pesagem no resumo e ações reprodutivas no próprio domínio", async () => {
  vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
  render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} />, { wrapper: Wrapper });
  await screen.findByRole("heading", { name: /Mimosa.*#1234/ });
  expect(screen.getByRole("button", { name: "Registrar pesagem" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Registrar reprodução" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Reprodução" }));
  expect(screen.queryByRole("button", { name: "Registrar reprodução" })).toBeNull();
  expect(vi.mocked(ReproducaoAnimal).mock.calls.at(-1)?.[0].podeLancar).toBe(true);
  fireEvent.click(screen.getByRole("tab", { name: "Geral" }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar pesagem" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
});


it("recolhe somente os pais de Geral e mantém filhos de Peso inline", async () => {
  vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
  render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} />, { wrapper: Wrapper });
  await screen.findByRole("heading", { name: /Mimosa.*#1234/ });
  expect(screen.getByText("GMD recente")).toBeTruthy();
  expect(screen.getByText("Nenhuma pesagem registrada.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Manejo/ })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Manejo" })).toBeNull();
  const peso = screen.getByRole("button", { name: "Peso" });
  fireEvent.click(peso);
  expect(peso.getAttribute("aria-expanded")).toBe("false");
  expect(document.getElementById("peso-conteudo")?.hidden).toBe(true);
  fireEvent.click(peso);
  expect(document.getElementById("peso-conteudo")?.hidden).toBe(false);
  expect(screen.queryByRole("button", { name: "Evolução do peso" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Últimas pesagens" })).toBeNull();
});

it("explica indisponibilidade no sítio e permite voltar à lista sem expor outro sítio", async () => {
  setPropriedadeAtiva(2);
  try {
    vi.mocked(buscarFichaAnimal).mockRejectedValue(new RebanhoApiError("Animal não encontrado", 404));
    const voltar = vi.fn();
    render(<ToastProvider><DetalheAnimal id="a" onVoltar={voltar}/></ToastProvider>);
    await screen.findByRole("heading", { name: "Animal não disponível no sítio selecionado" });
    fireEvent.click(screen.getByRole("button", { name: "Voltar para animais" }));
    expect(voltar).toHaveBeenCalledOnce();
  } finally { setPropriedadeAtiva(null); }
});
it("falha técnica não é apresentada como animal ausente", async () => {
  vi.mocked(buscarFichaAnimal).mockRejectedValue(new RebanhoApiError("Serviço indisponível", 503));
  render(<ToastProvider><DetalheAnimal id="a" onVoltar={() => {}}/></ToastProvider>);
  await screen.findByText("Serviço indisponível");
  expect(screen.queryByRole("heading", { name: /Animal não/ })).toBeNull();
});

// A consulta continua disponível em tabela; estes cenários verificam suas colunas e comandos.
beforeEach(preferirTabelas);
it("link do protocolo conserva hash, sítio explícito e retorno na ficha", async () => {
  window.history.replaceState(null, "", "/pecuaria/rebanho/animais/animal-1?participacaoId=p1&programacaoId=g1&sitio=7&retorno=%2Fpecuaria%2Freproducao%2Fprogramacoes%2Fg1%3Fsitio%3D7#reproducao");
  vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
  render(<DetalheAnimal id="animal-1" onVoltar={vi.fn()} />, { wrapper: Wrapper });
  await screen.findByText("Mimosa");
  expect(screen.getByRole("tab", { name: "Reprodução" }).getAttribute("aria-selected")).toBe("true");
  expect(buscarFichaAnimal).toHaveBeenCalledWith("animal-1", { periodoDias: "entrada" }, 7);
  expect(vi.mocked(ReproducaoAnimal).mock.calls.at(-1)?.[0].propriedadeId).toBe(7);
  expect(screen.getByRole("link", { name: "Voltar ao protocolo" }).getAttribute("href")).toBe("/pecuaria/reproducao/programacoes/g1?sitio=7");
});

 it("oferece regularização histórica na ficha ativa com permissão de lançamento", async () => {
  await montar(base);
  fireEvent.click(screen.getByRole("button", { name: "Regularizar baixa histórica" }));
  expect(await screen.findByRole("dialog", { name: "Regularizar baixa histórica" })).toBeTruthy();
});
it("omite regularização histórica para usuário de consulta", async () => {
  vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
  render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} podeLancar={false} />, { wrapper: Wrapper });
  await screen.findByText("Mimosa");
  expect(screen.queryByRole("button", { name: "Regularizar baixa histórica" })).toBeNull();
});

it.each(["animal", "sitio"])("ignora resposta de ficha obsoleta ao trocar %s", async contexto => {
  let resolver!: (animal: AnimalFicha) => void;
  vi.mocked(buscarFichaAnimal).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; })).mockResolvedValue({ ...base, id: "animal-2", nome: "Atual" });
  const { rerender } = render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} />, { wrapper: Wrapper });
  if (contexto === "animal") {
    rerender(<DetalheAnimal id="animal-2" onVoltar={vi.fn()} />);
  } else {
    window.history.replaceState(null, "", "?sitio=2#geral");
    fireEvent.popState(window);
  }
  await screen.findByRole("heading", { name: /Atual.*#1234/ });
  await act(async () => { resolver(base); });
  expect(screen.queryByRole("heading", { name: /Mimosa/ })).toBeNull();
  expect(screen.getByRole("heading", { name: /Atual.*#1234/ })).toBeTruthy();
});

it.each([false, true])("preserva acesso de manejo para animal baixado com podeLancar=%s", async podeLancar => {
  const baixado: AnimalFicha = { ...base, situacao: "BAIXADO", baixa: { id: "b", data: "2026-01-10", tipo: "VENDA", motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null } };
  vi.mocked(buscarFichaAnimal).mockResolvedValue(baixado);
  render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} podeLancar={podeLancar} />, { wrapper: Wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "Desmama e castração" }));
  expect(await screen.findByRole("dialog", { name: "Desmama e castração" })).toBeTruthy();
  expect(vi.mocked(ManejoAnimal).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ animalId: base.id, propriedadeId: 1, baixaData: "2026-01-10", podeLancar }));
});
it("preserva consulta de manejo de animal ativo para leitor", async () => {
  vi.mocked(buscarFichaAnimal).mockResolvedValue(base);
  render(<DetalheAnimal id={base.id} onVoltar={vi.fn()} podeLancar={false} />, { wrapper: Wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "Desmama e castração" }));
  expect(await screen.findByRole("dialog", { name: "Desmama e castração" })).toBeTruthy();
  expect(vi.mocked(ManejoAnimal).mock.calls.at(-1)?.[0].podeLancar).toBe(false);
});

it("preserva origem e revogação do papel no histórico sem tabela complementar", async () => {
  await montar({ ...base, historicoPapeisReprodutivos: [{ id: "papel-1", tipo: "RECEPTORA", inicio: "2025-01-01", fim: "2025-03-01", origem: "IDEAGRI", revogado: true }] });
  const historico = document.getElementById("historico")!;
  expect(within(historico).getByText("Papel reprodutivo · registro desfeito")).toBeTruthy();
  expect(within(historico).getByText("01/01/2025 – 01/03/2025")).toBeTruthy();
  expect(within(historico).getByText("Importado do IDEAGRI · Desfeito · preservado no histórico")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Histórico do papel reprodutivo" })).toBeNull();
});
