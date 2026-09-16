// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CampoMes } from "./CampoMes";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Exemplo({ inicial, onChange, min, max }: { inicial: string; onChange?: (valor: string) => void; min?: string; max?: string }) {
  const [valor, setValor] = useState(inicial);
  return <CampoMes aria-label="Mês" value={valor} min={min} max={max} onChange={(novo) => { setValor(novo); onChange?.(novo); }} />;
}

beforeEach(() => { vi.stubGlobal("ResizeObserver", ResizeObserverMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("CampoMes", () => {
  it("mostra o mês por extenso", () => {
    render(<Exemplo inicial="2026-09" />);
    expect(screen.getByRole("button", { name: "Mês" }).textContent).toContain("set/2026");
  });

  it("devolve o mês escolhido como YYYY-MM", () => {
    const onChange = vi.fn();
    render(<Exemplo inicial="2026-09" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect(screen.getByText("2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "setembro de 2026" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "março de 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-03");
    expect(screen.getByRole("button", { name: "Mês" }).textContent).toContain("mar/2026");
  });

  it("troca de ano antes de escolher", () => {
    const onChange = vi.fn();
    render(<Exemplo inicial="2026-12" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    fireEvent.click(screen.getByRole("button", { name: "janeiro de 2027" }));
    expect(onChange).toHaveBeenLastCalledWith("2027-01");
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "dezembro de 2026" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-12");
  });

  it("bloqueia meses fora do intervalo", () => {
    render(<Exemplo inicial="2026-06" min="2026-03" max="2026-08" />);
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect((screen.getByRole("button", { name: "fevereiro de 2026" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "março de 2026" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "agosto de 2026" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "setembro de 2026" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("abre no ano atual quando ainda não há mês", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0));
    render(<Exemplo inicial="" />);
    expect(screen.getByRole("button", { name: "Mês" }).textContent).toContain("mm/aaaa");
    fireEvent.click(screen.getByRole("button", { name: "Mês" }));
    expect(screen.getByRole("button", { name: "setembro de 2026" })).toBeTruthy();
  });
});

it("liga o texto de ajuda e o estado de erro ao campo", () => {
  render(<CampoMes aria-label="Mês" aria-describedby="ajuda" aria-invalid value="" onChange={() => {}} />);
  const campo = screen.getByRole("button", { name: "Mês" });
  expect(campo.getAttribute("aria-describedby")).toBe("ajuda");
  expect(campo.getAttribute("aria-invalid")).toBe("true");
});
