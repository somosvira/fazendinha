// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisaoGeralNutricao } from "./VisaoGeralNutricao";
import {
  consultarVisaoNutricional,
  type ResumoNutricional,
  type VisaoNutricional,
} from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("./api", () => ({ consultarVisaoNutricional: vi.fn() }));
const resumo: ResumoNutricional = {
  lote: {
    id: "lote-1",
    nome: "Matrizes",
    propriedadeId: 1,
    propriedade: { id: 1, nome: "Fazenda Escola" },
    ativo: true,
    animaisAtivos: 5,
    observacao: null,
  },
  vigente: {
    id: "vigencia",
    desde: "2026-01-01",
    ate: null,
    dieta: { id: "dieta", nome: "Dieta de matrizes", versao: 1 },
  },
  programada: null,
  verValores: true,
  custos: {
    custoConhecido: "200.00",
    custoPorAnimalDia: "2.00",
    animalDias: 100,
    fechamentos: 1,
    coberturaCustoCompleta: true,
  },
};
const dados: VisaoNutricional = {
  verValores: true,
  lotes: [
    resumo,
    {
      ...resumo,
      lote: { ...resumo.lote, id: "lote-2", nome: "Novilhas" },
      vigente: null,
    },
  ],
};
function pendente<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: Error) => void;
  const promessa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}
beforeEach(() => {
  vi.clearAllMocks();
  setPropriedadeAtiva(1);
  window.history.replaceState(null, "", "/pecuaria/nutricao");
  vi.mocked(consultarVisaoNutricional).mockResolvedValue(dados);
});
afterEach(() => {
  cleanup();
  setPropriedadeAtiva(null);
});
it("aguarda sucesso e apresenta resultados versus total sem declarar ausência antes", async () => {
  const leitura = pendente<VisaoNutricional>();
  vi.mocked(consultarVisaoNutricional).mockReturnValue(leitura.promessa);
  render(<VisaoGeralNutricao />);
  expect(screen.getByRole("status").textContent).toBe("Carregando nutrição…");
  expect(screen.queryByText(/Nenhum lote/)).toBeNull();
  await act(async () => leitura.resolver(dados));
  expect(screen.getByText("2 de 2 lotes")).toBeTruthy();
  expect(screen.getByRole("table", { name: "Nutrição por lote" })).toBeTruthy();
});
it("erro oferece retry e não declara contexto sem lotes", async () => {
  const leitura = pendente<VisaoNutricional>();
  vi.mocked(consultarVisaoNutricional)
    .mockReturnValueOnce(leitura.promessa)
    .mockResolvedValueOnce(dados);
  render(<VisaoGeralNutricao />);
  await act(async () => leitura.rejeitar(new Error("Falha de leitura")));
  expect(screen.getByRole("alert").textContent).toContain("Falha de leitura");
  expect(screen.queryByText(/Nenhum lote/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("2 de 2 lotes");
  expect(screen.queryByRole("alert")).toBeNull();
});
it("limpar filtros restaura resultados, conserva total real e outros parâmetros/hash/estado", async () => {
  window.history.replaceState(
    { origem: "consulta" },
    "",
    "/pecuaria/nutricao?aba=lotes&buscaLote=inexistente&situacaoDieta=com&sitio=1&outro=mantido#consulta",
  );
  render(<VisaoGeralNutricao />);
  await screen.findByText("0 de 2 lotes");
  expect(screen.getByText("Nenhum lote corresponde aos filtros.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(screen.getByText("2 de 2 lotes")).toBeTruthy();
  expect(screen.getByLabelText("Buscar lote ou sítio")).toHaveProperty(
    "value",
    "",
  );
  expect(screen.getByLabelText("Situação da dieta")).toHaveProperty(
    "value",
    "",
  );
  const url = new URL(window.location.href);
  expect(url.searchParams.has("buscaLote")).toBe(false);
  expect(url.searchParams.has("situacaoDieta")).toBe(false);
  expect(url.searchParams.get("aba")).toBe("lotes");
  expect(url.searchParams.get("sitio")).toBe("1");
  expect(url.searchParams.get("outro")).toBe("mantido");
  expect(url.hash).toBe("#consulta");
  expect(window.history.state).toEqual({ origem: "consulta" });
  expect(consultarVisaoNutricional).toHaveBeenCalledTimes(1);
});
it("conta somente resultados do filtro e restaura filtro pela navegação", async () => {
  render(<VisaoGeralNutricao />);
  await screen.findByText("2 de 2 lotes");
  fireEvent.change(screen.getByLabelText("Situação da dieta"), {
    target: { value: "sem" },
  });
  expect(screen.getByText("1 de 2 lotes")).toBeTruthy();
  expect(
    within(screen.getByRole("table", { name: "Nutrição por lote" })).getByRole(
      "link",
      { name: "Novilhas" },
    ),
  ).toBeTruthy();
  await act(async () => {
    window.history.replaceState(
      null,
      "",
      "/pecuaria/nutricao?buscaLote=Matrizes&situacaoDieta=com",
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByLabelText("Buscar lote ou sítio")).toHaveProperty(
    "value",
    "Matrizes",
  );
  expect(
    within(screen.getByRole("table", { name: "Nutrição por lote" })).getByRole(
      "link",
      { name: "Matrizes" },
    ),
  ).toBeTruthy();
});
it("sucesso sem lotes distingue ausência de cadastro de filtro sem correspondência", async () => {
  vi.mocked(consultarVisaoNutricional).mockResolvedValue({
    lotes: [],
    verValores: false,
  });
  render(<VisaoGeralNutricao />);
  await screen.findByText("0 de 0 lotes");
  expect(screen.getByText("Nenhum lote ativo neste contexto.")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Ver lotes do rebanho" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
});
it.each(["resolver", "rejeitar"] as const)(
  "remontagem por sítio descarta resposta antiga ao %s fora de ordem",
  async (desfecho) => {
    const antiga = pendente<VisaoNutricional>();
    vi.mocked(consultarVisaoNutricional)
      .mockReturnValueOnce(antiga.promessa)
      .mockResolvedValueOnce({
        ...dados,
        lotes: [
          {
            ...resumo,
            lote: {
              ...resumo.lote,
              nome: "Lote do sítio atual",
              propriedadeId: 2,
            },
          },
        ],
      });
    // App isola o conteúdo por key={propAtiva ?? "all"} na troca global de sítio.
    const { rerender } = render(<VisaoGeralNutricao key={1} />);
    setPropriedadeAtiva(2);
    rerender(<VisaoGeralNutricao key={2} />);
    await screen.findByRole("table", { name: "Nutrição por lote" });
    expect(
      within(
        screen.getByRole("table", { name: "Nutrição por lote" }),
      ).getByRole("link", { name: "Lote do sítio atual" }),
    ).toBeTruthy();
    await act(async () =>
      desfecho === "resolver"
        ? antiga.resolver(dados)
        : antiga.rejeitar(new Error("Erro anterior")),
    );
    expect(screen.queryByRole("link", { name: "Matrizes" })).toBeNull();
    expect(screen.queryByText("Erro anterior")).toBeNull();
    expect(screen.getByText("1 de 1 lotes")).toBeTruthy();
  },
);
