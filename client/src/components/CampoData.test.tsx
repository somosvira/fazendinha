// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CampoData } from "./CampoData";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Exemplo({ inicial, onChange }: { inicial: string; onChange?: (valor: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return <CampoData aria-label="Data" value={valor} onChange={(novo) => { setValor(novo); onChange?.(novo); }} />;
}

beforeEach(() => { vi.stubGlobal("ResizeObserver", ResizeObserverMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("CampoData", () => {
  it("mostra a data no formato brasileiro", () => {
    render(<Exemplo inicial="2026-09-16" />);
    expect(screen.getByRole("button", { name: "Data" }).textContent).toContain("16/09/2026");
  });

  it("devolve o dia escolhido como YYYY-MM-DD sem deslocar o fuso", () => {
    const onChange = vi.fn();
    render(<Exemplo inicial="2026-09-16" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    expect(screen.getByText("setembro de 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1 de setembro de 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-01");
    expect(screen.getByRole("button", { name: "Data" }).textContent).toContain("01/09/2026");
    expect(screen.queryByText("setembro de 2026")).toBeNull();
  });

  it("navega entre meses atravessando a virada do ano", () => {
    const onChange = vi.fn();
    render(<Exemplo inicial="2026-12-10" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByText("janeiro de 2027")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "31 de janeiro de 2027" }));
    expect(onChange).toHaveBeenLastCalledWith("2027-01-31");

    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByText("novembro de 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "30 de novembro de 2026" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-30");
  });

  it("marca o dia selecionado", () => {
    render(<Exemplo inicial="2026-09-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    expect(screen.getByRole("button", { name: "16 de setembro de 2026" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "17 de setembro de 2026" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("escolhe hoje pelo atalho, mesmo com outro mês aberto", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 16, 23, 30));
    const onChange = vi.fn();
    render(<Exemplo inicial="2025-02-03" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-16");
  });

  it("não deixa escolher dias fora do intervalo permitido", () => {
    const onChange = vi.fn();
    render(<CampoData aria-label="Data" value="2026-09-16" min="2026-09-10" max="2026-09-20" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    const antes = screen.getByRole("button", { name: "9 de setembro de 2026" }) as HTMLButtonElement;
    const depois = screen.getByRole("button", { name: "21 de setembro de 2026" }) as HTMLButtonElement;
    expect(antes.disabled).toBe(true);
    expect(depois.disabled).toBe(true);
    fireEvent.click(depois);
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "10 de setembro de 2026" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "20 de setembro de 2026" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("desabilita o atalho Hoje quando hoje está fora do intervalo", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0));
    render(<CampoData aria-label="Data" value="2026-09-01" max="2026-09-05" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    expect((screen.getByRole("button", { name: "Hoje" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("impede o envio do formulário quando é obrigatório e está vazio", () => {
    render(<form aria-label="Formulário"><CampoData aria-label="Data" name="data" required value="" onChange={() => {}} /></form>);
    const form = screen.getByRole("form", { name: "Formulário" }) as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    cleanup();
    render(<form aria-label="Formulário"><CampoData aria-label="Data" name="data" required value="2026-09-16" onChange={() => {}} /></form>);
    const preenchido = screen.getByRole("form", { name: "Formulário" }) as HTMLFormElement;
    expect(preenchido.checkValidity()).toBe(true);
    expect(new FormData(preenchido).get("data")).toBe("2026-09-16");
  });

  it("abre no mês atual quando ainda não há data", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0));
    render(<Exemplo inicial="" />);
    expect(screen.getByRole("button", { name: "Data" }).textContent).toContain("dd/mm/aaaa");
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    expect(screen.getByText("setembro de 2026")).toBeTruthy();
  });
});

describe("CampoData — acessibilidade e limpeza", () => {
  it("liga o texto de ajuda e o estado de erro ao campo", () => {
    render(<><p id="ajuda">Data em que o saldo foi conferido.</p><CampoData aria-label="Data" aria-describedby="ajuda" aria-invalid value="" onChange={() => {}} /></>);
    const campo = screen.getByRole("button", { name: "Data" });
    expect(campo.getAttribute("aria-describedby")).toBe("ajuda");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
  });

  it("permite voltar para vazio quando não é obrigatório", () => {
    const onChange = vi.fn();
    render(<CampoData aria-label="Data" value="2026-09-16" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("não oferece limpar quando é obrigatório", () => {
    render(<CampoData aria-label="Data" required value="2026-09-16" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Data" }));
    expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  });
});
