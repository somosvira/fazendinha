import { describe, expect, it } from "vitest";
import type { MovimentoConta } from "../novo-api";
import { fluxoDiario } from "./fluxo-contas";

function movimento(valor: string, direcao: "ENTRADA" | "SAIDA", data: string, transacao: Partial<MovimentoConta["transacao"]> = {}): MovimentoConta {
  return { id: 1, direcao, valor, transacao: { id: 1, tipo: "RECEBIMENTO", data, descricao: null, formaPagamento: null, parceiro: null, operacao: null, status: "CONFIRMADA", ...transacao } };
}

describe("fluxo diário das contas", () => {
  it("soma em centavos, usa o dia financeiro e preenche dias sem movimentos", () => {
    const dados = fluxoDiario([
      movimento("0.10", "ENTRADA", "2026-09-01T00:00:00Z"),
      movimento("0.20", "ENTRADA", "2026-09-01T00:00:00Z"),
      movimento("15.31", "SAIDA", "2026-09-30T23:59:59Z"),
      movimento("999", "ENTRADA", "2026-08-31"),
      movimento("999", "ENTRADA", "2026-10-01"),
      movimento("999", "ENTRADA", "2026-09-01", { status: "CANCELADA" }),
    ], "2026-09");
    expect(dados).toHaveLength(30);
    expect(dados[0]).toEqual({ data: "2026-09-01", entradas: 0.3, saidas: 0 });
    expect(dados[1]).toEqual({ data: "2026-09-02", entradas: 0, saidas: 0 });
    expect(dados[29]).toEqual({ data: "2026-09-30", entradas: 0, saidas: 15.31 });
    expect(fluxoDiario([], "2024-02")).toHaveLength(29);
  });

  it("exclui transferências e suas reversões do consolidado, incluindo registros antigos sem operação", () => {
    const movimentos = [
      movimento("100", "SAIDA", "2026-09-10", { tipo: "TRANSFERENCIA", status: "REVERTIDA" }),
      movimento("100", "ENTRADA", "2026-09-10", { tipo: "TRANSFERENCIA", status: "REVERTIDA" }),
      movimento("100", "ENTRADA", "2026-09-11", { tipo: "REVERSAO", reversaoDe: { tipo: "TRANSFERENCIA" } }),
      movimento("100", "SAIDA", "2026-09-11", { tipo: "REVERSAO", operacao: { id: 4, descricao: null, tipo: "TRANSFERENCIA_FINANCEIRA" } }),
      movimento("20", "ENTRADA", "2026-09-10"),
    ];
    const consolidado = fluxoDiario(movimentos, "2026-09", true);
    expect(consolidado[9]).toMatchObject({ entradas: 20, saidas: 0 });
    expect(consolidado[10]).toMatchObject({ entradas: 0, saidas: 0 });
    const conta = fluxoDiario(movimentos, "2026-09");
    expect(conta[9]).toMatchObject({ entradas: 120, saidas: 100 });
    expect(conta[10]).toMatchObject({ entradas: 100, saidas: 100 });
  });

  it("preserva o original revertido e registra a saída do estorno no mês em que ocorreu", () => {
    const movimentos = [
      movimento("50", "ENTRADA", "2026-08-31", { status: "REVERTIDA" }),
      movimento("50", "SAIDA", "2026-09-02", { tipo: "REVERSAO", reversaoDe: { tipo: "RECEBIMENTO" } }),
    ];
    expect(fluxoDiario(movimentos, "2026-08", true)[30]).toMatchObject({ entradas: 50, saidas: 0 });
    expect(fluxoDiario(movimentos, "2026-09", true)[1]).toMatchObject({ entradas: 0, saidas: 50 });
  });
});
