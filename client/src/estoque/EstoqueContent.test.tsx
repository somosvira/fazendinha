// @vitest-environment jsdom
import { abrirFiltrosConsulta, aplicarFiltrosConsulta } from "@/lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { uid } from "../lib/uid.fixture";
import { SEM_VINCULO } from "../lib/ids";
import { getPropriedadeAtiva, setPropriedadeAtiva } from "../propriedadeScope";

vi.mock("../financeiro/FormProduto", () => ({ FormProduto: () => null }));

import { EstoqueContent } from "./EstoqueContent";

type Dados = { saldos?: unknown[]; movimentos?: unknown[]; entradas?: unknown[] };

// Espiona o `fetch` global (o `req()` de estoque/api.ts passa por ele) em vez de
// mockar o módulo — `useSaldos` chama `listarSaldos` como identificador local
// dentro do mesmo arquivo, então mockar só o export não intercepta a chamada.
function mockFetch(d: Dados = {}) {
  const pagina = (itens: unknown[]) => ({ itens, total: itens.length });
  return vi.fn((url: string, _init?: RequestInit) => {
    const body = /\/estoque\/saldos/.test(url) ? d.saldos ?? []
      : /\/estoque\/movimentos\?tipo=ENTRADA/.test(url) ? pagina(d.entradas ?? [])
      : /\/estoque\/movimentos/.test(url) ? pagina(d.movimentos ?? [])
      : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

const produtoId = uid(1);
const centroId = uid(5);
const categoria = { id: uid(100), nome: "Alimentação", };
const saldo = (o: Record<string, unknown>) => ({ produtoId, nome: "Ração", materialGeneticoId: null, categoria, unidade: "KG", centrosCusto: [], saldo: 15, custoMedio: 6, valor: 90, minimoEstoque: null, abaixoMinimo: false, ...o });
const mov = (o: Record<string, unknown>) => ({ id: uid(10), seq: 1, produtoId, produto: "Ração", materialGeneticoId: null, centrosCusto: [], tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, data: "2026-09-10", quantidade: 10, custoUnitario: 6, valorTotal: 60, fornecedor: null, observacao: null, operacaoId: null, operacaoNumero: null, vinculo: null, ...o });

function sessao(areas: string[], flags: string[] = [], dono = false) {
  localStorage.setItem("rionovo:usuario", JSON.stringify({ id: 1, nome: "T", email: "t@x", papel: "x", abas: [], areas, flags, status: "ATIVO", dono }));
}

async function selecionarFiltro(rotulo: string, opcao: string) {
  let lateral: HTMLElement | null = null;
  if (!screen.queryByLabelText(rotulo)) {
    const botoes = screen.getAllByRole("button", { name: /Filtros/ });
    fireEvent.click(botoes[botoes.length - 1]);
    lateral = await screen.findByRole("dialog", {name:"Filtros"});
  }
  fireEvent.click(screen.getByLabelText(rotulo));
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
  if(lateral){fireEvent.click(within(lateral).getByRole("button",{name:"Aplicar filtros"})); await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Filtros"})).toBeNull());}
}

const resumoEstoque = () => within(document.querySelector<HTMLElement>(".estoque-resumo-consulta")!);
function mostrarMovimentos() { fireEvent.mouseDown(screen.getByRole("tab", { name: "Movimentações" })); }

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); setPropriedadeAtiva(null); window.history.replaceState({}, "", "/"); });
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch());
  if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = vi.fn();
});

function chamouSaldos(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.some(([url]) => /\/estoque\/saldos/.test(String(url)));
}

