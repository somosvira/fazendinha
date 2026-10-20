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
