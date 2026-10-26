// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { brl, emDias, hoje, mesAtual, Modal, TabelaFinanceira } from "./financeiro-ui";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("tabela paginada compartilhada", () => {
  it("não insere setas nem rolagem vertical interna e mantém abertura por teclado", () => {
    const abrir = vi.fn();
    const { container } = render(<TabelaFinanceira compacta rotulo="Cadastros" itens={[{ id: "1", nome: "Cooperativa" }]} chaveDe={item => item.id} onAbrir={abrir} colunas={[{ chave: "nome", titulo: "Nome", principal: true, celula: item => item.nome }]} />);
    const linha = container.querySelector('tbody tr')!;
    fireEvent.keyDown(linha, { key: "Enter" });
    expect(abrir).toHaveBeenCalledWith({ id: "1", nome: "Cooperativa" });
    expect(container.querySelector('.lucide-chevron-right')).toBeNull();
    expect(container.innerHTML).not.toContain("overflow-y-auto");
    expect(container.innerHTML).not.toContain("max-h-");
  });
});

it("adapta a consulta à largura disponível e preserva a abertura após redimensionar", () => {
  let avisar = () => {};
  const observerOriginal = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { avisar = callback; }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  try {
    const abrir = vi.fn();
    const { container } = render(<TabelaFinanceira rotulo="Teste responsivo" itens={[{ id: "1", nome: "Registro" }]} chaveDe={item => item.id} onAbrir={abrir} colunas={[
      { chave: "nome", titulo: "Nome", principal: true, larguraMinima: 500, celula: item => item.nome },
      { chave: "detalhe", titulo: "Detalhe", larguraMinima: 400, celula: () => "Informação" },
    ]} />);
    const consulta = container.querySelector<HTMLElement>(".fin-consulta-responsiva")!;
    let largura = 700;
    Object.defineProperty(consulta, "clientWidth", { get: () => largura });
    act(() => avisar());
    expect(consulta.dataset.finVisualizacao).toBe("cartoes");
    largura = 1200;
    act(() => avisar());
    expect(consulta.dataset.finVisualizacao).toBe("tabela");
    largura = 500;
    act(() => avisar());
    expect(consulta.dataset.finVisualizacao).toBe("cartoes");
    fireEvent.click(container.querySelector(".fin-tabela-cartoes button")!);
    expect(abrir).toHaveBeenCalledWith({ id: "1", nome: "Registro" });
  } finally { globalThis.ResizeObserver = observerOriginal; }
});

describe("datas locais financeiras", () => {
  it("não apresenta valor oculto como zero", () => {
    expect(brl(null)).toBe("—");
    expect(brl(undefined)).toBe("—");
    expect(brl("0")).toContain("0,00");
  });
  it("usa calendário local, inclusive após meia-noite UTC e na virada do mês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 23, 30));
    expect(hoje()).toBe("2026-10-31");
    expect(mesAtual()).toBe("2026-10");
    expect(emDias(1)).toBe("2026-11-01");
    expect(emDias(-31)).toBe("2026-09-30");
  });
});

