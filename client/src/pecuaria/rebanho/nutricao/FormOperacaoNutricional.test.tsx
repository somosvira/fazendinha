// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormOperacaoNutricional } from "./FormOperacaoNutricional";
import * as api from "./api";
import * as lotesApi from "../api";
vi.mock("../api", () => ({ buscarLote: vi.fn(), listarLotes: vi.fn() }));
vi.mock("./api", () => ({ atribuirDieta: vi.fn(), corrigirVigencia: vi.fn(), listarDietas: vi.fn(), listarCentrosNutricionais: vi.fn(), obterVigencia: vi.fn() }));
vi.mock("./ConferenciaPeriodos", () => ({ ConferenciaPeriodos: ({ loteId, propriedadeId }: { loteId: string; propriedadeId: number }) => <p>Consumo {loteId} no sítio {propriedadeId}</p> }));
const lote = { id: "lote", nome: "Matrizes", propriedadeId: 2, propriedade: { id: 2, nome: "Destino" }, ativo: true, animaisAtivos: 5, observacao: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lotesApi.buscarLote).mockResolvedValue(lote); vi.mocked(lotesApi.listarLotes).mockResolvedValue([lote]);
  vi.mocked(api.listarDietas).mockResolvedValue([{ id: "publicada", nome: "Dieta publicada", versao: 1, publicadaEm: "2026-10-01", itens: [] }, { id: "rascunho", nome: "Dieta em estudo", versao: 2, publicadaEm: null, itens: [] }]);
  vi.mocked(api.listarCentrosNutricionais).mockResolvedValue([]);
  vi.mocked(api.obterVigencia).mockResolvedValue({ id: "v", loteId: "lote", desde: "2026-09-01", ate: null, dieta: { id: "publicada", nome: "Dieta publicada", versao: 1 } });
});
afterEach(cleanup);
describe("formulários próprios de nutrição", () => {
  it("no consolidado requer lote explícito e atribui apenas uma versão publicada ao sítio desse lote", async () => {
    const onSalvo = vi.fn();
    render(<FormOperacaoNutricional acao="atribuir" onVoltar={vi.fn()} onSalvo={onSalvo} />);
    await screen.findByLabelText("Lote");
    expect(screen.queryByLabelText("Versão publicada")).toBeNull();
    fireEvent.change(screen.getByLabelText("Lote"), { target: { value: "lote" } });
    const versao = await screen.findByLabelText("Versão publicada");
    expect(screen.queryByRole("option", { name: /Dieta em estudo/ })).toBeNull();
    fireEvent.change(versao, { target: { value: "publicada" } });
    fireEvent.change(screen.getByPlaceholderText("dd/mm/aaaa"), { target: { value: "03/10/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar ao lote" }));
    await waitFor(() => expect(api.atribuirDieta).toHaveBeenCalledWith({ loteId: "lote", propriedadeId: 2, dietaId: "publicada", desde: "2026-10-03" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith("lote"));
  });
  it("correção restaura o início histórico e exige motivo sem alterar outra vigência", async () => {
    render(<FormOperacaoNutricional acao="corrigir" loteId="lote" vigenciaId="v" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByLabelText("Motivo da correção");
    await waitFor(() => expect(screen.getByPlaceholderText("dd/mm/aaaa")).toHaveProperty("value", "01/09/2026"));
    expect(screen.getByRole("button", { name: "Confirmar correção" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("dd/mm/aaaa"), { target: { value: "02/09/2026" } });
    fireEvent.change(screen.getByLabelText("Motivo da correção"), { target: { value: "Correção conferida" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar correção" }));
    await waitFor(() => expect(api.corrigirVigencia).toHaveBeenCalledWith("v", { propriedadeId: 2, desde: "2026-09-02", motivo: "Correção conferida" }));
  });
  it("não permite corrigir uma vigência de outro lote", async () => {
    vi.mocked(api.obterVigencia).mockResolvedValue({ id: "v", loteId: "outro", desde: "2026-09-01", ate: null, dieta: { id: "d", nome: "Outra dieta", versao: 1 } });
    render(<FormOperacaoNutricional acao="corrigir" loteId="lote" vigenciaId="v" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("A vigência não pertence a este lote.");
    expect(screen.queryByRole("button", { name: "Confirmar correção" })).toBeNull();
  });
  it("reutiliza a conferência de períodos com lote e sítio fixos, sem incluir o histórico na tela", async () => {
    render(<FormOperacaoNutricional acao="consumo" loteId="lote" onVoltar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Consumo lote no sítio 2");
    expect(screen.queryByText("Histórico de fechamentos")).toBeNull();
  });
});
