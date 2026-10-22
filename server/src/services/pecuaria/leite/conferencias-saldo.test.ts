import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reqs: new Map<string, Record<string, unknown>>(), tx: { $executeRaw: vi.fn(), propriedade: { findUnique: vi.fn() }, produto: { findFirst: vi.fn() }, requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() }, conferenciaSaldoLeite: { findFirst: vi.fn(), create: vi.fn(), findFirstOrThrow: vi.fn() } } }));
vi.mock("../../../db.js", () => ({ prisma: m.tx }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (f: (tx: typeof m.tx) => Promise<unknown>) => f(m.tx) }));
import { registrarConferenciaSaldoLeite } from "./conferencias-saldo.js";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { chave: id(1), propriedadeId: 7, produtoId: id(2), data: "2026-10-01", litrosObservados: 0, referencia: "Régua do tanque ao final do dia", responsavel: "Responsável presente", versaoEsperada: 0 };
const historico: Record<string, unknown>[] = [];
beforeEach(() => { vi.resetAllMocks(); m.reqs.clear(); historico.length = 0;
  m.tx.requisicaoPecuaria.findUnique.mockImplementation(async ({ where }: { where: { chave: string } }) => m.reqs.get(where.chave) ?? null);
  m.tx.requisicaoPecuaria.create.mockImplementation(async ({ data }: { data: Record<string, unknown> & { chave: string } }) => { m.reqs.set(data.chave, data); return data; });
  m.tx.propriedade.findUnique.mockResolvedValue({ id: 7, ativo: true }); m.tx.produto.findFirst.mockResolvedValue({ id: id(2), unidade: "L" });
  m.tx.conferenciaSaldoLeite.findFirst.mockImplementation(async () => historico.at(-1) ?? null);
  m.tx.conferenciaSaldoLeite.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { const c = { ...data, id: id(historico.length + 10), criadoEm: new Date(input.data), motivoCorrecao: data.motivoCorrecao ?? null, produto: { nome: "Leite" } }; historico.push(c); return c; });
  m.tx.conferenciaSaldoLeite.findFirstOrThrow.mockImplementation(async ({ where }: { where: { id: string } }) => historico.find(c => c.id === where.id));
});
describe("conferência física independente do estoque", () => {
  it("aceita zero observado com referência/responsável e retry não cria outra versão", async () => {
    const c = await registrarConferenciaSaldoLeite(input, 5);
    expect(c).toMatchObject({ litrosObservados: 0, versao: 1, responsavel: input.responsavel });
    expect(m.tx.conferenciaSaldoLeite.create.mock.calls[0][0].data.litrosObservados).toEqual(new Prisma.Decimal(0));
    expect(await registrarConferenciaSaldoLeite(input, 5)).toEqual(c); expect(historico).toHaveLength(1);
    expect(m.tx).not.toHaveProperty("movimentoEstoque");
  });
  it("correção cria versão com motivo e conserva o observado anterior, sem alterar razão", async () => {
    await registrarConferenciaSaldoLeite(input, 5);
    const corrigida = await registrarConferenciaSaldoLeite({ ...input, chave: id(3), versaoEsperada: 1, litrosObservados: 10, motivoCorrecao: "Leitura anterior atribuída ao tanque errado" }, 5);
    expect(corrigida).toMatchObject({ versao: 2, litrosObservados: 10 }); expect(historico).toHaveLength(2); expect(historico[0].litrosObservados).toEqual(new Prisma.Decimal(0));
    await expect(registrarConferenciaSaldoLeite({ ...input, chave: id(4), versaoEsperada: 1, litrosObservados: 9, motivoCorrecao: "Outra correção concorrente" }, 5)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(registrarConferenciaSaldoLeite({ ...input, chave: id(5), versaoEsperada: 2 }, 5)).rejects.toThrow();
  });
  it("produto sem unidade adequada ou observação futura não grava", async () => {
    m.tx.produto.findFirst.mockResolvedValueOnce(null); await expect(registrarConferenciaSaldoLeite(input, 5)).rejects.toMatchObject({ code: "VALIDACAO" });
    await expect(registrarConferenciaSaldoLeite({ ...input, data: "2099-01-01" }, 5)).rejects.toMatchObject({ code: "VALIDACAO" }); expect(historico).toHaveLength(0);
  });
});
