import { beforeEach, describe, expect, it, vi } from "vitest";
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
beforeEach(() => { vi.clearAllMocks(); mocks.principal.mockResolvedValue(1); });
describe("consulta gerencial", () => {
  it("inicia transação somente leitura e omite consultas e DTOs monetários sem permissão", async () => {
    const ordem: string[] = [];
    const tx = {
      $executeRaw: vi.fn(async (_consulta: TemplateStringsArray) => { ordem.push("somente leitura"); }),
      propriedade: { findMany: vi.fn(async () => { ordem.push("sítios"); return [{ id: 1, nome: "Sítio" }]; }) },
      demandaAcompanhamentoReprodutivo: { count: vi.fn().mockResolvedValue(2) },
    };
    mocks.transaction.mockImplementation(async (consulta: (conexao: typeof tx) => Promise<unknown>) => consulta(tx));
    const resultado = await obterResumoGerencial(usuario, 1, inicio, fim, fim);
    expect(tx.$executeRaw.mock.calls[0][0]).toEqual(["SET TRANSACTION READ ONLY"]);
    expect(ordem).toEqual(["somente leitura", "sítios"]);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", timeout: 30000 });
    for (const bloco of [resultado.caixa, resultado.estoque, resultado.nutricao, resultado.custos]) {
      expect(bloco).toEqual({ estado: "RESTRITO", motivo: expect.any(String) });
    }
    for (const consulta of [mocks.caixa, mocks.estoque, mocks.nutricao, mocks.fontes]) expect(consulta).not.toHaveBeenCalled();
    expect(resultado.clinico).toMatchObject({ estado: "DISPONIVEL", dados: { acompanhamentosPendentes: 2 } });
  });
  it("recusa acesso antes de iniciar consultas", async () => {
    await expect(obterResumoGerencial({ ...usuario, areas: [] }, null, inicio, fim)).rejects.toThrow("SEM_ACESSO_GERENCIAL");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.principal).not.toHaveBeenCalled();
  });
});
