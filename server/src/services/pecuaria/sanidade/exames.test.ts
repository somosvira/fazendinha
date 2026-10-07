import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    tipoExame: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    exameAnimal: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditoriaPecuaria: { findMany: vi.fn(), count: vi.fn() },
    $executeRaw: vi.fn(),
  }, auditar: vi.fn(), travar: vi.fn(), conferir: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: { ...mocks.tx, $transaction: async (operacao: ((tx: typeof mocks.tx) => unknown) | Promise<unknown>[]) =>
  Array.isArray(operacao) ? Promise.all(operacao) : operacao(mocks.tx) } }));
vi.mock("../rebanho/regras.js", async (original) => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: mocks.auditar, travarAnimais: mocks.travar }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: mocks.conferir }));

import { corrigirExame, editarTipoExame, listarTiposExame, obterHistoricoExame, registrarExame } from "./exames.js";
import { ocultarCustosDetalhe } from "./detalhes.js";

const tipo = { id: "tipo", nome: "Exame", tipoResultado: "NUMERO", unidade: "mg", opcoes: null, ativo: true };
const coleta = { animalId: "animal", propriedadeId: 2, tipoExameId: tipo.id, data: "2026-09-01" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.tipoExame.findUnique.mockResolvedValue(tipo);
  mocks.tx.tipoExame.findFirst.mockResolvedValue(tipo);
  mocks.tx.tipoExame.update.mockImplementation(async ({ data }) => ({ ...tipo, ...data }));
});

describe("integridade de exames", () => {
  it.each([
    { tipoResultado: "TEXTO" as const }, { unidade: "g" }, { opcoes: ["Baixo"] },
  ])("bloqueia alteração de formato após coleta pendente ou anulada: %j", async (input) => {
    mocks.tx.exameAnimal.findFirst.mockResolvedValue({ id: "exame" });
    await expect(editarTipoExame(tipo.id, input, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.tx.exameAnimal.findFirst).toHaveBeenCalledWith({ where: { tipoExameId: tipo.id }, select: { id: true } });
    expect(mocks.tx.tipoExame.update).not.toHaveBeenCalled();
    expect(mocks.auditar).not.toHaveBeenCalled();
  });

  it("permite renomear e inativar mantendo formato bloqueado", async () => {
    mocks.tx.exameAnimal.findFirst.mockResolvedValue({ id: "anulado" });
    expect(await editarTipoExame(tipo.id, { nome: "Exame revisado", ativo: false, unidade: " mg " }, 7)).toMatchObject({ nome: "Exame revisado", ativo: false, formatoBloqueado: true });
    expect(mocks.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.tipoExame.findUnique.mock.invocationCallOrder[0]);
    expect(mocks.tx.$executeRaw.mock.calls[1][0].join("")).toContain("NOT (\"formatoSnapshot\" ? 'nome')");
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ entidade: "TipoExame", antes: tipo }));
  });

  it("lista bloqueio sem filtrar resultados ou status e sem devolver contagem interna", async () => {
    mocks.tx.tipoExame.findMany.mockResolvedValue([{ ...tipo, _count: { exames: 1 } }, { ...tipo, id: "novo", _count: { exames: 0 } }]);
    expect(await listarTiposExame()).toEqual([{ ...tipo, formatoBloqueado: true }, { ...tipo, id: "novo", formatoBloqueado: false }]);
  });

  it("aceita zero na coleta e preserva snapshot após adquirir a trava do tipo", async () => {
    mocks.tx.exameAnimal.create.mockImplementation(async ({ data }) => ({ id: "e", ...data }));
    const resultado = await registrarExame({ ...coleta, resultadoNumero: 0 }, 7);
    expect(resultado).toMatchObject({ resultadoNumero: 0, formatoSnapshot: { nome: "Exame", tipoResultado: "NUMERO", unidade: "mg", opcoes: null } });
    expect(mocks.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(mocks.tx.tipoExame.findFirst.mock.invocationCallOrder[0]);
    await editarTipoExame(tipo.id, { nome: "Atualizado" }, 7);
    expect(mocks.tx.$executeRaw.mock.calls[0]).toEqual(mocks.tx.$executeRaw.mock.calls[1]);
  });

  it("relê o fato após trava e recusa corrigir exame anulado durante espera", async () => {
    mocks.tx.exameAnimal.findFirst.mockResolvedValueOnce({ animalId: "animal" }).mockResolvedValueOnce(null);
    await expect(corrigirExame("e", 2, { resultadoNumero: 0, motivo: "Revisão do laboratório" }, 7)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.tx.exameAnimal.findFirst.mock.invocationCallOrder[1]).toBeGreaterThan(mocks.travar.mock.invocationCallOrder[0]);
    expect(mocks.tx.exameAnimal.update).not.toHaveBeenCalled();
  });

  it("correção com zero audita o resultado anterior relido", async () => {
    const anterior = { id: "e", animalId: "animal", resultadoNumero: 10, formatoSnapshot: { tipoResultado: "NUMERO" } };
    mocks.tx.exameAnimal.findFirst.mockResolvedValueOnce({ animalId: "animal" }).mockResolvedValueOnce(anterior);
    mocks.tx.exameAnimal.update.mockResolvedValue({ ...anterior, resultadoNumero: 0 });
    await corrigirExame("e", 2, { resultadoNumero: 0, motivo: "Revisão do laboratório" }, 7);
    expect(mocks.auditar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ antes: anterior, depois: expect.objectContaining({ resultadoNumero: 0, motivo: "Revisão do laboratório" }) }));
  });
});

