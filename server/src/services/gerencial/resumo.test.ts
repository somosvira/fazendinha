import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { UsuarioContexto } from "../auth/sessao.js";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), principal: vi.fn(), caixa: vi.fn(), estoque: vi.fn(), nutricao: vi.fn(), fontes: vi.fn(),
}));
vi.mock("../../db.js", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("../propriedade.js", () => ({ propriedadePrincipalId: mocks.principal }));
vi.mock("./caixa.js", () => ({ consultarCaixaTx: mocks.caixa }));
vi.mock("./estoque.js", () => ({ consultarEstoqueTx: mocks.estoque }));
vi.mock("./nutricao.js", () => ({ consultarNutricaoTx: mocks.nutricao }));
vi.mock("../pecuaria/custos/custos.js", () => ({ carregarFontesCustoTx: mocks.fontes }));
import { obterResumoGerencial } from "./resumo.js";
const usuario: UsuarioContexto = { id: 1, nome: "Consulta", email: "", papel: "consulta", status: "ATIVO", areas: ["pecuaria"], abas: [], flags: [], dono: false };
const inicio = new Date("2026-10-01");
const fim = new Date("2026-10-17");
beforeEach(() => { vi.clearAllMocks(); mocks.principal.mockResolvedValue(1); mocks.fontes.mockResolvedValue([]); });
describe("consulta gerencial", () => {
  it("inicia transação somente leitura e omite consultas e DTOs monetários sem permissão", async () => {
    const ordem: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async (_consulta: TemplateStringsArray) => { ordem.push("somente leitura"); }),
      propriedade: { findMany: vi.fn(async () => { ordem.push("sítios"); return [{ id: 1, nome: "Sítio" }]; }) },
      demandaAcompanhamentoReprodutivo: { count: vi.fn().mockResolvedValue(2) },
      compromissoFinanceiro: { findMany: vi.fn() },
    };
    mocks.transaction.mockImplementation(async (consulta: (conexao: typeof tx) => Promise<unknown>) => consulta(tx));
    const resultado = await obterResumoGerencial(usuario, 1, inicio, fim, fim);
    expect(tx.$executeRaw.mock.calls[0][0]).toEqual(["SET TRANSACTION READ ONLY"]);
    expect(ordem).toEqual(["somente leitura", "sítios"]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", timeout: 30000 });
    for (const bloco of [resultado.caixa, resultado.compromissos, resultado.estoque, resultado.nutricao, resultado.custos]) {
      expect(bloco).toEqual({ estado: "RESTRITO", motivo: expect.any(String) });
    }
    for (const consulta of [mocks.caixa, mocks.estoque, mocks.nutricao, mocks.fontes]) expect(consulta).not.toHaveBeenCalled();
    expect(tx.compromissoFinanceiro.findMany).not.toHaveBeenCalled();
    expect(resultado.clinico).toMatchObject({ estado: "DISPONIVEL", dados: { acompanhamentosPendentes: 2 } });
  });
  it("recusa acesso antes de iniciar consultas", async () => {
    await expect(obterResumoGerencial({ ...usuario, areas: [] }, null, inicio, fim)).rejects.toThrow("SEM_ACESSO_GERENCIAL");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.principal).not.toHaveBeenCalled();
  });

  it.each([3, null])("consulta todos os vencimentos pelo sítio %s na conexão do snapshot e usa hoje em São Paulo", async propriedadeId => {
    const ordem: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async () => { ordem.push("somente leitura"); }),
      propriedade: { findMany: vi.fn().mockResolvedValue([{ id: 3, nome: "Sítio" }]) },
      compromissoFinanceiro: { findMany: vi.fn(async () => {
        ordem.push("compromissos");
        return [
          { tipo: "PAGAR", status: "PENDENTE", valorOriginal: new Prisma.Decimal("1.01"), dataVencimento: new Date("2025-01-01"), liquidacoes: [] },
          { tipo: "PAGAR", status: "PENDENTE", valorOriginal: new Prisma.Decimal("2.02"), dataVencimento: new Date("2027-01-01"), liquidacoes: [] },
        ];
      }) },
    };
    mocks.transaction.mockImplementation(async (consulta: (conexao: typeof tx) => Promise<unknown>) => consulta(tx));
    const financeiro = { ...usuario, areas: ["financeiro"], abas: ["dashboard"], flags: ["verValores", "verSalarios", "verInvestimento"] };
    const resultado = await obterResumoGerencial(financeiro, propriedadeId, inicio, fim, new Date("2026-10-19T02:59:59Z"));
    expect(tx.compromissoFinanceiro.findMany).toHaveBeenCalledWith({
      where: { tipo: "PAGAR", status: { in: ["PENDENTE", "PARCIAL"] }, ...(propriedadeId == null ? {} : { operacao: { propriedadeId } }) },
      select: { tipo: true, status: true, dataVencimento: true, valorOriginal: true, liquidacoes: { select: { valor: true, transacao: { select: { status: true } } } } },
    });
    expect(ordem).toEqual(["somente leitura", "compromissos"]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", timeout: 30000 });
    expect(resultado.compromissos).toMatchObject({ estado: "DISPONIVEL", dados: { data: "2026-10-18", totalPendente: "3.03", vencido: "1.01", aVencer: "2.02" } });
  });

  it.each(["verValores", "verSalarios", "verInvestimento", "dashboard", "financeiro"])("omite obrigações e sua consulta sem %s", async permissao => {
    const tx = {
      $executeRaw: vi.fn(),
      propriedade: { findMany: vi.fn().mockResolvedValue([{ id: 1, nome: "Sítio" }]) },
      compromissoFinanceiro: { findMany: vi.fn() },
      demandaAcompanhamentoReprodutivo: { count: vi.fn().mockResolvedValue(0) },
    };
    mocks.transaction.mockImplementation(async (consulta: (conexao: typeof tx) => Promise<unknown>) => consulta(tx));
    const perfil = {
      ...usuario,
      areas: ["pecuaria", "financeiro"].filter(p => p !== permissao),
      abas: ["dashboard"].filter(p => p !== permissao),
      flags: ["verValores", "verSalarios", "verInvestimento"].filter(p => p !== permissao),
    };
    const resultado = await obterResumoGerencial(perfil, 1, inicio, fim, fim);
    expect(resultado.compromissos).toEqual({ estado: "RESTRITO", motivo: expect.any(String) });
    expect(tx.compromissoFinanceiro.findMany).not.toHaveBeenCalled();
  });
});