describe("EstoqueContent — filtro inicial vindo do módulo", () => {
  it("usa o escopo consolidado da sidebar e descarta filtro de sítio redundante", async () => {
    window.history.replaceState(null, "", "/estoque?propriedadeId=7");
    const consulta = mockFetch();
    vi.stubGlobal("fetch", consulta);
    render(<EstoqueContent />);
    await waitFor(() => expect(consulta.mock.calls.filter(([url]) => /\/estoque\/(saldos|movimentos)/.test(url)).length).toBe(3));
    for (const [, init] of consulta.mock.calls.filter(([url]) => /\/estoque\/(saldos|movimentos)/.test(url))) expect(init?.headers).not.toHaveProperty("X-Propriedade-Id");
    expect(getPropriedadeAtiva()).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Sítio no estoque" })).toBeNull();
    expect(new URLSearchParams(window.location.search).get("propriedadeId")).toBeNull();
  });
  it("mantém consulta no sítio ativo e descarta filtro URL incompatível", async () => {
    setPropriedadeAtiva(2);
    window.history.replaceState(null, "", "/estoque?propriedadeId=7");
    const consulta = mockFetch();
    vi.stubGlobal("fetch", consulta);
    render(<EstoqueContent />);
    await waitFor(() => expect(consulta.mock.calls.some(([url]) => /\/estoque\/saldos/.test(url))).toBe(true));
    for (const [, init] of consulta.mock.calls.filter(([url]) => /\/estoque\/(saldos|movimentos)/.test(url))) expect(init?.headers).toMatchObject({ "X-Propriedade-Id": "2" });
    expect(new URLSearchParams(window.location.search).get("propriedadeId")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Sítio no estoque" })).toBeNull();
    expect(getPropriedadeAtiva()).toBe(2);
  });
  it("abre o movimento exato no sítio histórico e oferece o estorno", async () => {
    window.history.replaceState({}, "", `/estoque?movimentoId=${uid(10)}&propriedadeId=7`);
    const scroll = vi.fn();
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    try {
      sessao(["pecuaria"]);
      vi.stubGlobal("fetch", mockFetch({ movimentos: [mov({ propriedadeId: 7, status: "REVERTIDO", estorno: { id: uid(11) } })] }));
      render(<EstoqueContent />);
      const link = (await screen.findAllByRole("link", { name: "Ver estorno" }))[0];
      expect(link.getAttribute("href")).toBe(`/estoque?movimentoId=${uid(11)}&propriedadeId=7`);
      const historico = screen.getByRole("region", { name: "Histórico de movimentos" });
      await waitFor(() => expect(document.activeElement).toBe(historico));
      expect(scroll).toHaveBeenCalled();
      const chamada = (fetch as unknown as ReturnType<typeof mockFetch>).mock.calls.find(([url]) => String(url).includes("movimentoId="));
      expect(String(chamada?.[0])).toContain("propriedadeId=7");
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("explica quando o movimento indicado não está disponível", async () => {
    window.history.replaceState({}, "", `/estoque?movimentoId=${uid(10)}`);
    render(<EstoqueContent />);
    expect(await screen.findByText("Movimento não encontrado neste sítio ou indisponível para seu acesso.")).toBeTruthy();
  });
  it("busca saldos já com o centro quando `centroCustoIdInicial` é passado (string)", () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent centroCustoIdInicial={centroId} />);
    const chamada = fetchMock.mock.calls.find(([url]) => /\/estoque\/saldos/.test(String(url)));
    expect(chamada).toBeTruthy();
    expect(String(chamada![0])).toContain(`centroCustoId=${centroId}`);
    // exatamente 1 chamada a saldos — sem uma busca sem filtro antes.
    expect(fetchMock.mock.calls.filter(([url]) => /\/estoque\/saldos/.test(String(url)))).toHaveLength(1);
  });

  it("busca saldos assim que o filtro é resolvido (mesmo null, sem centro cadastrado)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent centroCustoIdInicial={null} avisoFiltro="Centro não cadastrado" />);
    expect(chamouSaldos(fetchMock)).toBe(true);
    expect(await screen.findByText("Centro não cadastrado")).toBeTruthy();
  });

  it("sem centroCustoIdInicial (menu /estoque direto) busca saldos sem filtro uma vez", () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent />);
    const chamadasSaldos = fetchMock.mock.calls.filter(([url]) => /\/estoque\/saldos/.test(String(url)));
    expect(chamadasSaldos).toHaveLength(1);
    expect(String(chamadasSaldos[0][0])).not.toContain("centroCustoId");
  });

  it("não mostra custo vaca/dia nem vacas em lactação (só dados de estoque)", async () => {
    render(<EstoqueContent />);
    await resumoEstoque().findByText("Valor em estoque");
    expect(screen.queryByText(/custo vaca/i)).toBeNull();
    expect(screen.queryByText(/vacas em lacta/i)).toBeNull();
    expect((fetch as unknown as ReturnType<typeof mockFetch>).mock.calls.some(([url]) => /custo-vaca-dia/.test(String(url)))).toBe(false);
  });
});

