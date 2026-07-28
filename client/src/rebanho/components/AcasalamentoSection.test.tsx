// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";

const useAcasalamento = vi.hoisted(() => vi.fn());
vi.mock("../api", () => ({ useAcasalamento }));

import { AcasalamentoSection } from "./AcasalamentoSection";

afterEach(() => {
  cleanup();
  useAcasalamento.mockReset();
});

describe("AcasalamentoSection", () => {
  it("mostra candidatos aptos e não verificáveis com score, parentesco, status, motivo e rodapé dirigido", () => {
    useAcasalamento.mockReturnValue({
      loading: false,
      erro: null,
      recarregar: vi.fn(),
      data: {
        animalId: 145,
        paiNome: "Pai conhecido",
        combinacaoId: 3,
        recomendacoes: [
          { id: 10, nome: "Touro Seguro", score: 0.86, parentesco: 0.03125, status: "ok", consanguineo: false, motivo: "legado", motivos: ["mérito leiteiro superior"] },
          { id: 20, nome: "Touro Incerto", score: 0.72, parentesco: 0, status: "nao_verificavel", consanguineo: false, motivo: "legado", motivos: ["pedigree insuficiente"] },
          { id: 30, nome: "Touro Consanguíneo", score: 0, parentesco: 0.25, status: "consanguineo", consanguineo: true, motivo: "legado", motivos: ["parentesco acima do limite"] },
          { id: 40, nome: "Touro Restrito", score: 0, parentesco: 0, status: "restrito", consanguineo: false, motivo: "legado", motivos: ["indicador abaixo do mínimo"] },
        ],
      },
    });

    render(createElement(AcasalamentoSection, { animalId: "145" }));

    expect(screen.getByText("86%")).toBeTruthy();
    expect(screen.getByText("3,1% parentesco")).toBeTruthy();
    expect(screen.getByText("apto")).toBeTruthy();
    expect(screen.getByText("pedigree não verificável")).toBeTruthy();
    expect(screen.getByText("mérito leiteiro superior")).toBeTruthy();
    expect(screen.getByText(/Consanguíneos \(1\): Touro Consanguíneo/)).toBeTruthy();
    expect(screen.getByText(/Restritos \(1\): Touro Restrito/)).toBeTruthy();
    expect(screen.getByText("Mérito configurável por indicadores; consanguinidade estimada por pedigree.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("pedigree não verificável");
    expect(screen.queryByText(/PTA leite \+ TPI/)).toBeNull();
  });

  it("mantém compatibilidade v1 derivando status e omitindo parentesco ausente", () => {
    useAcasalamento.mockReturnValue({
      loading: false,
      erro: null,
      recarregar: vi.fn(),
      data: {
        animalId: 145,
        paiNome: null,
        recomendacoes: [
          { id: 10, nome: "Touro V1", score: 0.65, consanguineo: false, motivo: "índice legado" },
          { id: 30, nome: "Consanguíneo V1", score: 0, consanguineo: true, motivo: "pai da vaca" },
        ],
      },
    });

    render(createElement(AcasalamentoSection, { animalId: "145" }));

    expect(screen.getByText("Touro V1")).toBeTruthy();
    expect(screen.getByText("apto")).toBeTruthy();
    expect(screen.getByText("índice legado")).toBeTruthy();
    expect(screen.getByText(/Consanguíneos \(1\): Consanguíneo V1/)).toBeTruthy();
    expect(screen.queryByText(/parentesco/)).toBeNull();
  });

  it("anuncia erro do hook em vez de desaparecer silenciosamente", () => {
    useAcasalamento.mockReturnValue({ data: null, loading: false, erro: "Falha ao calcular acasalamento", recarregar: vi.fn() });

    render(createElement(AcasalamentoSection, { animalId: "145" }));

    expect(screen.getByRole("alert").textContent).toContain("Falha ao calcular acasalamento");
  });
});
