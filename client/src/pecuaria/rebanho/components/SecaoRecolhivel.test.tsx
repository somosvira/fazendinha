// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SecaoRecolhivel, revelarSecao } from "./SecaoRecolhivel";

afterEach(cleanup);

describe("SecaoRecolhivel", () => {
  it("preserva o conteúdo e o rascunho ao recolher pelo botão do título", () => {
    render(<SecaoRecolhivel titulo="Manejo" id="manejo"><label>Observação<input /></label></SecaoRecolhivel>);
    const campo = screen.getByLabelText("Observação");
    fireEvent.change(campo, { target: { value: "Rascunho em andamento" } });
    const titulo = screen.getByRole("button", { name: "Manejo" });
    expect(titulo.tagName).toBe("BUTTON");
    expect(titulo.getAttribute("aria-controls")).toBe("manejo-conteudo");
    fireEvent.click(titulo);
    expect(titulo.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("manejo-conteudo")?.hidden).toBe(true);
    expect(document.querySelector("input")).toBe(campo);
    fireEvent.click(titulo);
    expect((screen.getByLabelText("Observação") as HTMLInputElement).value).toBe("Rascunho em andamento");
  });

  it("ações independentes não recolhem a seção", () => {
    const acao = vi.fn();
    render(<SecaoRecolhivel titulo="Protocolos" acoes={<button onClick={acao}>Registrar protocolo</button>}><p>Etapas</p></SecaoRecolhivel>);
    fireEvent.click(screen.getByRole("button", { name: "Registrar protocolo" }));
    expect(acao).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Protocolos" }).getAttribute("aria-expanded")).toBe("true");
  });
});

it("revela ações recolhidas pela chamada externa do cabeçalho", () => {
 render(<><button onClick={() => revelarSecao("acoes-repro")}>Registrar reprodução</button><SecaoRecolhivel id="acoes-repro" titulo="Registros" abertaInicial={false}><button>Avaliar</button></SecaoRecolhivel></>);
 expect(screen.queryByRole("button", { name: "Avaliar" })).toBeNull();
 fireEvent.click(screen.getByRole("button", { name: "Registrar reprodução" }));
 expect(screen.getByRole("button", { name: "Avaliar" })).toBeTruthy();
 expect(screen.getByRole("button", { name: "Registros" }).getAttribute("aria-expanded")).toBe("true");
});