describe("EstoqueContent — saldos e custo médio", () => {
  it("nome abre a ficha do produto e preserva o atalho da identidade genética", async () => {
    const materialId = uid(8);
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ nome: "Sêmen Zeus", materialGeneticoId: materialId })] }));
    render(<EstoqueContent />);
    const link = (await screen.findAllByRole("link", { name: "Sêmen Zeus" }))[0] as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(`/estoque/produtos/${produtoId}`);
    expect(screen.getAllByRole("link", { name: "Identidade genética" })[0].getAttribute("href")).toBe(`/pecuaria/rebanho/cadastros?aba=material-genetico&material=${materialId}`);
  });
  it("mostra custo médio e valor (saldo × médio); sem custo, '—'", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [
      saldo({}),
      saldo({ produtoId: 2, nome: "Sal", categoria: { ...categoria, id: 2, nome: "Mineral" }, saldo: 4, custoMedio: null, valor: 0 }),
    ] }));
    render(<EstoqueContent />);
    const tabela = await screen.findByRole("table", { name: "Saldos de estoque" });
    const racao = within(tabela).getByText("Ração").closest("tr")!;
    const celulas = [...racao.querySelectorAll("td")].map((td) => td.textContent?.replace(/\u00a0/g, " "));
    expect(celulas.join(" ")).toContain("R$ 6,00");
    expect(celulas.join(" ")).toContain("R$ 90,00");
    const sal = within(tabela).getByText("Sal").closest("tr")!;
    expect(sal.querySelector('[data-fin-coluna="valor"]')?.textContent).toBe("—");
    expect(screen.getByRole("columnheader", { name: "Valor em estoque" })).toBeTruthy();
  });

  it("card Valor em estoque soma o valor dos saldos listados", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({}), saldo({ produtoId: 2, nome: "Sal", valor: 10.5 })] }));
    render(<EstoqueContent />);
    const card = (await resumoEstoque().findByText("Valor em estoque")).closest("section")!;
    expect(card.textContent?.replace(/\u00a0/g, " ")).toContain("R$ 100,50");
    expect(within(card).queryByText(/produtos? com movimento/)).toBeNull();
  });

  it("não carrega a antiga consulta geral de lotes dos produtos", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent />);
    await resumoEstoque().findByText("Valor em estoque");
    expect(screen.queryByRole("heading", { name: "Lotes dos produtos" })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => /\/pecuaria\/nutricao\/partidas|\/estoque\/produtos.*lotes/.test(String(url)))).toBe(false);
  });

  it("card Valor em estoque ignora valores negativos e avisa (com filtro) os produtos com saldo negativo", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({}), saldo({ produtoId: 2, nome: "Sal", saldo: -3, valor: -20 })] }));
    render(<EstoqueContent />);
    const card = (await resumoEstoque().findByText("Valor em estoque")).closest("section")!;
    expect(card.textContent?.replace(/\u00a0/g, " ")).toContain("R$ 90,00");
    const tabela = () => within(screen.getByRole("table", { name: "Saldos de estoque" }));
    expect(tabela().getByText("Ração")).toBeTruthy();
    await abrirFiltrosConsulta();
    const aviso = screen.getByRole("checkbox", { name: /Saldo negativo/ });
    fireEvent.click(aviso);
    await aplicarFiltrosConsulta();
    expect(tabela().queryByText("Ração")).toBeNull();
    expect(tabela().getByText("Sal")).toBeTruthy();
  });

  it("sem saldo negativo não mostra o aviso", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})] }));
    render(<EstoqueContent />);
    await resumoEstoque().findByText("Valor em estoque");
    expect(screen.queryByText(/saldo negativo/)).toBeNull();
  });

  it("reúne valor e produtos com saldo positivo e mostra entradas sem colapso", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({}), saldo({ produtoId: 2, nome: "Sal", saldo: 0, valor: 0 })] }));
    render(<EstoqueContent />);
    const card = (await screen.findByText("1 produto em estoque")).closest("section")!;
    expect(within(card).getByText("1 produto em estoque")).toBeTruthy();
    expect(within(card).queryByText(/^de \d+ produtos? com movimento/)).toBeNull();
    expect(resumoEstoque().getByText("Valor em estoque")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Últimas entradas" })).toBeNull();
    mostrarMovimentos();
    expect(screen.getByText("Últimas entradas").closest("details")).toBeNull();
    expect(screen.queryByText("Itens abaixo do mínimo")).toBeNull();
    expect(screen.queryByText("Produtos sem custo apurado")).toBeNull();
  });

  it("a tabela de saldos não tem botão de editar produto", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})] }));
    sessao(["financeiro"], ["lancar"]);
    render(<EstoqueContent />);
    await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(screen.queryByRole("button", { name: /^Editar/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Ajustar quantidade de Ração" }).length).toBeGreaterThan(0);
  });

  it("produto abaixo do mínimo mostra aviso textual junto à quantidade", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ minimoEstoque: 50, abaixoMinimo: true })] }));
    render(<EstoqueContent />);
    const tabela = within(await screen.findByRole("table", { name: "Saldos de estoque" }));
    expect(tabela.getByText(/Abaixo do mínimo · Mín. 50 kg/)).toBeTruthy();
  });

  it("cada movimento distingue direção e origem", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos: [mov({ id: 1, tipo: "SAIDA", origem: "APLICACAO" })] }));
    render(<EstoqueContent />);
    mostrarMovimentos();
    const tabela = within(await screen.findByRole("table", { name: "Histórico de movimentos" }));
    expect(tabela.getByText("Aplicação agrícola")).toBeTruthy();
    expect(tabela.getByText("Saída")).toBeTruthy();
  });

  it("botão Só abaixo do mínimo filtra a lista ao clicar", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ minimoEstoque: 50, abaixoMinimo: true }), saldo({ produtoId: 2, nome: "Sal" })] }));
    render(<EstoqueContent />);
    const tabela = await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(within(tabela).getByText("Sal")).toBeTruthy();
    await abrirFiltrosConsulta();
    fireEvent.click(screen.getByRole("checkbox", { name: /Só abaixo do mínimo/ }));
    await aplicarFiltrosConsulta();
    expect(within(screen.getByRole("table", { name: "Saldos de estoque" })).queryByText("Sal")).toBeNull();
    expect(within(screen.getByRole("table", { name: "Saldos de estoque" })).getByText("Ração")).toBeTruthy();
  });

  it("Últimas entradas: os 6 produtos com entrada mais recente (compra/inventário/bonificação/produção), sem estornos", async () => {
    const saldos = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => saldo({ produtoId: uid(i), nome: `Produto ${i}` }));
    const entradas = [
      mov({ id: uid(20), produtoId: uid(1), produto: "Produto 1", data: "2026-09-20", operacaoId: uid(90), operacaoNumero: 90, reversaoDeId: uid(5), origem: "AJUSTE_INVENTARIO" }), // estorno: ignora
      mov({ id: uid(19), produtoId: uid(2), produto: "Produto 2", data: "2026-09-19", operacaoId: uid(80), operacaoNumero: 80 }),
      mov({ id: uid(18), produtoId: uid(2), produto: "Produto 2", data: "2026-09-18", operacaoId: uid(70), operacaoNumero: 70 }), // produto repetido: ignora
      mov({ id: uid(17), produtoId: uid(3), produto: "Produto 3", data: "2026-09-17", origem: "INVENTARIO_INICIAL", operacaoId: uid(60), operacaoNumero: 60, quantidade: 5 }),
      mov({ id: uid(16), produtoId: uid(1), produto: "Produto 1", data: "2026-09-16", origem: "BONIFICACAO", operacaoId: uid(50), operacaoNumero: 50 }),
      mov({ id: uid(15), produtoId: uid(4), produto: "Produto 4", data: "2026-09-15", operacaoId: uid(40), operacaoNumero: 40 }),
      mov({ id: uid(14), produtoId: uid(5), produto: "Produto 5", data: "2026-09-14", operacaoId: uid(30), operacaoNumero: 30 }),
      mov({ id: uid(13), produtoId: uid(6), produto: "Produto 6", data: "2026-09-13", operacaoId: uid(20), operacaoNumero: 20 }),
      mov({ id: uid(12), produtoId: uid(7), produto: "Produto 7", data: "2026-09-12", operacaoId: uid(10), operacaoNumero: 10 }), // 7º: fora
    ];
    vi.stubGlobal("fetch", mockFetch({ saldos, entradas }));
    render(<EstoqueContent />);
    mostrarMovimentos();
    const card = (await screen.findByText("Últimas entradas")).closest("section")!;
    expect(within(card).getByRole("heading", { name: "Últimas entradas" })).toBeTruthy();
    await waitFor(() => expect(within(card).getAllByRole("link")).toHaveLength(6));
    const links = within(card).getAllByRole("link") as HTMLAnchorElement[];
    expect(links.map((a) => a.textContent)).toEqual(["Produto 2", "Produto 3", "Produto 1", "Produto 4", "Produto 5", "Produto 6"]);
    expect(links[0].getAttribute("href")).toBe(`/financeiro/operacoes/${uid(80)}`);
    expect(within(card).getByText(/17\/09\/2026 · 5 kg/)).toBeTruthy();
  });

  it("não mostra a contagem 'N de M produtos' acima da tabela, mesmo com filtro", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ minimoEstoque: 50, abaixoMinimo: true }), saldo({ produtoId: 2, nome: "Sal" })] }));
    render(<EstoqueContent />);
    await screen.findByRole("table", { name: "Saldos de estoque" });
    await abrirFiltrosConsulta();
    fireEvent.click(screen.getByRole("checkbox", { name: /Só abaixo do mínimo/ }));
    await aplicarFiltrosConsulta();
    expect(screen.queryByText(/^\d+ de \d+ produtos?\.$/)).toBeNull();
  });

  it("o botão do filtro 'Só abaixo do mínimo' leva o mesmo ícone da linha", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ minimoEstoque: 50, abaixoMinimo: true })] }));
    render(<EstoqueContent />);
    await screen.findByRole("table", { name: "Saldos de estoque" });
    await abrirFiltrosConsulta();
    const botao = screen.getByRole("checkbox", { name: /Só abaixo do mínimo/ }).closest("label")!;
    expect(botao.querySelector('[data-testid="icone-abaixo-minimo"]')).not.toBeNull();
  });

  it("saldos são paginados de 15 em 15", async () => {
    const saldos = Array.from({ length: 16 }, (_, i) => saldo({ produtoId: i + 1, nome: `Produto ${String(i + 1).padStart(2, "0")}` }));
    vi.stubGlobal("fetch", mockFetch({ saldos }));
    render(<EstoqueContent />);
    const tabela = () => within(screen.getByRole("table", { name: "Saldos de estoque" }));
    await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(tabela().getByText("Produto 15")).toBeTruthy();
    expect(tabela().queryByText("Produto 16")).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Paginação de saldos" });
    expect(within(nav).getByText("1–15 de 16 produtos")).toBeTruthy();
    fireEvent.click(within(nav).getByRole("button", { name: "Próxima" }));
    expect(tabela().getByText("Produto 16")).toBeTruthy();
    expect(tabela().queryByText("Produto 01")).toBeNull();
  });
});

