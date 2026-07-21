// @vitest-environment jsdom
import { createElement } from "react";
import { render, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// mocka os dois fetchers para não bater em rede
vi.mock("../rebanho/api", () => ({
  useDashboard: () => ({
    data: { herois: { producaoTotalDia: { valor: 980, unidade: "L", variacaoPercentual: 3 }, vacasEmLactacao: { valor: 98 }, producaoMediaVaca: { valor: 10 } }, alertas: [] },
    loading: false, erro: null,
  }),
}));
vi.mock("../api", () => ({
  fetchDashboard: () => Promise.resolve({ creditoTotal: [0, 5000], debitoTotal: [0, 3000], caixaHoje: { total: 12345.67 } }),
}));

import { InicioContent } from "./InicioContent";

afterEach(cleanup);

describe("InicioContent", () => {
  it("renderiza os três blocos com dados", async () => {
    const { getByText } = render(createElement(InicioContent, { onNav: () => {} }));
    expect(getByText("Precisa de atenção")).toBeTruthy();
    expect(getByText("Leite hoje")).toBeTruthy();
    await waitFor(() => expect(getByText("Caixa")).toBeTruthy());
    expect(getByText(/980/)).toBeTruthy();
  });
});
