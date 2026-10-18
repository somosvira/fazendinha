// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustosDiretos } from "./CustosDiretos";
import { escreverCustos, obterCustos, obterPreparatorios, type CustosDTO } from "./api";

vi.mock("./api", () => ({ obterCustos: vi.fn(), escreverCustos: vi.fn(), obterPreparatorios: vi.fn() }));
vi.mock("../../../lib/auth", () => ({ getUsuario: () => ({ dono: true, areas: [], flags: [] }) }));
const dados = (): CustosDTO => ({
  rotulo: "Custo direto registrado", cobertura: "COMPLETO", situacao: "COMPLETO", totalConhecido: "100.00", componentesPendentes: 0,
  componentes: [{ chave: "movimento:m", fonteId: "t", tipoFonte: "TENTATIVA", animalId: "a", data: "2026-10-01", descricao: "Tentativa IA", estadoFato: "VALIDO", participacaoId: null, finalidade: "REPRODUCAO", natureza: "MATERIAL", estado: "CONHECIDO", valor: "100.00", origemId: null }], limitacoes: [], escopo: "TENTATIVA", propriedadeId: 1, periodo: { inicio: null, fim: null, referencia: "DATA_DO_FATO" }, totalIntegral: null,
  totalComponentes: 1, pagina: 1, limite: 25, atribuicoesPreparos: [],
  fontes: [{ id: "t", tipo: "TENTATIVA", descricao: "Tentativa IA", data: "2026-10-01", origemMaterial: "DOCUMENTADA", versaoClassificacao: 2, classificacao: null, documentoMaterial: null }],
});
const candidato = (id: string) => ({ ...dados(), id, tipo: "APLICACAO" as const, descricao: `Hormônio ${id}`, data: "2026-09-30" });
function abrirPreparatorios() {
  const details = screen.getByText("Vincular preparatório à tentativa").parentElement!;
  details.setAttribute("open", "");
  fireEvent(details, new Event("toggle"));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterCustos).mockResolvedValue(dados());
  vi.mocked(obterPreparatorios).mockResolvedValue({ itens: [candidato("h")] });
  vi.mocked(escreverCustos).mockResolvedValue({});
});
afterEach(cleanup);

