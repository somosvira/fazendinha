// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QualidadeLeite } from "./QualidadeLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
  alterarLeite: vi.fn(),
}));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => null }));
afterEach(cleanup);
const formato = {
  id: "formato",
  nome: "Laudo informado",
  ativo: true,
  versaoFormato: 1,
  versaoAnteriorId: null,
  formatoExameHash: "a".repeat(64),
  formatoBloqueado: true,
  campos: [
    {
      codigo: "GORDURA",
      rotulo: "Gordura",
      tipo: "NUMERO",
      unidade: "%",
      obrigatorio: true,
    },
    { codigo: "TESTE", rotulo: "Teste do laudo", tipo: "BOOLEANO" },
  ],
};
const amostra = {
  id: "amostra",
  propriedadeId: 2,
  data: "2026-10-19",
  versao: 2,
  sujeito: { tipo: "COLETIVO", origem: "Tanque A" },
  animal: null,
  tipoExameId: formato.id,
  formatoSnapshot: { nome: formato.nome, versao: 1, campos: formato.campos },
  resultados: [
    { campo: "GORDURA", valor: 0 },
    { campo: "TESTE", valor: false },
  ],
  realizacao: "REALIZADO",
  status: "VALIDO",
  responsavel: null,
  anotacaoOriginal: null,
  laudos: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consultarLeite).mockImplementation(async (caminho) => {
    if (caminho.includes("/formatos")) return [formato];
    if (caminho.includes("/historico"))
      return { itens: [], total: 0, pagina: 1, tamanho: 20 };
    if (caminho.includes("/qualidade/origens"))
      return { itens: [], total: 0, pagina: 1, tamanho: 20 };
    if (caminho.includes("/destinos/candidatos"))
      return {
        itens: [{ animalId: "animal", brinco: "123", nome: "Aurora" }],
        total: 1,
        pagina: 1,
        porPagina: 10,
      };
    return { propriedadeId: 2, itens: [amostra], total: 1, pagina: 1, tamanho: 20 };
  });
});
it("mostra zero e falso do laudo sem converter em ausência", async () => {
  render(<QualidadeLeite podeLancar={false} />);
  await screen.findByText("Tanque A");
  expect(screen.getByText("0 %")).toBeTruthy();
  expect(screen.getByText("Não")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Registrar amostra" }),
  ).toBeNull();
  expect(screen.queryByText("Resultado ainda não informado.")).toBeNull();
});
it("coleta coletiva pendente envia origem explícita e hash do formato sem inventar resultados", async () => {
  render(<QualidadeLeite podeLancar />);
  await screen.findByText("Tanque A");
  fireEvent.click(screen.getByRole("button", { name: "Registrar amostra" }));
  fireEvent.change(screen.getByLabelText("Formato do laudo"), {
    target: { value: "formato" },
  });
  fireEvent.change(screen.getByLabelText("Origem da amostra"), {
    target: { value: "COLETIVO" },
  });
  fireEvent.change(screen.getByLabelText("Identificação da origem coletiva"), {
    target: { value: "Tanque B — laudo 23" },
  });
  const form = screen
    .getByRole("group", { name: "Registrar amostra de leite" })
    .closest("form")!;
  fireEvent.submit(form);
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith(
      "/qualidade/amostras",
      2,
      expect.objectContaining({
        sujeito: { tipo: "COLETIVO", origem: "Tanque B — laudo 23" },
        resultados: [],
        formatoExameHash: "a".repeat(64),
      }),
    ),
  );
});
it("falha na correção conserva valores e motivo para reenvio, sem confirmar sucesso", async () => {
  vi.mocked(registrarLeite).mockRejectedValue(
    new Error("Conflito: atualize a amostra"),
  );
  render(<QualidadeLeite podeLancar />);
  await screen.findByText("Tanque A");
  fireEvent.click(screen.getByRole("button", { name: "Abrir amostra" }));
  const detalhe = screen.getByRole("region", { name: "Detalhe da amostra" });
  fireEvent.change(within(detalhe).getByLabelText("Motivo da atualização"), {
    target: { value: "Conferido com laboratório" },
  });
  fireEvent.click(
    within(detalhe).getByRole("button", { name: "Confirmar atualização" }),
  );
  await screen.findByText("Conflito: atualize a amostra");
  expect(
    (screen.getByLabelText("Motivo da atualização") as HTMLTextAreaElement)
      .value,
  ).toBe("Conferido com laboratório");
  expect(registrarLeite).toHaveBeenCalledWith(
    "/qualidade/amostras/amostra/correcoes",
    2,
    expect.objectContaining({
      versaoEsperada: 2,
      resultados: amostra.resultados,
    }),
  );
  expect(
    screen.queryByText("Amostra atualizada com histórico preservado."),
  ).toBeNull();
});