describe("EstoqueContent — histórico de movimentos", () => {
  const urlsMovimentos = (f: ReturnType<typeof mockFetch>) => f.mock.calls.map(([u]) => String(u)).filter((u) => /\/estoque\/movimentos\?/.test(u) && !u.includes("tipo=ENTRADA"));

  it("separa produtos de movimentações sem repetir cabeçalhos", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos: [mov({})] }));
    render(<EstoqueContent />);
    expect(await screen.findByRole("table", { name: "Saldos de estoque" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Histórico de movimentos" })).toBeNull();
    mostrarMovimentos();
    expect(screen.getByRole("table", { name: "Histórico de movimentos" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Saldos de estoque" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Saldos de estoque" })).toBeNull();
  });

  it("pede ao servidor 15 por página e envia busca, origem e centro de custo", async () => {
    const f = mockFetch({ saldos: [saldo({})], movimentos: [mov({})] });
    vi.stubGlobal("fetch", f);
    render(<EstoqueContent />);
    mostrarMovimentos();
    await screen.findByRole("table", { name: "Histórico de movimentos" });
    expect(urlsMovimentos(f).at(-1)).toContain("porPagina=15");
    expect(urlsMovimentos(f).at(-1)).toContain("pagina=1");

    fireEvent.change(screen.getByLabelText("Buscar movimento"), { target: { value: "OP-0011" } });
    await waitFor(() => expect(urlsMovimentos(f).at(-1)).toContain("q=OP-0011"));
    await selecionarFiltro("Filtrar por origem", "Compra");
    await waitFor(() => expect(urlsMovimentos(f).at(-1)).toContain("origem=COMPRA"));
    await selecionarFiltro("Filtrar histórico por centro de custo", "Sem centro");
    await waitFor(() => expect(urlsMovimentos(f).at(-1)).toContain(`centroCustoId=${SEM_VINCULO}`));
  });

  it("com filtro e nenhum resultado, avisa que nada bate", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos: [] }));
    render(<EstoqueContent />);
    mostrarMovimentos();
    await screen.findByText("Nenhum movimento registrado ainda.");
    await selecionarFiltro("Filtrar por origem", "Compra");
    expect(await screen.findByText("Nenhum movimento bate com os filtros.")).toBeTruthy();
  });
});