describe("rascunhos dos editores de custos", () => {
  it("conserva classificação e parcelas durante a recarga do recorte, com a chave do retry", async () => {
    vi.mocked(escreverCustos).mockRejectedValueOnce(new Error("Revisão pendente"));
    render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar />);
    await screen.findByRole("table", { name: "Componentes do custo direto registrado" });
    fireEvent.change(screen.getByLabelText("Fato a classificar"), { target: { value: "TENTATIVA:t" } });
    fireEvent.change(screen.getByLabelText("Finalidade gerencial"), { target: { value: "SANIDADE" } });
    abrirPreparatorios();
    await screen.findByRole("option", { name: /Hormônio h/ });
    fireEvent.change(screen.getByLabelText("Preparatório"), { target: { value: "APLICACAO:h" } });
    fireEvent.change(screen.getByLabelText("Atribuição"), { target: { value: "PARCELA" } });
    fireEvent.change(screen.getByLabelText("Parcela do material (R$)"), { target: { value: "10.25" } });
    fireEvent.change(screen.getByLabelText("Motivo do vínculo"), { target: { value: "Conferência do preparatório" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar vínculo" }));
    await screen.findByText("Revisão pendente");
    const primeiro = vi.mocked(escreverCustos).mock.calls[0];
    let resolver!: (valor: CustosDTO) => void;
    vi.mocked(obterCustos).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Personalizar período dos custos" }));
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    await screen.findByText("Consultando custos…");
    expect(screen.queryByLabelText("Fato a classificar")).toBeNull();
    await act(async () => resolver(dados()));
    expect(screen.getByLabelText("Fato a classificar")).toHaveProperty("value", "TENTATIVA:t");
    expect(screen.getByLabelText("Finalidade gerencial")).toHaveProperty("value", "SANIDADE");
    expect(screen.getByLabelText("Preparatório")).toHaveProperty("value", "APLICACAO:h");
    expect(screen.getByLabelText("Parcela do material (R$)")).toHaveProperty("value", "10.25");
    fireEvent.submit(screen.getByRole("button", { name: "Confirmar vínculo" }).closest("form")!);
    await waitFor(() => expect(escreverCustos).toHaveBeenCalledTimes(2));
    expect(vi.mocked(escreverCustos).mock.calls[1]).toEqual(primeiro);
  });

  it("ignora erro tardio dos preparatórios após trocar tentativa e sítio", async () => {
    let rejeitar!: (erro: Error) => void;
    vi.mocked(obterPreparatorios).mockImplementation((id) => id === "a"
      ? new Promise((_resolve, reject) => { rejeitar = reject; })
      : Promise.resolve({ itens: [candidato("b")] }));
    const { rerender } = render(<CustosDiretos tentativaId="a" propriedadeId={1} podeLancar />);
    await screen.findByRole("table", { name: "Componentes do custo direto registrado" });
    abrirPreparatorios();
    await waitFor(() => expect(obterPreparatorios).toHaveBeenCalledWith("a", 1));
    rerender(<CustosDiretos tentativaId="b" propriedadeId={2} podeLancar />);
    await screen.findByRole("table", { name: "Componentes do custo direto registrado" });
    abrirPreparatorios();
    await screen.findByRole("option", { name: /Hormônio b/ });
    await act(async () => rejeitar(new Error("Falha antiga")));
    expect(screen.queryByText("Falha antiga")).toBeNull();
    expect(screen.getByRole("option", { name: /Hormônio b/ })).toBeTruthy();
    expect(screen.getByLabelText("Preparatório")).toHaveProperty("value", "");
  });
});

it("resposta de gravação antiga não limpa editor nem bloqueia o novo alvo/sítio", async () => {
  let rejeitar!: (erro: Error) => void;
  vi.mocked(escreverCustos).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejeitar = reject; }));
  const { rerender } = render(<CustosDiretos tentativaId="a" propriedadeId={1} podeLancar />);
  await screen.findByRole("table", { name: "Componentes do custo direto registrado" });
  fireEvent.change(screen.getByLabelText("Fato a classificar"), { target: { value: "TENTATIVA:t" } });
  fireEvent.change(screen.getByLabelText("Motivo da classificação"), { target: { value: "Explicação do alvo antigo" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar classificação" }));
  await waitFor(() => expect(escreverCustos).toHaveBeenCalledOnce());
  rerender(<CustosDiretos tentativaId="b" propriedadeId={2} podeLancar />);
  await screen.findByRole("table", { name: "Componentes do custo direto registrado" });
  fireEvent.change(screen.getByLabelText("Fato a classificar"), { target: { value: "TENTATIVA:t" } });
  fireEvent.change(screen.getByLabelText("Motivo da classificação"), { target: { value: "Rascunho próprio do sítio2" } });
  await act(async () => rejeitar(new Error("Falha tardia do sítio1")));
  expect(screen.queryByText("Falha tardia do sítio1")).toBeNull();
  expect(screen.getByLabelText("Motivo da classificação")).toHaveProperty("value", "Rascunho próprio do sítio2");
  expect(screen.getByRole("button", { name: "Salvar classificação" })).toHaveProperty("disabled", false);
});

it("retirar lançar oculta confirmação sem descartar rascunho do mesmo alvo", async () => {
  const { rerender } = render(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar />);
  await screen.findByRole("table", { name: "Componentes do custo direto registrado" });
  fireEvent.change(screen.getByLabelText("Fato a classificar"), { target: { value: "TENTATIVA:t" } });
  fireEvent.change(screen.getByLabelText("Motivo da classificação"), { target: { value: "Rascunho conservado com revisão" } });
  rerender(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar={false} />);
  expect(screen.queryByRole("button", { name: "Salvar classificação" })).toBeNull();
  expect(escreverCustos).not.toHaveBeenCalled();
  rerender(<CustosDiretos tentativaId="t" propriedadeId={1} podeLancar />);
  expect(screen.getByLabelText("Motivo da classificação")).toHaveProperty("value", "Rascunho conservado com revisão");
});
