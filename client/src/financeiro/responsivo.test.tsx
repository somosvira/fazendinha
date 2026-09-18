// @vitest-environment jsdom
/* Invariantes de layout das telas financeiras (issue #247).
 *
 * jsdom não faz layout, então não dá para medir overflow de verdade aqui. O que
 * estes testes travam são as CAUSAS estruturais do overflow e do desalinhamento
 * — as mesmas que foram corrigidas e conferidas no navegador em 320/375/768/
 * 1024/1440px:
 *
 *   1. largura mínima só existe DENTRO de um contêiner com rolagem própria;
 *   2. cabeçalho e conteúdo de uma coluna nascem do mesmo `alinhamento`;
 *   3. toda tabela tem representação de cartão no mobile;
 *   4. o carregamento é o loader de página centralizado, não um bloco solto;
 *   5. toda página financeira usa o mesmo envelope (gutter + folga do menu).
 */
import { baseFinanceiraVazia } from "./dashboard.fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TabelaFinanceira, type ColunaTabela } from "./financeiro-ui";

const { obterDashboardFinanceiro, obterConfiguracoesFinanceiras, listarCompromissos, listarOperacoes, obterExtratoConta, obterRascunhoOperacao, listarRelatoriosFinanceiros, obterRascunhoRelatorioFinanceiro } = vi.hoisted(() => ({
  obterDashboardFinanceiro: vi.fn(), obterConfiguracoesFinanceiras: vi.fn(), listarCompromissos: vi.fn(),
  listarOperacoes: vi.fn(), obterExtratoConta: vi.fn(), obterRascunhoOperacao: vi.fn(),
  listarRelatoriosFinanceiros: vi.fn(), obterRascunhoRelatorioFinanceiro: vi.fn(),
}));
vi.mock("./novo-api", () => ({
  obterExtratoGeral: vi.fn().mockResolvedValue([]),
  obterAnaliseCategorias: vi.fn().mockResolvedValue({ base: "compras", total: "0", categorias: [], linhas: [] }),
  obterDashboardFinanceiro, obterConfiguracoesFinanceiras, listarCompromissos, listarOperacoes, obterExtratoConta,
  liquidarCompromisso: vi.fn(), transferir: vi.fn(), criarConta: vi.fn(), criarParceiro: vi.fn(),
  atualizarConta: vi.fn(), atualizarParceiro: vi.fn(), obterOperacao: vi.fn(), estornarOperacao: vi.fn(),
  criarOperacao: vi.fn(), anexarDocumentoOperacao: vi.fn(),
  obterRascunhoOperacao, descartarRascunhoOperacao: vi.fn(), salvarRascunhoOperacao: vi.fn(),
  listarRelatoriosFinanceiros, obterRascunhoRelatorioFinanceiro, salvarRascunhoRelatorioFinanceiro: vi.fn(),
}));

// Nunca resolve: congela cada tela no estado de carregamento.
const pendente = () => new Promise(() => {});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

// ── helpers ────────────────────────────────────────────────────────────────
const rolaHorizontal = (el: Element) => /overflow-x-auto|overflow-x-scroll/.test(el.className);

/** Elementos que forçam largura mínima — por classe Tailwind ou style inline. */
function comLarguraMinima(raiz: HTMLElement) {
  return [...raiz.querySelectorAll<HTMLElement>("*")].filter(
    (el) => /min-w-\[\d+px\]/.test(el.className) || !!el.style.minWidth,
  );
}

function temAncestralRolavel(el: Element, raiz: Element) {
  for (let p = el.parentElement; p && p !== raiz.parentElement; p = p.parentElement) if (rolaHorizontal(p)) return true;
  return false;
}

const alinhamentoDe = (el: Element) => (el.className.includes("text-right") ? "direita" : "esquerda");

// ── fixtures ───────────────────────────────────────────────────────────────
type Linha = { id: number; nome: string; valor: string };
const LINHAS: Linha[] = [{ id: 1, nome: "Cooperativa Agropecuária dos Produtores de Leite do Alto Paranaíba", valor: "R$ 184.500,90" }];
const COLUNAS: ColunaTabela<Linha>[] = [
  { chave: "nome", titulo: "Parceiro", larguraMinima: 260, principal: true, celula: (l) => <strong>{l.nome}</strong> },
  { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 130, celula: (l) => <span>{l.valor}</span> },
];

