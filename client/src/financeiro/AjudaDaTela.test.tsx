// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AJUDA_FINANCEIRO } from "./ajuda";
import { PageHeader } from "./financeiro-ui";

afterEach(cleanup);

describe("ajuda da tela", () => {
  it("sem ajuda, o cabeçalho não mostra o botão", () => {
    render(<PageHeader titulo="Operações" descricao="x" />);
    expect(screen.queryByRole("button", { name: /como funciona/i })).toBeNull();
  });

  it("abre o modal com o conteúdo da tela e fecha pelo X", () => {
    render(<PageHeader titulo="Configurações financeiras" descricao="x" ajuda={AJUDA_FINANCEIRO.configuracoes} />);
    fireEvent.click(screen.getByRole("button", { name: "Como funciona: Configurações financeiras" }));
    const dialogo = screen.getByRole("dialog");
    expect(dialogo.textContent).toContain(AJUDA_FINANCEIRO.configuracoes.paraQueServe);
    expect(dialogo.textContent).toContain(AJUDA_FINANCEIRO.configuracoes.acoes[0]);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fecha com Esc", () => {
    render(<PageHeader titulo="Operações" descricao="x" ajuda={AJUDA_FINANCEIRO.operacoes} />);
    fireEvent.click(screen.getByRole("button", { name: /como funciona/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toda tela tem texto curto e preenchido", () => {
    for (const ajuda of Object.values(AJUDA_FINANCEIRO)) {
      expect(ajuda.paraQueServe.length).toBeGreaterThan(0);
      expect(ajuda.acoes.length).toBeGreaterThanOrEqual(2);
      expect(ajuda.acoes.length).toBeLessThanOrEqual(5);
    }
  });
});
