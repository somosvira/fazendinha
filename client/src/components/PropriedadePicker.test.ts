// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { PropriedadePicker } from "./PropriedadePicker";

// usePropriedades bate na API; stubamos o módulo pra render offline.
vi.mock("../rebanho/api", () => ({
  usePropriedades: () => ({
    data: [{ id: 1, nome: "Rio Novo", principal: true, ativo: true }],
    loading: false,
    recarregar: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("PropriedadePicker", () => {
  it("renderiza o gatilho com o nome da propriedade (variant header)", () => {
    render(h(PropriedadePicker, { propAtiva: null, onTrocarProp: vi.fn() }));
    const trigger = screen.getByRole("button", { name: /Propriedade \/ sítio/i });
    expect(trigger.textContent).toContain("Rio Novo");
  });

  it("renderiza o gatilho no variant sidebar", () => {
    render(h(PropriedadePicker, { propAtiva: null, onTrocarProp: vi.fn(), variant: "sidebar" }));
    const trigger = screen.getByRole("button", { name: /Propriedade \/ sítio/i });
    expect(trigger.textContent).toContain("Rio Novo");
  });
});
