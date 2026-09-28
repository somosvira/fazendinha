// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormFiliacao } from "./FormFiliacao";
import { definirFiliacaoAnimal, listarGenitores, substituirComposicaoAnimal } from "../api";
import type { AnimalFicha, GenitorDTO } from "../types";

const toastMocks = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("../../../components/Toast", () => ({ useToast: () => toastMocks }));

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  definirFiliacaoAnimal: vi.fn(),
  substituirComposicaoAnimal: vi.fn(),
  listarGenitores: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarGenitores).mockResolvedValue([]);
});

const animal = {
  id: "animal-1", brinco: "1234",
  filiacao: { mae: null, pai: null },
} as unknown as AnimalFicha;

describe("FormFiliacao", () => {
  it("abre com a filiação atual e, salvando sem mexer, mantém mãe e pai", async () => {
    const comFiliacao = {
      ...animal,
      filiacao: {
        mae: { tipo: "ANIMAL", id: "mae-1", brinco: "V1", nome: "Mimosa", sexo: "F", baixado: false },
        pai: { tipo: "EXTERNO", id: "ext-9", nome: "Zeus", codigo: null, fornecedor: null },
      },
    } as unknown as AnimalFicha;
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({ ...comFiliacao, avisos: [], composicaoSugerida: null } as never);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={comFiliacao} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(definirFiliacaoAnimal).toHaveBeenCalledWith("animal-1", { maeId: "mae-1", maeExternaId: null, paiId: null, paiExternoId: "ext-9" });
  });

  it("sem escolher genitores, envia todos os quatro campos como null", async () => {
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({ ...animal, avisos: [], composicaoSugerida: null } as never);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(definirFiliacaoAnimal).toHaveBeenCalledWith("animal-1", { maeId: null, maeExternaId: null, paiId: null, paiExternoId: null });
  });

  it("escolhendo um genitor externo como pai, envia paiExternoId", async () => {
    const genitores: GenitorDTO[] = [{ id: "ext-1", sexo: "M", nome: "Touro X", codigo: null, fornecedor: null, observacao: null, ativo: true, composicao: [], composicaoRotulo: "", filhos: 0 }];
    vi.mocked(listarGenitores).mockImplementation((filtros) => Promise.resolve(filtros?.sexo === "M" ? genitores : []));
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({ ...animal, avisos: [], composicaoSugerida: null } as never);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Genitor externo" })[1]);
    await screen.findByText("Touro X");
    fireEvent.change(screen.getByLabelText(/Selecionar pai entre os genitores externos/), { target: { value: "ext-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));

    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(definirFiliacaoAnimal).toHaveBeenCalledWith("animal-1", { maeId: null, maeExternaId: null, paiId: null, paiExternoId: "ext-1" });
  });

  it("quando o servidor devolve composicaoSugerida, pergunta antes de aplicar", async () => {
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({
      ...animal, avisos: [], composicaoSugerida: { itens: [{ racaId: "r-ho", sigla: "HO", fracao64: 32 }], rotulo: "1/2 HO" },
    } as never);
    vi.mocked(substituirComposicaoAnimal).mockResolvedValue([]);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));
    expect(await screen.findByText("Substituir pela composição calculada?")).toBeTruthy();
    expect(onSalvo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Substituir pela calculada" }));
    await waitFor(() => expect(substituirComposicaoAnimal).toHaveBeenCalledWith("animal-1", { itens: [{ racaId: "r-ho", fracao64: 32 }], origem: "CALCULADA" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });

  it("modo animal sem mãe escolhida bloqueia o envio com erro no campo", async () => {
    render(<FormFiliacao animal={animal} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Animal da fazenda" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));
    expect(await screen.findByText("Escolha a mãe ou marque Desconhecida")).toBeTruthy();
    expect(definirFiliacaoAnimal).not.toHaveBeenCalled();
  });

  it("mantém o aviso visível em toast depois que o painel fecha", async () => {
    vi.mocked(definirFiliacaoAnimal).mockResolvedValue({ ...animal, avisos: [{ campo: "maeId", mensagem: "A mãe teria menos de 15 meses de idade no parto" }], composicaoSugerida: null } as never);
    const onSalvo = vi.fn();
    render(<FormFiliacao animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Salvar filiação/ }));
    await waitFor(() => expect(toastMocks.warn).toHaveBeenCalledWith("Filiação salva com aviso", "A mãe teria menos de 15 meses de idade no parto"));
    expect(onSalvo).toHaveBeenCalled();
  });
});
