import { alterarControle } from "../../../lib/controles.fixture";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import { ListaAnimais } from "./ListaAnimais";
import { buscarFichaAnimal, desfazerMovimentacao, listarAnimais, listarCategorias, movimentarAnimais, obterCatalogos } from "../api";
import type { AnimalFicha, AnimalResumo, Catalogos } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarAnimais: vi.fn(),
  listarCategorias: vi.fn(),
  obterCatalogos: vi.fn(),
  buscarFichaAnimal: vi.fn(),
  movimentarAnimais: vi.fn(),
  desfazerMovimentacao: vi.fn(),
}));

const painelVazio = { totalAtivos: 0, porCategoria: [], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };
const vazio = { itens: [], total: 0, painel: painelVazio };

const categoriaVaca = { id: "cat-vaca", nome: "Vaca", sexo: "F" as const, automatica: true, ativo: true, ordem: 10, idadeMinMeses: null, idadeMaxMeses: null, partos: "COM" as const, ideagriId: 7, padrao: true, regra: "com parto", animaisAtivos: 0, manuaisAbertas: 0 };
const catVaca = { id: "cat-vaca", nome: "Vaca" };

function criarAnimal(overrides: Partial<AnimalResumo>): AnimalResumo {
  return {
    id: "a1", brinco: "0001", nome: null, sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 30, idadeNaBaixa: false,
    dataNascimento: "2023-01-01", dataEntrada: "2023-01-01", origem: "NASCIDO",
    propriedade: { id: 1, nome: "Sede" }, lote: null, aptidao: "LEITE", papelReprodutivo: "NENHUM",
    composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
    gmdRecente: null, noLocalDesde: null, baixa: null,
    ...overrides,
  };
}

