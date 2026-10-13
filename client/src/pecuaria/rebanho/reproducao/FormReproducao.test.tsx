// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormReproducao } from "./FormReproducao";
import {
  registrarAvaliacao,
  registrarParto,
  type PainelReprodutivo,
} from "./api";
vi.mock("../api", () => ({
  listarAnimais: vi.fn().mockResolvedValue({ itens: [] }),
  listarGenitores: vi.fn().mockResolvedValue([]),
  listarLotes: vi.fn().mockResolvedValue([]),
  listarMaterialGenetico: vi.fn().mockResolvedValue([]),
}));
vi.mock("../sanidade/api", () => ({
  listarServicos: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 1 }));
vi.mock("./api", () => ({
  registrarAvaliacao: vi.fn(),
  registrarParto: vi.fn(),
  registrarTentativa: vi.fn(),
  reqV4: vi.fn(),
}));
const painel: PainelReprodutivo = {
  animais: [
    {
      animalId: "a",
      brinco: "100",
      nome: "Matriz",
      situacao: "GESTANTE",
      partos: 1,
      tentativasCiclo: 1,
      gestacao: { id: "g", status: "VALIDO" },
      restricoes: [],
    },
  ],
  // O sítio atual pode consultar o resumo clínico após transferência, sem histórico externo.
  gestacoes: [],
  tentativas: [],
  avaliacoes: [],
  partos: [],
  restricoes: [],
};
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
describe("registros reprodutivos", () => {
  it("bloqueia negativo com gestação e preserva os dados/chave no retry de avaliação", async () => {
    vi.mocked(registrarAvaliacao).mockRejectedValueOnce(
      new Error("Período em revisão"),
    );
    const salvo = vi.fn();
    render(
      <FormReproducao
        acao="avaliacao"
        painel={painel}
        animalInicial="a"
        onFechar={vi.fn()}
        onSalvo={salvo}
      />,
    );
    fireEvent.change(screen.getByLabelText("Resultado"), {
      target: { value: "NEGATIVO" },
    });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await screen.findByText(/Registre a perda gestacional/);
    expect(registrarAvaliacao).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Resultado"), {
      target: { value: "RECONFIRMACAO" },
    });
    fireEvent.change(screen.getByLabelText("Motivo / observação"), {
      target: { value: "Reavaliação pelo veterinário" },
    });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await screen.findByText("Período em revisão");
    expect(
      (screen.getByLabelText("Motivo / observação") as HTMLInputElement).value,
    ).toBe("Reavaliação pelo veterinário");
    expect(salvo).not.toHaveBeenCalled();
    const primeira = vi.mocked(registrarAvaliacao).mock.calls[0][0];
    expect(primeira.gestacaoId).toBe("g");
    vi.mocked(registrarAvaliacao).mockResolvedValueOnce({
      id: "e",
      animalId: "a",
      data: "2026-10-13",
    });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(salvo).toHaveBeenCalled());
    expect(vi.mocked(registrarAvaliacao).mock.calls[1][0].chave).toBe(
      primeira.chave,
    );
  });
  it("envia cria viva sem brinco para cadastro provisório e aborto sem cria", async () => {
    vi.mocked(registrarParto).mockResolvedValue({
      id: "p",
      animalId: "a",
      data: "2026-10-13",
    });
    const { unmount } = render(
      <FormReproducao
        acao="parto"
        painel={painel}
        animalInicial="a"
        onFechar={vi.fn()}
        onSalvo={vi.fn()}
      />,
    );
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(registrarParto).toHaveBeenCalledTimes(1));
    expect(vi.mocked(registrarParto).mock.calls[0][0].gestacaoId).toBe("g");
    expect(vi.mocked(registrarParto).mock.calls[0][0].crias).toEqual([
      { viva: true, sexo: "F", aptidao: "LEITE" },
    ]);
    unmount();
    render(
      <FormReproducao
        acao="parto"
        painel={painel}
        animalInicial="a"
        onFechar={vi.fn()}
        onSalvo={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Tipo de parto"), {
      target: { value: "ABORTO" },
    });
    fireEvent.submit(document.getElementById("form-reproducao")!);
    await waitFor(() => expect(registrarParto).toHaveBeenCalledTimes(2));
    expect(vi.mocked(registrarParto).mock.calls[1][0]).toMatchObject({
      tipo: "ABORTO",
      crias: [],
    });
  });
});

it("perda no mesmo dia permite negativo, preservando fronteira inclusiva para reconfirmação histórica", async () => {
  const p = {...painel, gestacoes: [{id:"g",animalId:"a",status:"VALIDO",confirmadaEm:"2026-10-01",encerradaEm:"2026-10-13"}], animais: painel.animais.map(a=>({...a,gestacao:null}))};
  vi.mocked(registrarAvaliacao).mockResolvedValue({id:"av",animalId:"a",data:"2026-10-13"});
  render(<FormReproducao acao="avaliacao" painel={p} animalInicial="a" dataInicial="2026-10-13" onFechar={vi.fn()} onSalvo={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Resultado"),{target:{value:"NEGATIVO"}});
  fireEvent.submit(document.getElementById("form-reproducao")!);
  await waitFor(()=>expect(registrarAvaliacao).toHaveBeenCalled());
  expect(vi.mocked(registrarAvaliacao).mock.calls[0][0].gestacaoId).toBeUndefined();
});