describe("TabelaFinanceira", () => {
  it("prende a largura mínima ao contêiner que rola — nunca à página", () => {
    const { container } = render(<TabelaFinanceira rotulo="Operações" itens={LINHAS} colunas={COLUNAS} chaveDe={(l) => l.id} />);
    const tabela = container.querySelector("table")!;
    expect(tabela.style.minWidth).toBe("390px"); // 260 + 130
    expect(rolaHorizontal(tabela.parentElement!)).toBe(true);
    // e nenhum elemento com largura mínima escapa de um contêiner rolável
    for (const el of comLarguraMinima(container)) expect(temAncestralRolavel(el, container)).toBe(true);
  });

  it("deriva o alinhamento do cabeçalho e do conteúdo da mesma declaração", () => {
    const { container } = render(<TabelaFinanceira rotulo="Operações" itens={LINHAS} colunas={COLUNAS} chaveDe={(l) => l.id} />);
    const cabecalhos = [...container.querySelectorAll("thead th")];
    const celulas = [...container.querySelectorAll("tbody tr")[0].querySelectorAll("td")];
    expect(cabecalhos).toHaveLength(COLUNAS.length);
    COLUNAS.forEach((coluna, i) => {
      const esperado = coluna.alinhamento ?? "esquerda";
      expect(alinhamentoDe(cabecalhos[i])).toBe(esperado);
      expect(alinhamentoDe(celulas[i])).toBe(esperado);
    });
  });

  it("oferece cartões no mobile e tabela do md para cima", () => {
    const { container } = render(<TabelaFinanceira rotulo="Operações" itens={LINHAS} colunas={COLUNAS} chaveDe={(l) => l.id} />);
    const tabela = container.querySelector("table")!.closest("div")!;
    const cartoes = container.querySelector("ul")!;
    expect(tabela.className).toContain("hidden");
    expect(tabela.className).toContain("md:block");
    expect(cartoes.className).toContain("md:hidden");
    // o cartão repete todo o conteúdo da linha — nada fica só na tabela
    expect(cartoes.textContent).toContain(LINHAS[0].nome);
    expect(cartoes.textContent).toContain(LINHAS[0].valor);
  });

  it("mantém a linha acionável pelo teclado quando ela abre um detalhe", () => {
    const abrir = vi.fn();
    const { container } = render(<TabelaFinanceira rotulo="Operações" itens={LINHAS} colunas={COLUNAS} chaveDe={(l) => l.id} onAbrir={abrir} />);
    const linha = container.querySelector("tbody tr")!;
    expect(linha.getAttribute("tabindex")).toBe("0");
    // não vira role="button": isso tiraria a linha da semântica de tabela
    expect(linha.getAttribute("role")).toBeNull();
    expect(container.querySelector("ul button")).toBeTruthy(); // no cartão, um botão de verdade
  });
});