describe("histórico de exame", () => {
  it("consulta uma página da auditoria existente, mantendo antes/depois e motivo sem inventar autor", async () => {
    mocks.tx.exameAnimal.findFirst.mockResolvedValue({ id: "e" });
    const em = new Date("2026-09-01T12:30:00Z");
    const antes = { resultadoNumero: "3.1", valorServicoAtribuido: "150.00" };
    const depois = { resultadoNumero: "0", motivo: "Conferido no laudo", valorServicoAtribuido: "150.00" };
    mocks.tx.auditoriaPecuaria.findMany.mockResolvedValue([{ id: "a", acao: "RESULTADO_CORRIGIDO", em, criadoEm: em, usuarioId: null, usuario: null, antes, depois }]);
    mocks.tx.auditoriaPecuaria.count.mockResolvedValue(3);
    const historico = await obterHistoricoExame("e", [2], 2, 1);
    expect(historico).toEqual({ exameId: "e", pagina: 2, tamanho: 1, total: 3, itens: [{ id: "a", acao: "RESULTADO_CORRIGIDO", em: em.toISOString(), criadoEm: em.toISOString(), usuarioId: null, autor: null, motivo: "Conferido no laudo", antes, depois }] });
    expect(mocks.tx.auditoriaPecuaria.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 1, take: 1, orderBy: [{ em: "desc" }, { id: "desc" }] }));
    expect(ocultarCustosDetalhe(historico)).toMatchObject({ itens: [{ antes: { resultadoNumero: "3.1", valorServicoAtribuido: null }, depois: { resultadoNumero: "0", valorServicoAtribuido: null } }] });
  });

  it("escopo vazio nega acesso antes de consultar auditoria", async () => {
    mocks.tx.exameAnimal.findFirst.mockResolvedValue(null);
    await expect(obterHistoricoExame("e", [])).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.tx.exameAnimal.findFirst).toHaveBeenCalledWith({ where: { id: "e", propriedadeId: { in: [] } }, select: { id: true } });
    expect(mocks.tx.auditoriaPecuaria.findMany).not.toHaveBeenCalled();
  });

  it.each([[0, 20], [1, 101], [1.5, 20]])("rejeita paginação inválida %s/%s", async (pagina, tamanho) => {
    await expect(obterHistoricoExame("e", undefined, pagina, tamanho)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(mocks.tx.exameAnimal.findFirst).not.toHaveBeenCalled();
  });
});
