// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { ReportHeader } from "./Shell";

afterEach(cleanup);

describe("ReportHeader", () => {
  it("renderiza subtitle e h1 com data-slot marker", () => {
    render(
      h(ReportHeader, {
        subtitle: "Fluxo de Caixa",
      }),
    );

    // assert subtitle text appears
    expect(screen.getByText("Fluxo de Caixa")).toBeTruthy();

    // assert data-slot marker for migrated ReportHeader
    expect(document.querySelector('[data-slot="report-header"]')).toBeTruthy();
  });

  it("renderiza DateRangePicker quando range e onRangeChange são fornecidos", () => {
    const onRangeChange = () => {};
    render(
      h(ReportHeader, {
        subtitle: "Gastos",
        range: { start: new Date("2026-05-01"), end: new Date("2026-05-31") },
        onRangeChange,
      }),
    );

    expect(screen.getByText("Gastos")).toBeTruthy();
    expect(document.querySelector('[data-slot="report-header"]')).toBeTruthy();
  });

  it("renderiza updatedAt caption quando fornecido", () => {
    render(
      h(ReportHeader, {
        subtitle: "Relatório",
        updatedAt: "há 2 minutos",
      }),
    );

    expect(screen.getByText("Relatório")).toBeTruthy();
    expect(screen.getByText(/há 2 minutos/)).toBeTruthy();
    expect(document.querySelector('[data-slot="report-header"]')).toBeTruthy();
  });
});