describe("EstoqueContent — histórico ligado à origem", () => {
  const opId = uid(42);
  const opNumero = 42;
  const movimentos = [
    mov({ id: uid(1), origem: "COMPRA", operacaoId: opId, operacaoNumero: opNumero, fornecedor: "Cooperativa" }),
    mov({ id: uid(4), tipo: "SAIDA", origem: "SANIDADE", vinculo: { tipo: "APLICACAO_SANITARIA", id: uid(5), animalId: uid(6) } }),
  ];
  const abrir = async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos }));
    render(<EstoqueContent />);
    mostrarMovimentos();
    return within(await screen.findByRole("table", { name: "Histórico de movimentos" }));
  };

  it("linha com operação renderiza link para o detalhe da operação", async () => {
    const tabela = await abrir();
    const link = tabela.getByRole("link", { name: "OP-0042" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(`/financeiro/operacoes/${opId}`);
    expect(tabela.getByText(/Cooperativa/)).toBeTruthy();
  });

  it("clicar no link navega sem recarregar (pushState + popstate)", async () => {
    const tabela = await abrir();
    const pop = vi.fn();
    window.addEventListener("popstate", pop);
    fireEvent.click(tabela.getByRole("link", { name: "OP-0042" }));
    expect(window.location.pathname).toBe(`/financeiro/operacoes/${opId}`);
    expect(pop).toHaveBeenCalled();
    window.removeEventListener("popstate", pop);
  });

  it("saídas automáticas levam à aplicação sanitária quando o usuário tem a área", async () => {
    const tabela = await abrir();
    expect(tabela.getByRole("link", { name: "Aplicação sanitária" }).getAttribute("href")).toContain("/pecuaria/rebanho/sanidade?");
  });

  it("sem a área de destino mostra texto puro com o motivo no title (operação sem financeiro)", async () => {
    sessao(["pecuaria"]);
    const tabela = await abrir();
    expect(tabela.queryByRole("link", { name: "OP-0042" })).toBeNull();
    expect(tabela.getByText("OP-0042").getAttribute("title")).toBe("Sem acesso a esta área");
    // pecuária tem acesso à aplicação sanitária
    expect(tabela.getByRole("link", { name: "Aplicação sanitária" })).toBeTruthy();
  });

  it("movimento estornado/estorno é sinalizado", async () => {
    const opId2 = uid(1);
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos: [mov({ id: uid(11), status: "REVERTIDO", operacaoId: opId2, operacaoNumero: 1 }), mov({ id: uid(12), tipo: "SAIDA", reversaoDeId: uid(11), operacaoId: opId2, operacaoNumero: 1 })] }));
    render(<EstoqueContent />);
    mostrarMovimentos();
    const tabela = within(await screen.findByRole("table", { name: "Histórico de movimentos" }));
    expect(tabela.getByText("Estornado")).toBeTruthy();
    expect(tabela.getByText("Estorno")).toBeTruthy();
  });
});

