// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogoAvaliacaoConfig } from "./CatalogoAvaliacaoConfig";
import { mudarCampo } from "@/lib/controles.fixture";
const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("./api", () => ({ reqV4: mocks.req }));
const catalogo = {
  id: "c1",
  versao: 4,
  tipoExameId: "ex",
  itens: [
    {
      codigo: "APTIDAO",
      rotulo: "Aptidão",
      tipo: "APTIDAO",
      contextos: ["NOVILHA"],
    },
  ],
  condutas: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.req.mockImplementation(async (path, body) =>
    path.includes("tipos-exame")
      ? [
          {
            id: "ex",
            nome: "Formato da fazenda",
            ativo: true,
            contexto: "REPRODUTIVO",
            campos: [
              {
                codigo: "UTERO",
                rotulo: "Útero",
                tipo: "NUMERO",
                unidade: "mm",
              },
            ],
          },
        ]
      : body
        ? { ...catalogo, ...body, versao: 5 }
        : { catalogo },
  );
});
afterEach(cleanup);
it("publica outra versão com revisão esperada sem reescrever versão publicada", async () => {
  render(<CatalogoAvaliacaoConfig propriedadeId={7} podeLancar />);
  await screen.findByText("Versão 4 · publicada");
  fireEvent.click(
    screen.getByRole("button", { name: "Nova versão do catálogo" }),
  );
  expect(screen.getByText(/Versões publicadas são imutáveis/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Nome do item"), {
    target: { value: "Aptidão reprodutiva" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar conduta" }));
  fireEvent.change(screen.getByLabelText("Código da conduta"), {
    target: { value: "RETORNO" },
  });
  fireEvent.change(screen.getByLabelText("Nome da conduta"), {
    target: { value: "Reavaliar com responsável" },
  });
  mudarCampo(screen.getByLabelText("Tipo de conduta"), {
    target: { value: "RETORNO" },
  });
  fireEvent.click(screen.getByLabelText("Exigir revisão"));
  fireEvent.submit(
    (
      screen.getByRole("button", {
        name: "Publicar nova versão",
      }) as HTMLButtonElement
    ).form!,
  );
  await screen.findByText(/Nova versão publicada/);
  expect(mocks.req).toHaveBeenCalledWith(
    "/reproducao/avaliacoes/contexto/catalogo",
    {
      propriedadeId: 7,
      tipoExameId: "ex",
      versaoEsperada: 4,
      itens: [{ ...catalogo.itens[0], rotulo: "Aptidão reprodutiva" }],
      condutas: [
        {
          codigo: "RETORNO",
          rotulo: "Reavaliar com responsável",
          tipo: "RETORNO",
          exigeRevisao: true,
        },
      ],
      chave: expect.any(String),
    },
    "POST",
    7,
  );
  expect(catalogo.itens[0].rotulo).toBe("Aptidão");
});
it("exige vincular itens adicionais ao campo de formato existente", async () => {
  render(<CatalogoAvaliacaoConfig propriedadeId={7} podeLancar />);
  await screen.findByText("Versão 4 · publicada");
  fireEvent.click(
    screen.getByRole("button", { name: "Nova versão do catálogo" }),
  );
  mudarCampo(screen.getByLabelText("Tipo de item"), {
    target: { value: "UTERO" },
  });
  fireEvent.submit(
    (
      screen.getByRole("button", {
        name: "Publicar nova versão",
      }) as HTMLButtonElement
    ).form!,
  );
  await screen.findByText(/Informe código, nome e campo/);
  expect(mocks.req.mock.calls.filter(([, body]) => body)).toHaveLength(0);
  mudarCampo(screen.getByLabelText("Campo do formato"), {
    target: { value: "UTERO" },
  });
  expect(screen.getByText(/NUMERO/)).toBeTruthy();
});
it("leitura não oferece publicação", async () => {
  render(<CatalogoAvaliacaoConfig propriedadeId={7} podeLancar={false} />);
  await screen.findByText("Versão 4 · publicada");
  expect(
    screen.queryByRole("button", { name: "Nova versão do catálogo" }),
  ).toBeNull();
});
