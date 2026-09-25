// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormBaixa } from "./FormBaixa";
import { darBaixaAnimal } from "../api";
import type { AnimalFicha, CatalogoMotivoBaixa } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  darBaixaAnimal: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const animal: AnimalFicha = {
  id: "animal-1", brinco: "1234", nome: "Mimosa", sexo: "F", categoria: null, categoriaOrigem: "SEM_CATEGORIA", categoriaCalculada: null, idadeMeses: 40, idadeNaBaixa: false,
  dataNascimento: "2022-01-01", dataEntrada: "2022-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Sede" },
  lote: null, aptidao: null, papelReprodutivo: null, composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
  gmdRecente: null, noLocalDesde: null,
  brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 0, observacao: null,
  composicao: [], historicoLocalizacoes: [], historicoDestinos: [], historicoPesagens: [], historicoCategoriasManuais: [],
  baixa: null,
  peso: { ultimo: null, gmdRecente: null, gmdDesdeEntrada: null, gmdPeriodo: { dias: null, valor: null, pesagens: 0 } },
  historicoBaixas: [],
};

const motivos: CatalogoMotivoBaixa[] = [
  { id: "mv1", nome: "Baixa produção", classe: "DESCARTE_VOLUNTARIO" },
  { id: "mv2", nome: "Excesso de animais", classe: "DESCARTE_VOLUNTARIO" },
  { id: "mi1", nome: "Problema locomotor", classe: "DESCARTE_INVOLUNTARIO" },
  { id: "mm1", nome: "Doença", classe: "MORTE" },
];

function grupos(select: HTMLSelectElement) {
  return Array.from(select.querySelectorAll("optgroup")).map((g) => g.label);
}
function opcoesDoGrupo(select: HTMLSelectElement, label: string) {
  return Array.from(select.querySelectorAll(`optgroup[label="${label}"] option`)).map((o) => o.textContent);
}

describe("FormBaixa", () => {
  it("Venda (padrão) mostra só motivos de descarte, agrupados por classe", () => {
    render(<FormBaixa animal={animal} motivos={motivos} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    expect((screen.getByLabelText(/^Tipo/) as HTMLSelectElement).value).toBe("VENDA");
    const select = screen.getByLabelText("Motivo do catálogo") as HTMLSelectElement;
    expect(grupos(select)).toEqual(["Descarte voluntário", "Descarte involuntário"]);
    expect(opcoesDoGrupo(select, "Descarte voluntário")).toEqual(["Baixa produção", "Excesso de animais"]);
    expect(opcoesDoGrupo(select, "Descarte involuntário")).toEqual(["Problema locomotor"]);
    expect(screen.queryByText("Doença")).toBeNull();
  });

  it("Morte mostra só motivos de morte", () => {
    render(<FormBaixa animal={animal} motivos={motivos} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Tipo/), { target: { value: "MORTE" } });
    const select = screen.getByLabelText("Motivo do catálogo") as HTMLSelectElement;
    expect(grupos(select)).toEqual(["Morte"]);
    expect(opcoesDoGrupo(select, "Morte")).toEqual(["Doença"]);
    expect(screen.queryByText("Baixa produção")).toBeNull();
  });

  it("Extravio esconde o campo de motivo", () => {
    render(<FormBaixa animal={animal} motivos={motivos} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Tipo/), { target: { value: "EXTRAVIO" } });
    expect(screen.queryByLabelText("Motivo do catálogo")).toBeNull();
  });

  it("trocar o tipo limpa o motivo já selecionado", () => {
    render(<FormBaixa animal={animal} motivos={motivos} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    const select = screen.getByLabelText("Motivo do catálogo") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "mv1" } });
    expect(select.value).toBe("mv1");
    fireEvent.change(screen.getByLabelText(/^Tipo/), { target: { value: "ABATE" } });
    expect((screen.getByLabelText("Motivo do catálogo") as HTMLSelectElement).value).toBe("");
  });

  it("envia data, tipo, motivo e observação ao confirmar", async () => {
    vi.mocked(darBaixaAnimal).mockResolvedValue({ ...animal, situacao: "BAIXADO" });
    const onSalvo = vi.fn();
    render(<FormBaixa animal={animal} motivos={motivos} onSalvo={onSalvo} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Data da baixa/), { target: { value: "2026-09-12" } });
    fireEvent.change(screen.getByLabelText(/^Tipo/), { target: { value: "ABATE" } });
    fireEvent.change(screen.getByLabelText("Motivo do catálogo"), { target: { value: "mi1" } });
    fireEvent.change(screen.getByLabelText("Observação"), { target: { value: "Lote de descarte" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
    await waitFor(() => expect(darBaixaAnimal).toHaveBeenCalledWith("animal-1", { data: "2026-09-12", tipo: "ABATE", motivoId: "mi1", observacao: "Lote de descarte" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });

  it("sem motivo escolhido envia motivoId nulo", async () => {
    vi.mocked(darBaixaAnimal).mockResolvedValue({ ...animal, situacao: "BAIXADO" });
    render(<FormBaixa animal={animal} motivos={motivos} onSalvo={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
    await waitFor(() => expect(darBaixaAnimal).toHaveBeenCalledWith("animal-1", expect.objectContaining({ tipo: "VENDA", motivoId: null })));
  });
});