describe("telas financeiras — envelope e carregamento", () => {
  const telas: [string, () => Promise<{ render: () => JSX.Element }>][] = [
    ["Visão geral", async () => { const m = await import("./VisaoGeralFinanceira"); return { render: () => <m.VisaoGeralFinanceira onNav={() => {}} /> }; }],
    ["Operações", async () => { const m = await import("./OperacoesFinanceiras"); return { render: () => <m.OperacoesFinanceiras /> }; }],
    ["Compromissos", async () => { const m = await import("./CompromissosFinanceiros"); return { render: () => <m.CompromissosFinanceiros onNav={() => {}} /> }; }],
    ["Contas e extratos", async () => { const m = await import("./ContasFinanceiras"); return { render: () => <m.ContasFinanceiras onNav={() => {}} /> }; }],
    ["Configurações financeiras", async () => { const m = await import("./ConfiguracoesFinanceiras"); return { render: () => <m.ConfiguracoesFinanceiras /> }; }],
    ["Relatórios", async () => { const m = await import("./RelatoriosFinanceiros"); return { render: () => <m.RelatoriosFinanceiros /> }; }],
  ];

  it.each(telas)("%s centraliza o carregamento na área de conteúdo", async (_nome, carregar) => {
    for (const mock of [obterDashboardFinanceiro, obterConfiguracoesFinanceiras, listarCompromissos, listarOperacoes, obterExtratoConta, listarRelatoriosFinanceiros]) mock.mockImplementation(pendente);
    obterRascunhoOperacao.mockResolvedValue(null);
    const { render: renderizar } = await carregar();
    const { container } = render(renderizar());

    const loader = container.querySelector(".loader")!;
    expect(loader, "toda tela usa o mesmo dialeto de loading").toBeTruthy();
    expect(loader.className).toContain("loader--pagina");
    expect(screen.getByRole("status")).toBeTruthy();

    // A coluna de carregamento mede uma viewport e o loader toma a sobra. Ela NÃO
    // pode ser a `.pagina-financeira`: o padding vertical daquela somaria por fora
    // dos 100dvh e criaria barra de rolagem (medido: +40px desktop, +96px mobile).
    const raiz = container.firstElementChild!;
    expect(raiz.className).toContain("shell-wide");
    expect(raiz.className).toContain("pagina-carregando");
    expect(raiz.className).not.toContain("pagina-financeira");
    expect(loader.parentElement, "o loader é filho direto da coluna que mede a viewport").toBe(raiz);
  });

  it.each([
    ["Contas e extratos", async () => { const m = await import("./ContasFinanceiras"); return () => <m.ContasFinanceiras onNav={() => {}} />; }],
    ["Configurações financeiras", async () => { const m = await import("./ConfiguracoesFinanceiras"); return () => <m.ConfiguracoesFinanceiras />; }],
  ] as [string, () => Promise<() => JSX.Element>][])("%s mostra o erro em vez de girar para sempre", async (_nome, carregar) => {
    // Telas que só renderizam com `config` carregada: sem este caminho, uma falha
    // deixa `config` nula, o guard de carregamento vence e o ErrorBox nunca é
    // alcançado — a tela fica girando e o usuário não vê o motivo.
    for (const mock of [obterConfiguracoesFinanceiras, obterExtratoConta]) mock.mockRejectedValue(new Error("Falha simulada no servidor"));
    obterRascunhoOperacao.mockResolvedValue(null);
    const renderizar = await carregar();
    const { container, findByRole } = render(renderizar());

    const alerta = await findByRole("alert");
    expect(alerta.textContent).toContain("Falha simulada no servidor");
    expect(container.querySelector(".loader"), "o loader some quando há erro").toBeNull();
  });

  it.each(telas)("%s não solta largura mínima fora de um contêiner rolável", async (_nome, carregar) => {
    obterDashboardFinanceiro.mockResolvedValue({
      periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, saldoGeral: "1628514.34",
      contas: [{ id: 1, nome: "Banco do Brasil — conta corrente principal", tipo: "BANCO", instituicao: "Banco do Brasil S.A.", identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-01-01", saldoAtual: "1284530.75", incluirNoSaldoGeral: true, ativo: true }],
      realizado: { entradas: "412870.22", saidas: "298345.68", resultado: "114524.54" },
      fluxo: [{ data: "2026-09-02", entradas: "412870.22", saidas: "298345.68" }],
      compromissos: { aPagar: "204500.9", aReceber: "278140.55" },
      base: baseFinanceiraVazia(), proximosCompromissos: [],
      despesasPorCategoria: [{ categoriaId: 1, categoria: "Nutrição e alimentação do rebanho leiteiro", valor: "184500.9" }],
    });
    obterConfiguracoesFinanceiras.mockResolvedValue({
      contas: [{ id: 1, nome: "Banco do Brasil — conta corrente principal", tipo: "BANCO", instituicao: "Banco do Brasil S.A.", identificacao: null, saldoAbertura: "0", dataSaldoAbertura: "2026-01-01", saldoAtual: "1284530.75", incluirNoSaldoGeral: true, ativo: true }],
      parceiros: [{ id: 1, nome: "Cooperativa Agropecuária dos Produtores de Leite do Alto Paranaíba Ltda.", documento: "12.345.678/0001-99", tipo: "FORNECEDOR", telefone: null, email: null, ativo: true }],
      categorias: [], centrosCusto: [], produtos: [],
    });
    listarCompromissos.mockResolvedValue([{
      id: 1, tipo: "PAGAR", status: "PENDENTE", valorOriginal: "184500.9", valorLiquidado: "0", saldoPendente: "184500.9",
      dataVencimento: "2026-09-15", vencido: false, parceiro: null, operacao: { id: 41, tipo: "COMPRA_ESTOQUE", descricao: "Compra de ração concentrada 22% PB" },
    }]);
    listarOperacoes.mockResolvedValue([{
      id: 41, tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", data: "2026-09-02", descricao: "Compra de ração concentrada 22% PB",
      valorTotal: "184500.9", parceiro: null, itens: [], compromissos: [], transacoes: [], movimentosEstoque: [], documentos: [],
    }]);
    obterExtratoConta.mockResolvedValue([]);
    obterRascunhoOperacao.mockResolvedValue(null);
    listarRelatoriosFinanceiros.mockResolvedValue([]);
    obterRascunhoRelatorioFinanceiro.mockResolvedValue(null);

    const { render: renderizar } = await carregar();
    const { container, findByRole } = render(renderizar());
    await findByRole("heading", { level: 1 });

    for (const el of comLarguraMinima(container)) {
      expect(temAncestralRolavel(el, container), `${el.tagName}.${el.className} força largura mínima sem contêiner rolável`).toBe(true);
    }
  });
});