describe("EstoqueContent — atalho Ajustar quantidade", () => {
  it("abre Nova operação já com tipo=AJUSTE_ESTOQUE e o produto", async () => {
    const prod33 = uid(33);
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ produtoId: prod33 })] }));
    render(<EstoqueContent />);
    const tabela = within(await screen.findByRole("table", { name: "Saldos de estoque" }));
    fireEvent.click(tabela.getByRole("button", { name: "Ajustar quantidade de Ração" }));
    expect(window.location.pathname).toBe("/financeiro/operacoes/nova");
    expect(new URLSearchParams(window.location.search).get("tipo")).toBe("AJUSTE_ESTOQUE");
    expect(new URLSearchParams(window.location.search).get("produto")).toBe(prod33);
  });

  it("botão do cabeçalho abre o ajuste sem produto", async () => {
    render(<EstoqueContent />);
    fireEvent.pointerDown(await screen.findByRole("button", { name: "Movimentar estoque" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ajustar quantidade" }));
    expect(window.location.search).toBe("?tipo=AJUSTE_ESTOQUE");
  });

  it("some para quem não tem a área financeiro", async () => {
    sessao(["pecuaria"]);
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})] }));
    render(<EstoqueContent />);
    await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(screen.queryByRole("button", { name: /Ajustar quantidade/ })).toBeNull();
  });

  it("some para quem tem a área financeiro mas não a permissão lancar", async () => {
    sessao(["financeiro"]);
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})] }));
    render(<EstoqueContent />);
    await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(screen.queryByRole("button", { name: /Ajustar quantidade/ })).toBeNull();
  });

  it("aparece com a área financeiro + lancar, e para o dono", async () => {
    sessao(["financeiro"], ["lancar"]);
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})] }));
    render(<EstoqueContent />);
    await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(screen.getAllByRole("button", { name: /Ajustar quantidade/ }).length).toBeGreaterThan(0);
    cleanup();
    sessao([], [], true);
    render(<EstoqueContent />);
    await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(screen.getAllByRole("button", { name: /Ajustar quantidade/ }).length).toBeGreaterThan(0);
  });
});

