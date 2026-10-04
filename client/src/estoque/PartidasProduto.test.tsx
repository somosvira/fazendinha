// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PartidasProduto } from "./PartidasProduto";
import { listarPartidasNutricionais } from "../pecuaria/rebanho/nutricao/api";
vi.mock("../pecuaria/rebanho/nutricao/api", () => ({ listarPartidasNutricionais: vi.fn() }));
vi.mock("../api/propriedades", () => ({ listarPropriedades: vi.fn().mockResolvedValue([{ id: 2, nome: "Fazenda Rio Novo", ativo: true }]) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listarPartidasNutricionais).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("controle de lotes por validade", () => {
  it("edição exige confirmação da prévia para ativar o controle", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revisao: "r", movimentosLegados: 0, saldos: [] }) }));
    const onMudou = vi.fn();
    render(<PartidasProduto configuracao produtoId="p" propriedadeId={2} rastreado={false} onMudou={onMudou} />);
    fireEvent.click(screen.getByRole("button", { name: "Ativar controle de lotes por validade" }));
    await screen.findByRole("button", { name: "Confirmar ativação" });
    expect(onMudou).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Ativar controle de lotes por validade" })).toBeTruthy();
  });
  it("ativo sem saldo não oferece identificação nem cria lote", async () => {
    render(<PartidasProduto produtoId="p" propriedadeId={2} rastreado onMudou={vi.fn()} />);
    await screen.findByText(/Controle de lotes por validade ativo/);
    expect(screen.queryByText("Identificar estoque sem validade")).toBeNull();
  });
  it("identificação fica nas opções avançadas apenas com saldo desconhecido positivo", async () => {
    vi.mocked(listarPartidasNutricionais).mockResolvedValue([{ id: "l", codigo: "LEGADO", nome: "Sem validade", validade: null, saldo: "4", origemRastreio: "LEGADO_NAO_IDENTIFICADO" }]);
    render(<PartidasProduto produtoId="p" propriedadeId={2} rastreado onMudou={vi.fn()} />);
    const opcao = await screen.findByText("Identificar estoque sem validade");
    expect(opcao.closest("details")?.open).toBe(false);
    fireEvent.click(opcao); fireEvent.click(screen.getByRole("button", { name: "Identificar validade do estoque existente" }));
    expect(screen.getByLabelText("Nome do lote (opcional)")).toBeTruthy();
    expect(screen.queryByLabelText("Código do lote")).toBeNull();
  });
  it("prévia da ativação mostra sítio cadastrado e preservação física", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revisao: "r", movimentosLegados: 2, saldos: [{ propriedadeId: 2, quantidade: "20" }] }) }));
    render(<PartidasProduto produtoId="p" propriedadeId={2} rastreado={false} onMudou={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ativar controle de lotes por validade" }));
    await screen.findByText(/Fazenda Rio Novo: 20/);
    expect(screen.getByText(/Quantidade e valor totais serão preservados/)).toBeTruthy();
  });
  it("prévia sem movimentos explicita ausência de saldo e lote vazio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revisao: "r", movimentosLegados: 0, saldos: [] }) }));
    render(<PartidasProduto produtoId="p" propriedadeId={2} rastreado={false} onMudou={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ativar controle de lotes por validade" }));
    await screen.findByText(/A ativação não cria lote vazio nem saldo/);
  });
});
