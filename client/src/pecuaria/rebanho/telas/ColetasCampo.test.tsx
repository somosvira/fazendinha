// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  listarLotes: vi.fn(),
  autorizarImpressao: vi.fn(),
  concluirColeta: vi.fn(),
  listarColetas: vi.fn(),
  obterColeta: vi.fn(),
  prepararColeta: vi.fn(),
  salvarRascunho: vi.fn(),
}));

vi.mock("../api", () => ({ listarLotes: mocks.listarLotes }));
vi.mock("../coletas/api", () => ({
  ColetaApiError: class ColetaApiError extends Error {
    constructor(message: string, public campo?: string) { super(message); }
  },
  autorizarImpressao: mocks.autorizarImpressao,
  concluirColeta: mocks.concluirColeta,
  listarColetas: mocks.listarColetas,
  obterColeta: mocks.obterColeta,
  prepararColeta: mocks.prepararColeta,
  salvarRascunho: mocks.salvarRascunho,
}));
vi.mock("../sanidade/api", () => ({ reqSanidade: vi.fn().mockResolvedValue([]) }));
vi.mock("../sanidade/FormAplicacaoServico", () => ({ FormAplicacaoServico: () => null }));
vi.mock("../../../components/DatePicker", () => ({
  DatePicker: ({ id, value, onChange, required, ...props }: { id: string; value: string; onChange: (value: string) => void; required?: boolean }) =>
    <input {...props} id={id} type="date" required={required} value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock("../../../components/MultiSelect", () => ({
  MultiSelect: ({ label, options, value, onValueChange }: {
    label: string; options: Array<{ value: string; label: string }>; value: string[]; onValueChange: (value: string[]) => void;
  }) => <fieldset><legend>{label}</legend>{options.map((o) => <label key={o.value}>
    <input type="checkbox" checked={value.includes(o.value)} onChange={() => onValueChange(value.includes(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value])} />
    {o.label}
  </label>)}</fieldset>,
}));
vi.mock("../../../financeiro/PainelCadastro", () => ({
  classeInput: "input",
  CampoFormulario: ({ id, rotulo, children }: {
    id: string; rotulo: string; children: (props: { id: string; "aria-label": string; "aria-invalid": boolean; "aria-describedby": undefined }) => React.ReactNode;
  }) => <div><label htmlFor={id}>{rotulo}</label>{children({ id, "aria-label": rotulo, "aria-invalid": false, "aria-describedby": undefined })}</div>,
  PainelCadastro: ({ aberto, titulo, children, rodape }: { aberto: boolean; titulo: string; children: React.ReactNode; rodape: React.ReactNode }) =>
    aberto ? <section role="dialog" aria-label={titulo}><h2>{titulo}</h2>{children}{rodape}</section> : null,
}));
vi.mock("../ui", () => ({ Paginacao: () => null, rolarParaCampo: vi.fn() }));

import { ColetasCampo } from "./ColetasCampo";
import type { ColetaCampoDTO, ItemCampo } from "../coletas/api";

const loteId = "lote-teste";
const propriedadeId = 2;
const animais = [
  { animalId: "animal-2", brinco: "RT-2", nome: null, loteId, loteNome: "Lote teste" },
  { animalId: "animal-10", brinco: "RT-10", nome: null, loteId, loteNome: "Lote teste" },
  { animalId: "animal-11", brinco: "RT-11", nome: null, loteId, loteNome: "Lote teste" },
];

function coleta(overrides: Partial<ColetaCampoDTO> = {}): ColetaCampoDTO {
  return {
    id: "coleta-teste-1", propriedadeId, data: "2026-10-06", tipo: "PESAGEM", titulo: "Pesagem de teste",
    status: "PREPARADA", versao: 1, propriedade: { nome: "Sítio teste" },
    snapshot: { propriedadeNome: "Sítio teste", animais },
    rascunho: {
      tipoPesagem: "ROTINA", origemPesagem: "MANUAL",
      itens: animais.map((a) => ({ animalId: a.animalId, situacao: "PENDENTE", peso: "", motivo: "", observacao: "" })),
    },
    resultados: null,
    ...overrides,
  };
}

function alterarItem(dto: ColetaCampoDTO, animalId: string, patch: Partial<ItemCampo>): ColetaCampoDTO {
  return {
    ...dto,
    rascunho: { ...dto.rascunho, itens: dto.rascunho.itens.map((i) => i.animalId === animalId ? { ...i, ...patch } : i) },
  };
}

function abrirFicha(dto = coleta()) {
  window.history.replaceState(null, "", "/pecuaria/rebanho/pesagens?coletaId=" + dto.id);
  mocks.obterColeta.mockResolvedValue(dto);
  return render(<ColetasCampo podeLancar />);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listarLotes.mockResolvedValue([{
    id: loteId, nome: "Lote teste", ativo: true, propriedadeId, propriedade: { id: propriedadeId, nome: "Sítio teste" }, animaisAtivos: 3,
  }]);
  mocks.listarColetas.mockResolvedValue({ itens: [], total: 0, pagina: 1, limite: 20 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

it("abre a preparação pelo lote somente quando o catálogo confirma sítio e lote ativos", async () => {
  window.history.replaceState(null, "", `/pecuaria/rebanho/coletas?preparar=1&loteId=${loteId}&propriedadeId=${propriedadeId}`);
  render(<ColetasCampo podeLancar />);
  await screen.findByRole("dialog", { name: "Preparar ficha de campo" });
  await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true));
  expect((screen.getByLabelText("Sítio") as HTMLSelectElement).value).toBe(String(propriedadeId));
});

describe("Coletas de campo", () => {
  it("prepara ficha a partir dos lotes selecionados", async () => {
    const dto = coleta();
    mocks.prepararColeta.mockResolvedValue(dto);
    mocks.obterColeta.mockResolvedValue(dto);
    render(<ColetasCampo podeLancar />);
    fireEvent.click(await screen.findByRole("button", { name: "Preparar primeira ficha" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Lote teste/ }));
    fireEvent.click(screen.getByRole("dialog", { name: "Preparar ficha de campo" }).querySelector('button[form="preparar-coleta"]')!);

    await waitFor(() => expect(mocks.prepararColeta).toHaveBeenCalledOnce());
    expect(mocks.prepararColeta).toHaveBeenCalledWith(expect.objectContaining({
      propriedadeId, loteIds: [loteId], tipo: "PESAGEM", titulo: expect.stringContaining("Pesagem corporal"),
    }));
    await screen.findByRole("heading", { level: 2, name: "Pesagem de teste" });
    expect(new URLSearchParams(window.location.search).get("coletaId")).toBe(dto.id);
  });

  it("mantém vírgula decimal e zero como realizado, mas não revisa enquanto houver pendente", async () => {
    const dto = coleta();
    abrirFicha(dto);
    fireEvent.change(await screen.findByLabelText("Peso de RT-2 em kg"), { target: { value: "420,5" } });
    fireEvent.change(screen.getByLabelText("Peso de RT-10 em kg"), { target: { value: "0" } });

    expect(screen.getByLabelText("Peso de RT-2 em kg")).toHaveProperty("value", "420,5");
    expect(screen.getByLabelText("Peso de RT-10 em kg")).toHaveProperty("value", "0");
    expect(screen.getByLabelText("Realização de RT-2")).toHaveProperty("value", "REALIZADO");
    expect(screen.getByLabelText("Realização de RT-10")).toHaveProperty("value", "REALIZADO");
    fireEvent.click(screen.getByRole("button", { name: "Conferir lançamentos" }));
    expect((await screen.findAllByText(/Indique o que foi realizado em cada animal/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Confirmar ficha" })).toBeNull();
    expect(mocks.salvarRascunho).not.toHaveBeenCalled();
    expect(mocks.concluirColeta).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Realização de RT-11"), { target: { value: "NAO_REALIZADO" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Animal não encontrado" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir lançamentos" }));
    expect(screen.queryByRole("button", { name: "Confirmar ficha" })).toBeNull();
    expect(screen.getByLabelText("Peso de RT-10 em kg").getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(screen.getByLabelText("Peso de RT-10 em kg"), { target: { value: "380,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir lançamentos" }));
    expect(await screen.findByText("Confira antes de concluir")).toBeTruthy();
    expect(screen.getByText("2 realizados · 1 não realizados.")).toBeTruthy();
    expect(screen.getByLabelText("Peso de RT-2 em kg")).toHaveProperty("value", "420,5");
    expect(screen.getByLabelText("Peso de RT-10 em kg")).toHaveProperty("value", "380,5");
    expect(mocks.concluirColeta).not.toHaveBeenCalled();
  });

  it("salva rascunho e repete conclusão com a mesma versão sem salvar fatos duas vezes", async () => {
    const modelo = coleta();
    const animaisDaFicha = modelo.snapshot.animais.slice(0, 2);
    const inicial = coleta({
      snapshot: { ...modelo.snapshot, animais: animaisDaFicha },
      rascunho: { ...modelo.rascunho, itens: modelo.rascunho.itens.slice(0, 2) },
    });
    const salva = alterarItem(alterarItem(inicial, "animal-2", { peso: "400,25", situacao: "REALIZADO" }), "animal-10", { peso: "380,5", situacao: "REALIZADO" });
    const salvo = coleta({ ...inicial, status: "EM_PREENCHIMENTO", versao: 2, rascunho: salva.rascunho });
    const concluida = coleta({ ...salvo, status: "CONCLUIDA", versao: 3, resultados: [
      { animalId: "animal-2", id: "peso-2", tipo: "PESAGEM" }, { animalId: "animal-10", id: "peso-10", tipo: "PESAGEM" },
    ] });
    mocks.salvarRascunho.mockResolvedValue(salvo);
    mocks.concluirColeta.mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValueOnce(concluida);
    abrirFicha(inicial);

    fireEvent.change(await screen.findByLabelText("Peso de RT-2 em kg"), { target: { value: "400,25" } });
    fireEvent.change(screen.getByLabelText("Peso de RT-10 em kg"), { target: { value: "380,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar e continuar depois" }));
    await screen.findByText("Rascunho salvo. Você pode continuar depois.");
    expect(mocks.salvarRascunho).toHaveBeenCalledOnce();
    expect(mocks.salvarRascunho.mock.calls[0][1].itens).toEqual(expect.arrayContaining([
      expect.objectContaining({ animalId: "animal-2", peso: "400,25", situacao: "REALIZADO" }),
      expect.objectContaining({ animalId: "animal-10", peso: "380,5", situacao: "REALIZADO" }),
    ]));

    fireEvent.click(screen.getByRole("button", { name: "Conferir lançamentos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar ficha" }));
    await screen.findByText("Resposta perdida");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ficha" }));
    await screen.findByText("Ficha concluída. Os lançamentos já estão nas fichas dos animais.");

    expect(mocks.salvarRascunho).toHaveBeenCalledOnce();
    expect(mocks.concluirColeta).toHaveBeenCalledTimes(2);
    expect(mocks.concluirColeta.mock.calls.map(([arg]) => [arg.id, arg.versao])).toEqual([
      [inicial.id, salvo.versao], [inicial.id, salvo.versao],
    ]);
  });

  it("usa somentePesagens no filtro de listagem", async () => {
    render(<ColetasCampo podeLancar={false} somentePesagens />);
    await waitFor(() => expect(mocks.listarColetas).toHaveBeenCalledWith(1, "PESAGEM"));
    expect(screen.getByRole("heading", { name: "Pesagens" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Preparar primeira ficha" })).toBeNull();
  });

  it("autoriza a impressão antes de chamar window.print", async () => {
    const dto = coleta();
    mocks.autorizarImpressao.mockResolvedValue(dto);
    const print = vi.fn();
    vi.stubGlobal("print", print);
    abrirFicha(dto);
    fireEvent.click(await screen.findByRole("button", { name: /Imprimir ficha/ }));
    await waitFor(() => expect(mocks.autorizarImpressao).toHaveBeenCalledWith(dto.id));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(mocks.autorizarImpressao.mock.invocationCallOrder[0]).toBeLessThan(print.mock.invocationCallOrder[0]);
  });
});