it("atalho de reposição seleciona Produtos e preserva os filtros ao alternar abas", async () => {
  vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ minimoEstoque: 50, abaixoMinimo: true }), saldo({ produtoId: uid(2), nome: "Sal" })] }));
  render(<EstoqueContent />);
  await screen.findByRole("table", { name: "Saldos de estoque" });
  mostrarMovimentos();
  expect(new URLSearchParams(window.location.search).get("aba")).toBe("movimentacoes");
  fireEvent.click(screen.getByRole("button", { name: "1 abaixo do mínimo" }));
  expect(screen.getByRole("tab", { name: "Produtos" }).getAttribute("aria-selected")).toBe("true");
  const tabela = within(screen.getByRole("table", { name: "Saldos de estoque" }));
  expect(tabela.getByText("Ração")).toBeTruthy();
  expect(tabela.queryByText("Sal")).toBeNull();
  fireEvent.change(screen.getByLabelText("Buscar produto"), { target: { value: "Ração" } });
  mostrarMovimentos();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Produtos" }));
  expect((screen.getByLabelText("Buscar produto") as HTMLInputElement).value).toBe("Ração");
  expect(screen.getByRole("button", { name: "1 abaixo do mínimo" }).getAttribute("aria-pressed")).toBe("true");
});

it("não apresenta valor desconhecido como zero e acompanha a aba no histórico", async () => {
  vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ custoMedio: null, valor: null })] }));
  render(<EstoqueContent />);
  expect(await resumoEstoque().findByText("Indisponível")).toBeTruthy();
  expect(resumoEstoque().queryByText(/R\$.*0,00/)).toBeNull();
  mostrarMovimentos();
  window.history.replaceState(null, "", "/estoque?aba=produtos");
  fireEvent(window, new PopStateEvent("popstate"));
  expect(screen.getByRole("tab", { name: "Produtos" }).getAttribute("aria-selected")).toBe("true");
});