describe("Modal compartilhado", () => {
  it("foca o conteúdo, fecha com Escape e restaura o acionador", async () => {
    function Exemplo() {
      const [aberto, setAberto] = useState(false);
      return <><button onClick={() => setAberto(true)}>Abrir exemplo</button>{aberto && <Modal titulo="Exemplo" eyebrow="Teste" onClose={() => setAberto(false)}><label>Motivo<input /></label></Modal>}</>;
    }
    render(<Exemplo />);
    const abrir = screen.getByRole("button", { name: "Abrir exemplo" });
    abrir.focus(); fireEvent.click(abrir);
    const dialogo = screen.getByRole("dialog", { name: "Exemplo" });
    await waitFor(() => expect(dialogo.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });
});


it("preserva totais explícitos e seus rótulos na tabela e no cartão, sem abrir um registro", () => {
  const abrir = vi.fn();
  const { container } = render(<TabelaFinanceira rotulo="Totais preservados" itens={[{ id: "1", nome: "Banco", valor: 125 }]} chaveDe={item => item.id} onAbrir={abrir} rodape={{ nome: "Total", valor: "R$ 500,00", oculto: "—" }} colunas={[
    { chave: "nome", titulo: "Conta", principal: true, celula: item => item.nome },
    { chave: "valor", titulo: "Saldo", alinhamento: "direita", celula: item => brl(item.valor) },
    { chave: "oculto", titulo: "Valor restrito", celula: () => "—" },
  ]} />);
  const rodape = container.querySelector("tfoot")!;
  expect(rodape.textContent).toContain("500,00");
  expect(rodape.textContent).not.toContain("125,00");
  fireEvent.click(rodape.querySelector("tr")!);
  expect(abrir).not.toHaveBeenCalled();
  const cartao = container.querySelector(".fin-cartao-rodape")!;
  expect(cartao.textContent).toContain("SaldoR$ 500,00");
  expect(cartao.textContent).toContain("Valor restrito—");
});

it("honra a escolha explícita de tabela em um painel estreito sem alterar os registros", () => {
  let avisar = () => {};
  const observerOriginal = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { avisar = callback; }
    observe() {} unobserve() {} disconnect() {}
  } as unknown as typeof ResizeObserver;
  try {
    const abrir = vi.fn();
    const { container, rerender } = render(<TabelaFinanceira visualizacao="tabela" rotulo="Modo escolhido" itens={[{ id: "1", nome: "Aurora" }]} chaveDe={item => item.id} onAbrir={abrir} colunas={[
      { chave: "nome", titulo: "Animal", principal: true, larguraMinima: 500, celula: item => item.nome },
      { chave: "origem", titulo: "Origem", larguraMinima: 400, celula: () => "Sítio principal" },
    ]} />);
    const consulta = container.querySelector<HTMLElement>(".fin-consulta-responsiva")!;
    Object.defineProperty(consulta, "clientWidth", { get: () => 700 });
    act(() => avisar());
    expect(consulta.dataset.finVisualizacao).toBe("tabela");
    fireEvent.keyDown(container.querySelector("tbody tr")!, { key: "Enter" });
    expect(abrir).toHaveBeenCalledWith({ id: "1", nome: "Aurora" });
    rerender(<TabelaFinanceira rotulo="Modo automático" itens={[{ id: "1", nome: "Aurora" }]} chaveDe={item => item.id} colunas={[
      { chave: "nome", titulo: "Animal", principal: true, larguraMinima: 500, celula: item => item.nome },
      { chave: "origem", titulo: "Origem", larguraMinima: 400, celula: () => "Sítio principal" },
    ]} />);
    act(() => avisar());
    expect(consulta.dataset.finVisualizacao).toBe("cartoes");
  } finally { globalThis.ResizeObserver = observerOriginal; }
});

it("permite focar e rolar as colunas de uma tabela explícita estreita pelo teclado", () => {
  let avisar = () => {};
  const observerOriginal = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { avisar = callback; }
    observe() {} unobserve() {} disconnect() {}
  } as unknown as typeof ResizeObserver;
  try {
    const { container } = render(<TabelaFinanceira visualizacao="tabela" rotulo="Volumes" itens={[{ id: "1" }]} chaveDe={item => item.id} colunas={[
      { chave: "dia", titulo: "Dia", larguraMinima: 400, celula: () => "26/10/2026" },
      { chave: "volume", titulo: "Total", larguraMinima: 400, celula: () => "100 L" },
    ]} />);
    const consulta = container.querySelector<HTMLElement>(".fin-consulta-responsiva")!;
    const tabela = container.querySelector<HTMLElement>(".fin-tabela-desktop")!;
    Object.defineProperty(consulta, "clientWidth", { get: () => 320 });
    Object.defineProperty(tabela, "clientWidth", { get: () => 320 });
    Object.defineProperty(tabela, "scrollWidth", { get: () => 800 });
    act(() => avisar());
    const regiao = screen.getByRole("region", { name: "Rolagem horizontal: Volumes" });
    regiao.focus();
    expect(document.activeElement).toBe(regiao);
    fireEvent.keyDown(regiao, { key: "ArrowRight" });
    expect(regiao.scrollLeft).toBe(96);
    fireEvent.keyDown(regiao, { key: "ArrowLeft" });
    expect(regiao.scrollLeft).toBe(0);
    expect(screen.getByText("Role horizontalmente para ver todas as colunas.")).toBeTruthy();
    expect(regiao.className).not.toContain("scrollbar-width:none");
    expect(regiao.className).not.toContain("webkit-scrollbar");
  } finally { globalThis.ResizeObserver = observerOriginal; }
});
