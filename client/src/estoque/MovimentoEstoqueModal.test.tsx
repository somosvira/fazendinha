// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MovimentoEstoqueModal } from "./MovimentoEstoqueModal";

const listar = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ listarMovimentos: listar }));
afterEach(cleanup);

describe("detalhe do movimento de estoque", () => {
  it("mostra quantidade, custo, origem e lotes de estoque sem sair da tela", async () => {
    listar.mockResolvedValue({ total: 1, itens: [{ id: "m1", seq: 472, produtoId: "p1", produto: "Bicarbonato", tipo: "ENTRADA", origem: "COMPRA", status: "CONFIRMADO", data: "2026-11-04", quantidade: 3000, custoUnitario: 3, valorTotal: 9000, fornecedor: "Cooperativa", observacao: null, centrosCusto: [{ id: "c", nome: "Produção leiteira" }], partidas: [{ partidaId: "l1", codigo: "LOTE-1", validade: "2027-01-10", quantidade: "3000" }], operacaoId: "o1", operacaoNumero: 12, reversaoDeId: null, materialGeneticoId: null, vinculo: null }] });
    render(<MovimentoEstoqueModal movimentoId="m1" propriedadeId={1} unidade="kg" onFechar={() => {}} />);
    expect(await screen.findByText("Entrada #472 · Bicarbonato")).toBeTruthy();
    expect(screen.getByText("+3.000 kg")).toBeTruthy();
    expect(screen.getByText("Compra · operação #12")).toBeTruthy();
    expect(screen.getByText("LOTE-1")).toBeTruthy();
    expect(screen.getByText("Validade 10/01/2027")).toBeTruthy();
    expect(listar).toHaveBeenCalledWith({ movimentoId: "m1", propriedadeId: 1 });
  });
});
