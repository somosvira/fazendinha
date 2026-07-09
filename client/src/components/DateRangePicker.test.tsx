// @vitest-environment jsdom
/* Interação do DateRangePicker pós-migração p/ ui/Popover: o componente não
 * está montado em nenhuma tela hoje (Shell só o renderiza quando a tela passa
 * `range`), então a paridade é garantida por teste em vez de visual. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateRangePicker, formatRangeLabel } from "./DateRangePicker";

afterEach(cleanup);

const range = { start: new Date(2026, 4, 1), end: new Date(2026, 4, 31) };

describe("DateRangePicker", () => {
  it("abre o popover com presets e calendários ao clicar no trigger", () => {
    render(<DateRangePicker value={range} onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /mai\/26/ });
    fireEvent.click(trigger);
    expect(screen.getByText("Presets")).toBeTruthy();
    expect(screen.getByText("Últimos 30 dias")).toBeTruthy();
    expect(screen.getByText("Início")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aplicar período" })).toBeTruthy();
  });

  it("preset + Aplicar período chama onChange com o range do preset", () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={range} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /mai\/26/ }));
    fireEvent.click(screen.getByText("2025 inteiro"));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const r = onChange.mock.calls[0][0];
    expect(r.start.getFullYear()).toBe(2025);
    expect(r.start.getMonth()).toBe(0);
    expect(r.end.getMonth()).toBe(11);
  });

  it("formatRangeLabel: mesmo mês vira 'dd–dd mes/aa'", () => {
    expect(formatRangeLabel(range)).toBe("01–31 mai/26");
    expect(formatRangeLabel(null)).toBe("Personalizado");
  });
});
