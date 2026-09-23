// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("../financeiro/FormProduto", () => ({ FormProduto: () => null }));

import { EstoqueContent } from "./EstoqueContent";

type Dados = { saldos?: unknown[]; movimentos?: unknown[]; entradas?: unknown[] };

// Espiona o `fetch` global (o `req()` de estoque/api.ts passa por ele) em vez de
// mockar o módulo — `useSaldos` chama `listarSaldos` como identificador local
// dentro do mesmo arquivo, então mockar só o export não intercepta a chamada.
function mockFetch(d: Dados = {}) {
  return vi.fn((url: string) => {
    const body = /\/estoque\/saldos/.test(url) ? d.saldos ?? []
      : /\/estoque\/movimentos\?tipo=ENTRADA/.test(url) ? d.entradas ?? []
      : /\/estoque\/movimentos/.test(url) ? d.movimentos ?? []
      : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

const categoria = { id: 1, nome: "Alimentação", usoSanitario: false, usoNutricional: true, usoAgricola: false };
const saldo = (o: Record<string, unknown>) => ({ produtoId: 1, nome: "Ração", categoria, unidade: "KG", centrosCusto: [], saldo: 15, custoMedio: 6, valor: 90, minimoEstoque: null, abaixoMinimo: false, ...o });
const mov = (o: Record<string, unknown>) => ({ id: 1, produtoId: 1, produto: "Ração", centrosCusto: [], tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", reversaoDeId: null, data: "2026-09-10", quantidade: 10, custoUnitario: 6, valorTotal: 60, fornecedor: null, grupo: null, observacao: null, operacaoId: null, vinculo: null, ...o });

function sessao(areas: string[], flags: string[] = [], dono = false) {
  localStorage.setItem("rionovo:usuario", JSON.stringify({ id: 1, nome: "T", email: "t@x", papel: "x", abas: [], areas, flags, status: "ATIVO", dono }));
}

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch());
});

function chamouSaldos(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.some(([url]) => /\/estoque\/saldos/.test(String(url)));
}

describe("EstoqueContent — filtro inicial vindo do módulo", () => {
  it("busca saldos já com o centro quando `centroCustoIdInicial` é passado (número)", () => {
    const fetchMock = fetch as unknown as ReturnType<typeof mockFetch>;
    render(<EstoqueContent centroCustoIdInicial={5} />);
    const chamada = fetchMock.mock.calls.find(([url]) => /\/estoque\/saldos/.test(String(url)));
    expect(chamada).toBeTruthy();
    expect(String(chamada![0])).toContain("centroCustoId=5");
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
    await screen.findByText("Valor em estoque");
    expect(screen.queryByText(/custo vaca/i)).toBeNull();
    expect(screen.queryByText(/vacas em lacta/i)).toBeNull();
    expect((fetch as unknown as ReturnType<typeof mockFetch>).mock.calls.some(([url]) => /custo-vaca-dia/.test(String(url)))).toBe(false);
  });
});

describe("EstoqueContent — saldos e custo médio", () => {
  it("mostra custo médio e valor (saldo × médio); sem custo, '—'", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [
      saldo({}),
      saldo({ produtoId: 2, nome: "Sal", categoria: { ...categoria, id: 2, nome: "Mineral" }, saldo: 4, custoMedio: null, valor: 0 }),
    ] }));
    render(<EstoqueContent />);
    const tabela = await screen.findByRole("table", { name: "Saldos de estoque" });
    const racao = within(tabela).getByText("Ração").closest("tr")!;
    const celulas = [...racao.querySelectorAll("td")].map((td) => td.textContent?.replace(/\u00a0/g, " "));
    expect(celulas).toContain("R$ 6,00");
    expect(celulas).toContain("R$ 90,00");
    const sal = within(tabela).getByText("Sal").closest("tr")!;
    expect([...sal.querySelectorAll("td")].filter((td) => td.textContent === "—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("columnheader", { name: "Custo médio" })).toBeTruthy();
  });

  it("card Valor em estoque soma o valor dos saldos listados", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({}), saldo({ produtoId: 2, nome: "Sal", valor: 10.5 })] }));
    render(<EstoqueContent />);
    const card = (await screen.findByText("Valor em estoque")).closest("section")!;
    expect(card.textContent?.replace(/\u00a0/g, " ")).toContain("R$ 100,50");
    expect(within(card).getByText("2 produtos com movimento")).toBeTruthy();
  });

  it("card Valor em estoque ignora valores negativos e avisa (com filtro) os produtos com saldo negativo", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({}), saldo({ produtoId: 2, nome: "Sal", saldo: -3, valor: -20 })] }));
    render(<EstoqueContent />);
    const card = (await screen.findByText("Valor em estoque")).closest("section")!;
    expect(card.textContent?.replace(/\u00a0/g, " ")).toContain("R$ 90,00");
    const aviso = screen.getByRole("button", { name: /1 produto com saldo negativo/ });
    const tabela = () => within(screen.getByRole("table", { name: "Saldos de estoque" }));
    expect(tabela().getByText("Ração")).toBeTruthy();
    fireEvent.click(aviso);
    expect(tabela().queryByText("Ração")).toBeNull();
    expect(tabela().getByText("Sal")).toBeTruthy();
  });

  it("sem saldo negativo não mostra o aviso", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})] }));
    render(<EstoqueContent />);
    await screen.findByText("Valor em estoque");
    expect(screen.queryByText(/saldo negativo/)).toBeNull();
  });

  it("mostra só 3 cards: Valor em estoque, Produtos em estoque e Últimas entradas", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({}), saldo({ produtoId: 2, nome: "Sal", saldo: 0, valor: 0 })] }));
    render(<EstoqueContent />);
    const card = (await screen.findByText("Produtos em estoque")).closest("section")!;
    expect(within(card).getByText("1")).toBeTruthy();
    expect(within(card).getByText("de 2 produtos com movimento")).toBeTruthy();
    expect(screen.getByText("Valor em estoque")).toBeTruthy();
    expect(screen.getByText("Últimas entradas")).toBeTruthy();
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

  it("produto abaixo do mínimo mostra o ícone com a dica, não uma pill de texto", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ minimoEstoque: 50, abaixoMinimo: true })] }));
    render(<EstoqueContent />);
    const tabela = within(await screen.findByRole("table", { name: "Saldos de estoque" }));
    expect(tabela.queryByText("Abaixo do mínimo")).toBeNull();
    fireEvent.click(tabela.getByRole("button", { name: "Abaixo do mínimo" }));
    expect(await screen.findByText("Abaixo do mínimo (50 kg)")).toBeTruthy();
  });

  it("cada movimento mostra uma pill só, com a origem", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos: [mov({ id: 1, tipo: "SAIDA", origem: "NUTRICAO" })] }));
    render(<EstoqueContent />);
    const tabela = within(await screen.findByRole("table", { name: "Movimentos de estoque" }));
    expect(tabela.getByText("Dieta")).toBeTruthy();
    expect(tabela.queryByText("Saída")).toBeNull();
  });

  it("botão Só abaixo do mínimo filtra a lista ao clicar", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ minimoEstoque: 50, abaixoMinimo: true }), saldo({ produtoId: 2, nome: "Sal" })] }));
    render(<EstoqueContent />);
    const tabela = await screen.findByRole("table", { name: "Saldos de estoque" });
    expect(within(tabela).getByText("Sal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Só abaixo do mínimo/ }));
    expect(within(screen.getByRole("table", { name: "Saldos de estoque" })).queryByText("Sal")).toBeNull();
    expect(within(screen.getByRole("table", { name: "Saldos de estoque" })).getByText("Ração")).toBeTruthy();
  });

  it("Últimas entradas: os 3 produtos com entrada mais recente (compra/inventário/bonificação/produção), sem estornos", async () => {
    const saldos = [1, 2, 3, 4].map((i) => saldo({ produtoId: i, nome: `Produto ${i}` }));
    const entradas = [
      mov({ id: 9, produtoId: 1, produto: "Produto 1", data: "2026-09-20", operacaoId: 90, reversaoDeId: 5, origem: "AJUSTE_INVENTARIO" }), // estorno: ignora
      mov({ id: 8, produtoId: 2, produto: "Produto 2", data: "2026-09-19", operacaoId: 80 }),
      mov({ id: 7, produtoId: 2, produto: "Produto 2", data: "2026-09-18", operacaoId: 70 }), // produto repetido: ignora
      mov({ id: 6, produtoId: 3, produto: "Produto 3", data: "2026-09-17", origem: "INVENTARIO_INICIAL", operacaoId: 60, quantidade: 5 }),
      mov({ id: 5, produtoId: 1, produto: "Produto 1", data: "2026-09-16", origem: "BONIFICACAO", operacaoId: 50 }),
      mov({ id: 4, produtoId: 4, produto: "Produto 4", data: "2026-09-15", operacaoId: 40 }), // 4º: fora
    ];
    vi.stubGlobal("fetch", mockFetch({ saldos, entradas }));
    render(<EstoqueContent />);
    const card = (await screen.findByText("Últimas entradas")).closest("section")!;
    await waitFor(() => expect(within(card).getAllByRole("link")).toHaveLength(3));
    const links = within(card).getAllByRole("link") as HTMLAnchorElement[];
    expect(links.map((a) => a.textContent)).toEqual(["Produto 2", "Produto 3", "Produto 1"]);
    expect(links[0].getAttribute("href")).toBe("/financeiro/operacoes/80");
    expect(within(card).getByText(/17\/09\/2026 · 5 kg/)).toBeTruthy();
  });
});

