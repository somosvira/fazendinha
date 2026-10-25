import { selecionarCampoLeite } from "./select-campo-teste";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DestinosLeite } from "./UIDestinosLeite";
import { consultarLeite } from "./operacoes-api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import type { DestinoLeiteDTO } from "./destinos-types";
const tela = { ...screen,
  getByRole: (...args: Parameters<typeof screen.getByRole>) => screen.getAllByRole(...args)[0],
  findByRole: async (...args: Parameters<typeof screen.findByRole>) => (await screen.findAllByRole(...args))[0],
  getByText: (...args: Parameters<typeof screen.getByText>) => screen.getAllByText(...args)[0],
  findByText: async (...args: Parameters<typeof screen.findByText>) => (await screen.findAllByText(...args))[0],
  getByLabelText: (...args: Parameters<typeof screen.getByLabelText>) => screen.getAllByLabelText(...args)[0],
  findByLabelText: async (...args: Parameters<typeof screen.findByLabelText>) => (await screen.findAllByLabelText(...args))[0],
};
vi.mock("./operacoes-api", async (original) => ({
  ...(await original<typeof import("./operacoes-api")>()),
  consultarLeite: vi.fn(),
}));
vi.mock("../../../estoque/api", () => ({
  listarProdutos: vi
    .fn()
    .mockResolvedValue([
      { id: "produto", nome: "Leite", unidade: "L", rastrearPartidas: false },
    ]),
}));
vi.mock("./modelo", async (original) => ({
  ...(await original<typeof import("./modelo")>()),
  hojeOperacional: () => "2026-10-19",
}));
const origem = {
  entradaId: "entrada",
  sessaoId: "ordenha-1",
  nomeOrdenha: "Manhã",
  natureza: "NAO_INFORMADA",
  produtoId: "produto",
  data: "2026-10-19",
  quantidadeDisponivelLitros: 10,
};
const historia: DestinoLeiteDTO = {
  id: "destino",
  propriedadeId: 2,
  entradaId: "entrada",
  sessaoId: "ordenha-1",
  produtoId: "produto",
  movimentoId: "mov",
  data: "2026-10-19",
  natureza: "LEITE_COMUM",
  declaracaoOrigem: "Leite comum servido",
  quantidadeLitros: 7,
  saldoOrigemAntes: 10,
  saldoOrigemDepois: 3,
  responsavel: null,
  observacao: null,
  status: "CONFIRMADO",
  versao: 2,
  criadoEm: "2026-10-19",
  criadoPorId: 7,
  estornadoEm: null,
  motivoEstorno: null,
  movimentoEstornoId: null,
  parcelas: [],
};
const fetchMock = vi.fn();
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  setPropriedadeAtiva(2);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(historia), { status: 201 }),
  );
  vi.mocked(consultarLeite).mockImplementation(async (caminho) => {
    if (caminho.startsWith("/destinos/origens"))
      return { propriedadeId: 2, itens: [origem] } as never;
    if (caminho.startsWith("/destinos/crias"))
      return {
        itens: [
          {
            animalId: "cria-animal",
            criaId: "cria-real",
            brinco: "C1",
            nome: "Cria Aurora",
            fornecimentos: [
              {
                id: "colostro-existente",
                data: "2026-10-19",
                quantidadeLitros: 3.5,
              },
            ],
          },
        ],
        total: 1,
        pagina: 1,
        porPagina: 10,
      } as never;
    if (caminho.startsWith("/destinos/candidatos"))
      return {
        itens: [
          { animalId: "a", brinco: "A1", nome: "Aurora" },
          { animalId: "b", brinco: "B1", nome: "Brisa" },
        ],
        total: 2,
        pagina: 1,
        porPagina: 10,
      } as never;
    return { itens: [], total: 0, pagina: 1, porPagina: 20 } as never;
  });
});
async function prepararOrigem() {
  await selecionarCampoLeite("Produto de origem", "produto");
  await selecionarCampoLeite("Origem confirmada", "entrada");
  fireEvent.change(
    tela.getByLabelText("Declaração da origem e da prática registrada"),
    { target: { value: "Leite servido nesta data aos animais identificados" } },
  );
}
describe("destinos internos", () => {
  it("consulta não oferece escrita ou estorno", async () => {
    render(<DestinosLeite podeLancar={false} />);
    await tela.findByText("Nenhum destino registrado no período.");
    expect(tela.queryByLabelText("Produto de origem")).toBeNull();
    expect(
      tela.queryByRole("button", { name: /Confirmar destino/ }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reparte três e quatro de dez e repete exatamente a tentativa após erro", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Conexão perdida" }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(historia), { status: 201 }),
      );
    render(<DestinosLeite podeLancar />);
    fireEvent.click(tela.getByRole("button", { name: "Registrar fornecimento" }));
    await prepararOrigem();
    fireEvent.click(
      await tela.findByRole("button", { name: "Adicionar Aurora" }),
    );
    fireEvent.click(tela.getByRole("button", { name: "Adicionar Brisa" }));
    fireEvent.change(tela.getByLabelText("Litros servidos a Aurora"), {
      target: { value: "3" },
    });
    fireEvent.change(tela.getByLabelText("Litros servidos a Brisa"), {
      target: { value: "4" },
    });
    expect(
      tela.getByRole("button", { name: "Confirmar destino e baixar 7 L" }),
    ).toBeTruthy();
    fireEvent.click(
      tela.getByRole("button", { name: "Confirmar destino e baixar 7 L" }),
    );
    await tela.findByText("Conexão perdida");
    expect(
      (tela.getByLabelText("Litros servidos a Aurora") as HTMLInputElement)
        .value,
    ).toBe("3");
    const primeiro = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(primeiro).toMatchObject({
      propriedadeId: 2,
      entradaId: "entrada",
      quantidadeDisponivelEsperadaLitros: 10,
      parcelas: [
        { animalId: "a", quantidadeLitros: 3 },
        { animalId: "b", quantidadeLitros: 4 },
      ],
    });
    fireEvent.click(
      tela.getByRole("button", { name: "Confirmar destino e baixar 7 L" }),
    );
    await tela.findByText(
      "Destino registrado e volume baixado uma vez do estoque.",
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(primeiro);
  });
  it("não confirma excesso ou zero servido", async () => {
    render(<DestinosLeite podeLancar />);
    fireEvent.click(tela.getByRole("button", { name: "Registrar fornecimento" }));
    await prepararOrigem();
    fireEvent.click(
      await tela.findByRole("button", { name: "Adicionar Aurora" }),
    );
    const input = tela.getByLabelText("Litros servidos a Aurora");
    fireEvent.change(input, { target: { value: "11" } });
    await tela.findByText(
      "As parcelas excedem o saldo da origem. Revise as quantidades.",
    );
    expect(
      (
        tela.getByRole("button", {
          name: "Confirmar destino e baixar 11 L",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(input, { target: { value: "0" } });
    expect(
      (
        tela.getByRole("button", {
          name: "Confirmar destino e baixar 0 L",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("vincula cria real e fornecimento existente sem inferir quantidade", async () => {
    render(<DestinosLeite podeLancar />);
    fireEvent.click(tela.getByRole("button", { name: "Registrar fornecimento" }));
    await prepararOrigem();
    await selecionarCampoLeite("Natureza declarada", "COLOSTRO");
    fireEvent.click(
      await tela.findByRole("button", { name: "Adicionar Cria Aurora" }),
    );
    await selecionarCampoLeite("Registro de colostro de Cria Aurora", "colostro-existente");
    const input = tela.getByLabelText(
      "Litros servidos a Cria Aurora",
    ) as HTMLInputElement;
    expect(input.value).toBe("3.5");
    expect(input.disabled).toBe(true);
    fireEvent.click(
      tela.getByRole("button", { name: "Confirmar destino e baixar 3,5 L" }),
    );
    await tela.findByText(
      "Destino registrado e volume baixado uma vez do estoque.",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).parcelas).toEqual([
      {
        animalId: "cria-animal",
        quantidadeLitros: 3.5,
        criaId: "cria-real",
        fornecimentoColostroId: "colostro-existente",
      },
    ]);
  }, 15000);
  it("estorna com motivo e versão sem apagar histórico", async () => {
    vi.mocked(consultarLeite).mockResolvedValue({
      itens: [historia],
      total: 1,
      pagina: 1,
      porPagina: 20,
    });
    render(<DestinosLeite podeLancar={false} />);
    await tela.findByText("Confirmado");
    cleanup();
    render(<DestinosLeite podeLancar />);
    fireEvent.click(
      await tela.findByRole("button", {
        name: "Estornar destino de 19/10/2026",
      }),
    );
    fireEvent.change(tela.getByLabelText("Motivo do estorno"), {
      target: { value: "Quantidade informada incorretamente" },
    });
    fireEvent.click(tela.getByRole("button", { name: "Confirmar estorno" }));
    await tela.findByText("Destino estornado. O histórico foi preservado.");
    expect(fetchMock.mock.calls[0][0]).toContain("/destinos/destino/estorno");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      propriedadeId: 2,
      versaoEsperada: 2,
      motivo: "Quantidade informada incorretamente",
    });
  });
});
