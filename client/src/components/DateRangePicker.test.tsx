// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildPresets, DateRangePicker, formatRangeLabel } from "./DateRangePicker";

afterEach(cleanup);
const range = { start: new Date(2026, 4, 1), end: new Date(2026, 4, 31) };
const openCustom = () => { fireEvent.click(screen.getByRole("button", { name: "Período" })); fireEvent.click(screen.getByRole("button", { name: "Período personalizado" })); };

describe("DateRangePicker", () => {
  it("mostra somente o dropdown e aplica presets sem abrir campos de data", () => {
    const change = vi.fn();
    render(<DateRangePicker value={range} onChange={change} />);
    expect(screen.queryByLabelText("Data inicial")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Período" }));
    expect(screen.queryByLabelText("Data inicial")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(change).toHaveBeenCalledOnce();
    const expectedYear = new Date().getFullYear() - 1;
    expect(change.mock.calls[0][0].start.getFullYear()).toBe(expectedYear);
  });
  it.each([2027, 2028])("presets acompanham o ano %s, sem atalhos históricos fixos", year => {
    const presets = buildPresets(new Date(year, 0, 2));
    for (const preset of presets) expect(preset.range.start.getTime()).toBeLessThanOrEqual(preset.range.end.getTime());
    expect(presets.find(p => p.id === "ano-anterior")!.range.start.getFullYear()).toBe(year - 1);
    expect(presets.find(p => p.id === "lastMonth")!.range.start.getFullYear()).toBe(year - 1);
    expect(presets.map(p => p.label).join()).not.toMatch(/202[456]/);
  });
  it("impede intervalo invertido, aplica somente após confirmação e cancela sem alterar", () => {
    const change = vi.fn();
    render(<DateRangePicker value={range} onChange={change} />);
    openCustom();
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-06-12" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-06-10" } });
    expect((screen.getByRole("button", { name: "Aplicar período" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("posterior");
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-06-15" } });
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(change).not.toHaveBeenCalled();
    openCustom();
    expect((screen.getByLabelText("Data inicial") as HTMLInputElement).value).toBe("2026-05-01");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    expect(change).toHaveBeenCalledWith(range);
  });
  it("explica os passos e impede a segunda data anterior à primeira no calendário", () => {
    render(<DateRangePicker value={range} onChange={vi.fn()} />);
    openCustom();
    expect(screen.getByRole("status").textContent).toContain("1.");
    fireEvent.click(screen.getAllByRole("button", { name: "12 de maio de 2026" })[0]);
    expect(screen.getByRole("status").textContent).toContain("2.");
    expect((screen.getAllByRole("button", { name: "11 de maio de 2026" })[0] as HTMLButtonElement).disabled).toBe(true);
    const day = screen.getAllByRole("button", { name: "13 de maio de 2026" })[0];
    day.focus(); fireEvent.keyDown(day, { key: "ArrowRight" });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("14 de maio de 2026");
    fireEvent.click(day);
    expect(screen.getByText(/12\/mai\/26 → 13\/mai\/26/)).toBeTruthy();
  });
  it("formata intervalos", () => {
    expect(formatRangeLabel(range)).toBe("01–31 mai/26");
    expect(formatRangeLabel(null)).toBe("Personalizado");
  });
  it("mostra o preset e o intervalo efetivo juntos no gatilho fechado", () => {
    // Só o nome do preset ("Mês atual") não diz qual é o intervalo de fato
    // aplicado sem abrir o dropdown — o gatilho passa a mostrar os dois.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 21));
    const mesAtual = buildPresets(new Date(2026, 8, 21)).find(p => p.id === "1")!.range;
    render(<DateRangePicker value={mesAtual} onChange={vi.fn()} />);
    const gatilho = screen.getByRole("button", { name: "Período" });
    expect(gatilho.textContent).toContain("Mês atual");
    expect(gatilho.textContent).toContain("01–30 set/26");
    vi.useRealTimers();
  });
  it("sem preset correspondente, mostra só o intervalo (período personalizado)", () => {
    render(<DateRangePicker value={range} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Período" }).textContent).toBe("01–31 mai/26▾");
  });
});