describe("EstoqueContent — movimentos recentes ligados à origem", () => {
  const movimentos = [
    mov({ id: 1, origem: "COMPRA", operacaoId: 42, fornecedor: "Cooperativa" }),
    mov({ id: 2, tipo: "SAIDA", origem: "NUTRICAO", vinculo: { tipo: "LOTE", id: 7, nome: "Lote A" } }),
    mov({ id: 3, tipo: "SAIDA", origem: "SANIDADE", vinculo: { tipo: "ANIMAL", id: 9, numero: "123", nome: "Mimosa" } }),
    mov({ id: 4, tipo: "SAIDA", origem: "APLICACAO", vinculo: { tipo: "TALHAO", id: 5, codigo: "T-05" } }),
  ];
  const abrir = async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos }));
    render(<EstoqueContent />);
    return within(await screen.findByRole("table", { name: "Movimentos de estoque" }));
  };

  it("linha com operação renderiza link para o detalhe da operação", async () => {
    const tabela = await abrir();
    const link = tabela.getByRole("link", { name: "OP-0042" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/financeiro/operacoes/42");
    expect(tabela.getByText(/Cooperativa/)).toBeTruthy();
  });

  it("clicar no link navega sem recarregar (pushState + popstate)", async () => {
    const tabela = await abrir();
    const pop = vi.fn();
    window.addEventListener("popstate", pop);
    fireEvent.click(tabela.getByRole("link", { name: "OP-0042" }));
    expect(window.location.pathname).toBe("/financeiro/operacoes/42");
    expect(pop).toHaveBeenCalled();
    window.removeEventListener("popstate", pop);
  });

  it("saídas automáticas levam ao lote, animal e talhão quando o usuário tem a área", async () => {
    const tabela = await abrir();
    expect(tabela.getByRole("link", { name: "Lote Lote A" }).getAttribute("href")).toBe("/pecuaria/nutricao");
    expect(tabela.getByRole("link", { name: "Animal 123 · Mimosa" }).getAttribute("href")).toBe("/pecuaria/animal?id=9");
    expect(tabela.getByRole("link", { name: "Talhão T-05" }).getAttribute("href")).toBe("/plantio/talhao?id=5");
  });

  it("sem a área de destino mostra texto puro com o motivo no title (dieta sem pecuária; operação sem financeiro)", async () => {
    sessao(["agricultura"]);
    const tabela = await abrir();
    expect(tabela.queryByRole("link", { name: /Lote A/ })).toBeNull();
    expect(tabela.queryByRole("link", { name: "OP-0042" })).toBeNull();
    expect(tabela.getByText("Lote Lote A").getAttribute("title")).toBe("Sem acesso a esta área");
    expect(tabela.getByText("OP-0042").getAttribute("title")).toBe("Sem acesso a esta área");
    // agricultura tem acesso ao talhão
    expect(tabela.getByRole("link", { name: "Talhão T-05" })).toBeTruthy();
  });

  it("movimento estornado/estorno é sinalizado", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({})], movimentos: [mov({ id: 1, status: "REVERTIDO", operacaoId: 1 }), mov({ id: 2, tipo: "SAIDA", reversaoDeId: 1, operacaoId: 1 })] }));
    render(<EstoqueContent />);
    const tabela = within(await screen.findByRole("table", { name: "Movimentos de estoque" }));
    expect(tabela.getByText("Estornado")).toBeTruthy();
    expect(tabela.getByText("Estorno")).toBeTruthy();
  });
});

describe("EstoqueContent — atalho Ajustar quantidade", () => {
  it("abre Nova operação já com tipo=AJUSTE_ESTOQUE e o produto", async () => {
    vi.stubGlobal("fetch", mockFetch({ saldos: [saldo({ produtoId: 33 })] }));
    render(<EstoqueContent />);
    const tabela = within(await screen.findByRole("table", { name: "Saldos de estoque" }));
    fireEvent.click(tabela.getByRole("button", { name: "Ajustar quantidade de Ração" }));
    expect(window.location.pathname).toBe("/financeiro/operacoes/nova");
    expect(new URLSearchParams(window.location.search).get("tipo")).toBe("AJUSTE_ESTOQUE");
    expect(new URLSearchParams(window.location.search).get("produto")).toBe("33");
  });

  it("botão do cabeçalho abre o ajuste sem produto", async () => {
    render(<EstoqueContent />);
    fireEvent.click(await screen.findByRole("button", { name: /Ajustar quantidade/ }));
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