function criarFicha(overrides: Partial<AnimalFicha>): AnimalFicha {
  return {
    ...criarAnimal({}),
    brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 0, observacao: null,
    composicao: [], historicoLocalizacoes: [], historicoDestinos: [], historicoPesagens: [], historicoCategoriasManuais: [],
    baixa: null,
    peso: { ultimo: null, gmdRecente: null, gmdDesdeEntrada: null, gmdPeriodo: { dias: null, valor: null, pesagens: 0 } },
    historicoBaixas: [],
    filiacao: { mae: null, pai: null },
    filhosCount: 0,
    ...overrides,
  };
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

function montar(props: Partial<Parameters<typeof ListaAnimais>[0]> = {}) {
  return render(<ListaAnimais onAbrirAnimal={vi.fn()} onNovoAnimal={vi.fn()} {...props} />, { wrapper: Wrapper });
}

/* A TabelaFinanceira renderiza tabela E cartões simultaneamente no jsdom;
 * pegamos sempre a primeira ocorrência (mesma convenção de ListaLotes.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

afterEach(() => { cleanup(); vi.useRealTimers(); window.history.pushState(null, "", "/pecuaria/rebanho/animais"); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver",class {observe(){} unobserve(){} disconnect(){}});
  if(!HTMLElement.prototype.scrollIntoView)HTMLElement.prototype.scrollIntoView=()=>{};
  vi.mocked(listarAnimais).mockResolvedValue(vazio as never);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: [categoriaVaca], semCategoria: 0 });
  vi.mocked(obterCatalogos).mockResolvedValue({ racas: [{ id: "raca-1", nome: "Nelore", sigla: "NE", base: true }], motivosBaixa: [], propriedades: [{ id: 1, nome: "Sede", apelido: null }], lotes: [] } as Catalogos);
});

function escolherMultiplo(label:string, valor:string) {
  const nomes:Record<string,string>={F:"Fêmeas",M:"Machos",COMPRADO:"Comprado",NASCIDO:"Nascido","raca-1":"Nelore","cat-vaca":"Vaca",ATIVO:"Ativos",BAIXADO:"Baixados"};
  fireEvent.click(screen.getByRole("button",{name:label}));
  fireEvent.click(screen.getByRole("option",{name:nomes[valor]??valor}));
  fireEvent.keyDown(screen.getByPlaceholderText("Buscar opção…"),{key:"Escape"});
}
describe("ListaAnimais", () => {
  it("prioriza busca e lista sem repetir composição e indicadores do panorama", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    await screen.findAllByText("0001");
    expect(screen.getByRole("tab", { name: "Animais", selected: true })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Buscar por brinco ou nome" })).toBeTruthy();
    expect(screen.queryByLabelText("Resumo da consulta de animais")).toBeNull();
    expect(screen.queryByText("Composição por categoria")).toBeNull();
  });
  it("selecionar todos fica na barra de filtros e só mostra ações coletivas após seleção", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    const { container } = montar();
    const checkbox = await screen.findByRole("checkbox", { name: "Selecionar todos os animais desta página" });
    expect(checkbox.closest(".rebanho-filtros-principais")).toBeTruthy();
    expect(container.querySelector(".animais-acoes-coletivas")).toBeNull();
    fireEvent.click(checkbox);
    expect(screen.getByRole("button", { name: "Pesagem coletiva" })).toBeTruthy();
    expect(container.querySelector(".animais-acoes-coletivas")).toBeTruthy();
  });
  it.each(["aptidao=REPRODUCAO", "aptidoes=LEITE&aptidoes=REPRODUCAO"])("restaura finalidade da URL %s e renderiza Reprodução", async consulta => {
    window.history.replaceState(null, "", `/pecuaria/rebanho/animais?${consulta}`);
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({ aptidao: "REPRODUCAO" })], total: 1, painel: painelVazio });
    montar();
    await screen.findAllByText("0001");
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.click(screen.getByLabelText("Mostrar todas as colunas"));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getAllByText("Reprodução").length).toBeGreaterThan(0);
    const esperado = consulta.startsWith("aptidao=") ? { aptidao: "REPRODUCAO" } : { aptidoes: ["LEITE", "REPRODUCAO"] };
    expect(vi.mocked(listarAnimais).mock.calls.at(-1)?.[0]).toMatchObject(esperado);
    expect(screen.getByRole("button", { name: "Remover filtro: Finalidade: Reprodução" })).toBeTruthy();
    expect(window.location.search).toContain("REPRODUCAO");
  });

  it("seleciona Reprodução no filtro de finalidade e conserva a chave aptidoes na URL", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    escolherMultiplo("Finalidade", "Reprodução");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)?.[0]).toMatchObject({ aptidoes: ["REPRODUCAO"] }));
    expect(new URLSearchParams(window.location.search).getAll("aptidoes")).toEqual(["REPRODUCAO"]);
  });

  it("seleciona pelo espaço ao redor do checkbox sem abrir a ficha", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    const onAbrirAnimal = vi.fn();
    montar({ onAbrirAnimal });
    const checkbox = (await screen.findAllByRole("checkbox", { name: "Selecionar 0001" }))[0];
    fireEvent.click(checkbox.closest("label")!);
    expect(onAbrirAnimal).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pesagem coletiva" })).toBeTruthy();
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });
  it("mostra e remove o filtro aplicado no painel", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    escolherMultiplo("Sexo", "F");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro: Sexo: Fêmeas" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]?.sexo).toBeUndefined());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("busca espera 300 ms sem digitar e faz uma única requisição", async () => {
    vi.useFakeTimers();
    montar();
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    const campo = screen.getByLabelText("Buscar por brinco ou nome");
    for (const texto of ["1", "10", "100", "1001"]) {
      await alterarControle(campo, { target: { value: texto } });
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    }
    expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    const novas = vi.mocked(listarAnimais).mock.calls.slice(inicial);
    expect(novas).toHaveLength(1);
    expect(novas[0][0]).toMatchObject({ busca: "1001", page: 1 });
  });

  it("aplicar o filtro dispara uma única busca, já na página 1", async () => {
    montar();
    await screen.findByRole("button", { name: "Filtros" });
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    if (!screen.queryByRole("dialog")) fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    escolherMultiplo("Categoria", "cat-vaca");
    expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial + 1));
    const novas = vi.mocked(listarAnimais).mock.calls.slice(inicial);
    expect(novas).toHaveLength(1);
    expect(novas[0][0]).toMatchObject({ categoriaIds: ["cat-vaca"], page: 1 });
  });

  it("sem permissão de lançar não oferece Novo animal", async () => {
    montar({ podeLancar: false });
    await screen.findByText("Nenhum animal encontrado com os filtros selecionados.");
    expect(screen.queryByRole("button", { name: /Novo animal/ })).toBeNull();
  });

  it("editar ignora a resposta de um clique anterior que chega fora de ordem (U3)", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001" }), criarAnimal({ id: "a2", brinco: "0002" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 2, painel: painelVazio });
    let resolverA1: (v: AnimalFicha) => void = () => undefined;
    vi.mocked(buscarFichaAnimal).mockImplementation((id) => {
      if (id === "a1") return new Promise((resolve) => { resolverA1 = resolve; });
      return Promise.resolve(criarFicha({ id: "a2", brinco: "0002" }));
    });
    montar();
    await screen.findAllByText("0001");

    // clica em editar 0001 (fica pendente) e depois em 0002 (resolve primeiro)
    fireEvent.click(primeiro("button", "Editar 0001"));
    fireEvent.click(primeiro("button", "Editar 0002"));
    await screen.findByRole("heading", { name: "Editar 0002" });

    // a resposta tardia do clique em 0001 não deve substituir a ficha já aberta
    resolverA1(criarFicha({ id: "a1", brinco: "0001" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("heading", { name: "Editar 0002" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Editar 0001" })).toBeNull();
  });

  it("animal baixado não tem checkbox nem ações de editar/movimentar (K3)", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001", situacao: "ATIVO" }), criarAnimal({ id: "a2", brinco: "0002", situacao: "BAIXADO" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 2, painel: painelVazio });
    montar();
    await screen.findAllByText("0002");

    expect(primeiro("checkbox", "Selecionar 0001")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Selecionar 0002" })).toBeNull();
    expect(primeiro("button", "Editar 0001")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar 0002" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Movimentar 0002" })).toBeNull();

    // "selecionar todos" considera só os ativos
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos os animais desta página" }));
    expect((primeiro("checkbox", "Selecionar 0001") as HTMLInputElement).checked).toBe(true);
  });

  it("mantém a seleção coletiva ao refinar a busca", async () => {
    const primeiroAnimal = criarAnimal({ id: "a1", brinco: "GV3-S1" });
    const segundoAnimal = criarAnimal({ id: "a2", brinco: "GV3-S2" });
    vi.mocked(listarAnimais).mockImplementation(async ({ busca }) => ({
      itens: busca === "GV3-S2" ? [segundoAnimal] : [primeiroAnimal, segundoAnimal],
      total: busca === "GV3-S2" ? 1 : 2,
      painel: painelVazio,
    } as never));
    montar();
    await screen.findAllByText("GV3-S1");

    fireEvent.click(primeiro("checkbox", "Selecionar GV3-S1"));
    expect(screen.getByText("1 selecionado")).toBeTruthy();
    await alterarControle(screen.getByLabelText("Buscar por brinco ou nome"), { target: { value: "GV3-S2" } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await screen.findAllByText("GV3-S2");

    expect(screen.getByText("1 selecionado")).toBeTruthy();
    expect((primeiro("checkbox", "Selecionar GV3-S2") as HTMLInputElement).checked).toBe(false);
  });

  it("movimentar mostra o toast com Desfazer, igual ao da página do lote (K8)", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001" })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 1, painel: painelVazio });
    vi.mocked(movimentarAnimais).mockResolvedValue({ movimentacaoId: "mov-1", movidos: 1 });
    vi.mocked(desfazerMovimentacao).mockResolvedValue({ desfeitos: 1 });
    montar();
    await screen.findAllByText("0001");

    fireEvent.click(primeiro("button", "Movimentar 0001"));
    const painel = await screen.findByRole("dialog");
    await alterarControle(within(painel).getByLabelText("Sítio de destino"), { target: { value: "1" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Movimentar" }));

    const toast = await screen.findByText("1 animal movimentado");
    expect(toast).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(desfazerMovimentacao).toHaveBeenCalledWith("mov-1", "Desfeito logo após a movimentação"));
  });

  it("sexo, origem e raça são enviados para listarAnimais", async () => {
    // itens não-vazios: uma nova busca não deve fazer a página inteira voltar
    // ao loader entre uma troca de filtro e a próxima (K1 — só a tabela recarrega)
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    await screen.findByRole("button", {name:"Raça"});
    escolherMultiplo("Sexo", "F");
    escolherMultiplo("Origem", "COMPRADO");
    escolherMultiplo("Raça", "raca-1");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ sexos: ["F"], origens: ["COMPRADO"], racaIds: ["raca-1"], page: 1 }));
  });

  it("idade mínima e máxima (em meses) são enviadas como número", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    await screen.findByLabelText("Idade mínima (meses)");
    await alterarControle(screen.getByLabelText("Idade mínima (meses)"), { target: { value: "12" } });
    await alterarControle(screen.getByLabelText("Idade máxima (meses)"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ idadeMinMeses: 12, idadeMaxMeses: 24 }));
  });

  it("categoria \"Sem categoria\" envia semCategoria e \"Só forçadas\" envia categoriaOrigem", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    const select = await screen.findByLabelText("Critério especial de categoria") as HTMLSelectElement;
    await alterarControle(select, { target: { value: "__sem_categoria__" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ semCategoria: true }));
    expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0].categoriaId).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await alterarControle(screen.getByLabelText("Critério especial de categoria"), { target: { value: "__so_forcadas__" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ categoriaOrigem: "MANUAL" }));
  });

  it("ordenação troca ordenar e direcao", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    const select = await screen.findByLabelText("Ordenar por") as HTMLSelectElement;
    await alterarControle(select, { target: { value: "nascimento-desc" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ ordenar: "nascimento", direcao: "desc" }));
  });

  it("tipo de baixa e período só aparecem com Baixados/Todas e são enviados", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    await screen.findByRole("button", {name:"Situação"});
    expect(screen.queryByLabelText("Filtrar por tipo de baixa")).toBeNull();
    escolherMultiplo("Situação", "BAIXADO");
    await screen.findByLabelText("Filtrar por tipo de baixa");
    await alterarControle(screen.getByLabelText("Filtrar por tipo de baixa"), { target: { value: "VENDA" } });
    await alterarControle(screen.getByLabelText("Baixa de"), { target: { value: "2026-01-01" } });
    await alterarControle(screen.getByLabelText("Baixa até"), { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(vi.mocked(listarAnimais).mock.calls.at(-1)![0]).toMatchObject({ situacoes: ["ATIVO", "BAIXADO"], tipoBaixa: "VENDA", baixaDe: "2026-01-01", baixaAte: "2026-03-01" }));
  });

  it("lê os filtros iniciais da query string (deep-link da Visão geral/Cadastros)", async () => {
    window.history.pushState(null, "", "/pecuaria/rebanho/animais?situacao=BAIXADO&tipoBaixa=VENDA&semCategoria=true");
    montar();
    await waitFor(() => expect(listarAnimais).toHaveBeenCalled());
    expect(vi.mocked(listarAnimais).mock.calls[0][0]).toMatchObject({ situacao: "BAIXADO", tipoBaixa: "VENDA", semCategoria: true });
    fireEvent.click(await screen.findByRole("button", { name: "Filtros" }));
    expect(screen.getByRole("button", {name:"Situação"}).textContent).toContain("Baixados");
  });

  it("mostra o GMD recente na coluna GMD", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001", gmdRecente: 0.512 })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 1, painel: painelVazio });
    montar();
    await screen.findAllByText("0001");
    expect(screen.getAllByText("+0,512 kg/dia").length).toBeGreaterThan(0);
  });

  it("situação identifica baixados sem repetir uma coluna de baixa", async () => {
    const itens = [criarAnimal({ id: "a1", brinco: "0001", situacao: "BAIXADO", baixa: { data: "2026-01-10", tipo: "VENDA" } })];
    vi.mocked(listarAnimais).mockResolvedValue({ itens, total: 1, painel: painelVazio });
    montar();
    await screen.findAllByText("0001");
    expect(screen.queryByText("Venda")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    escolherMultiplo("Situação", "BAIXADO");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listarAnimais).toHaveBeenLastCalledWith(expect.objectContaining({ situacoes: ["ATIVO", "BAIXADO"] })));
    expect(screen.queryByRole("columnheader",{name:"Baixa"})).toBeNull();
  });

  it("mostra somente os filtros selecionados na página", async () => {
    const painelComDados = { totalAtivos: 42, porCategoria: [{ categoria: catVaca, total: 30 }, { categoria: null, total: 12 }], porSitio: [], femeasAtivas: 0, receptorasAtivas: 0 };
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [], total: 0, painel: painelComDados });
    montar();
    await screen.findByText("Nenhum animal encontrado com os filtros selecionados.");
    expect(screen.queryByLabelText("Resumo da consulta de animais")).toBeNull();
    expect(screen.getByRole("button", { name: "Remover filtro: Situação: Ativos" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Filtrar por categoria" })).toBeNull();
  });
});


describe("Pesagem e manejo", () => {
  it("reutiliza a seleção da lista e abre a pesagem coletiva existente", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({ nome: "Aurora" })], total: 1, painel: painelVazio });
    montar({ variante: "pesagem" });
    await screen.findByRole("heading", { name: "Pesagem e manejo" });
    fireEvent.click(primeiro("checkbox", "Selecionar 0001"));
    expect(screen.queryByRole("button", { name: "Aplicação sanitária coletiva" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo animal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pesagem coletiva" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByLabelText(/0001 · Aurora · peso/)).toBeTruthy();
    expect(within(painel).getByRole("button", { name: "Conferir pesos" })).toBeTruthy();
  });

  it("mantém os filtros adicionais e dá acesso às colunas completas", async () => {
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [criarAnimal({})], total: 1, painel: painelVazio });
    montar();
    await screen.findAllByText("0001");
    expect(screen.queryByRole("columnheader", { name: "Idade" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.getByRole("button", { name: "Papel reprodutivo" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Mostrar todas as colunas"));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getByRole("columnheader", { name: "Idade" })).toBeTruthy();
    const nav = screen.getByText("Animais", { selector: "button" }).parentElement!;
    expect(within(nav).getAllByRole("tab").map((b) => b.textContent)).toEqual(["Visão geral", "Animais", "Alertas", "Lotes"]);
  });
});

it("não apresenta vazio confirmado enquanto o próximo filtro está carregando", async()=>{
 let resolver: (v:typeof vazio)=>void=()=>{};
 vi.mocked(listarAnimais).mockResolvedValueOnce(vazio).mockReturnValueOnce(new Promise(resolve=>{resolver=resolve;}));
 montar(); await screen.findByText("Nenhum animal encontrado com os filtros selecionados.");
 await alterarControle(screen.getByLabelText("Buscar por brinco ou nome"),{target:{value:"nova busca"}});
 await waitFor(()=>expect(listarAnimais).toHaveBeenCalledTimes(2));
 expect(screen.getByRole("status").textContent).toContain("Atualizando animais");
 expect(screen.queryByText("Nenhum animal encontrado com os filtros selecionados.")).toBeNull();
 await act(async()=>resolver(vazio));
 expect(screen.getByText("Nenhum animal encontrado com os filtros selecionados.")).toBeTruthy();
});

it("recupera uma página que deixou de existir sem afirmar ausência de animais",async()=>{
 window.history.replaceState({},"","/pecuaria/rebanho/animais?page=3");
 let concluir!: (resultado: Awaited<ReturnType<typeof listarAnimais>>) => void;
 const proximaPagina = new Promise<Awaited<ReturnType<typeof listarAnimais>>>(resolve => { concluir = resolve; });
 vi.mocked(listarAnimais).mockImplementation(filtros => filtros?.page === 1 ? proximaPagina : Promise.resolve({itens:[],total:5,painel:painelVazio}));
 montar();
 await waitFor(()=>expect(vi.mocked(listarAnimais).mock.calls.at(-1)?.[0]?.page).toBe(1));
 expect(screen.queryByText("Nenhum animal encontrado com os filtros selecionados.")).toBeNull();
 await act(async()=>concluir({itens:[criarAnimal({})],total:5,painel:painelVazio}));
 await screen.findAllByText("0001");
 expect(vi.mocked(listarAnimais).mock.calls.at(-1)?.[0]?.page).toBe(1);
 expect(screen.queryByText("Nenhum animal encontrado com os filtros selecionados.")).toBeNull();
 expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
});


describe("rascunho dos filtros de animais", () => {
  it("só atualiza consulta e URL ao aplicar o conjunto de alterações", async () => {
    montar();
    await screen.findByText("Nenhum animal encontrado com os filtros selecionados.");
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    const endereco = window.location.href;
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    escolherMultiplo("Sexo", "F");
    await alterarControle(screen.getByLabelText("Idade mínima (meses)"), { target: { value: "12" } });
    await alterarControle(screen.getByLabelText("Idade máxima (meses)"), { target: { value: "24" } });
    expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial);
    expect(window.location.href).toBe(endereco);
    expect(screen.queryByRole("button", { name: "Remover filtro: Sexo: Fêmeas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listarAnimais).toHaveBeenCalledTimes(inicial + 1));
    expect(vi.mocked(listarAnimais).mock.calls.at(-1)?.[0]).toMatchObject({ sexos: ["F"], idadeMinMeses: 12, idadeMaxMeses: 24, page: 1 });
    expect(new URLSearchParams(window.location.search).get("idadeMinMeses")).toBe("12");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["Cancelar", "Fechar"])("%s descarta alterações e reabre os filtros efetivamente aplicados", async (acao) => {
    window.history.replaceState(null, "", "/pecuaria/rebanho/animais?idadeMinMeses=6");
    montar();
    await screen.findByText("Nenhum animal encontrado com os filtros selecionados.");
    const inicial = vi.mocked(listarAnimais).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    await alterarControle(screen.getByLabelText("Idade mínima (meses)"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: acao }));
    expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial);
    expect(new URLSearchParams(window.location.search).get("idadeMinMeses")).toBe("6");
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    expect((screen.getByLabelText("Idade mínima (meses)") as HTMLInputElement).value).toBe("6");
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect((screen.getByLabelText("Idade mínima (meses)") as HTMLInputElement).value).toBe("");
    expect(new URLSearchParams(window.location.search).get("idadeMinMeses")).toBe("6");
    expect(vi.mocked(listarAnimais).mock.calls.length).toBe(inicial);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(listarAnimais).toHaveBeenCalledTimes(inicial + 1));
    expect(new URLSearchParams(window.location.search).has("idadeMinMeses")).toBe(false);
  });
});
