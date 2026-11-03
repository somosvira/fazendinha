import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reqs: new Map<string, Record<string, unknown>>(), tx: { $executeRaw: vi.fn(), $queryRaw: vi.fn(), propriedade: { findUnique: vi.fn() }, requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() }, classificacaoEntradaLeite: { findFirst: vi.fn() }, entradaProducaoLeite: { findFirst: vi.fn() }, retiradaInternaLeite: { create: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn() } }, saldo: vi.fn(), baixar: vi.fn(), estornar: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: m.tx }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (f: (tx: typeof m.tx) => Promise<unknown>) => f(m.tx) }));
vi.mock("../../estoque/leite.js", () => ({ saldosOrigensLeiteTx: m.saldo, baixarLeiteTx: m.baixar, estornarBaixaLeiteTx: m.estornar }));
vi.mock("../../estoque/valorizacao.js", () => ({ travarValorizacaoTx: vi.fn() }));
import { registrarRetiradaInternaLeite, estornarRetiradaInternaLeite } from "./retiradas-internas.js";
import { FinanceiroError } from "../../financeiro/regras.js";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { chave: id(1), propriedadeId: 7, entradaId: id(2), data: "2026-10-01", quantidadeLitros: 3, quantidadeDisponivelEsperadaLitros: 10, motivo: "Retirada informada pelo responsável", destino: "CASA" as const, responsavel: "Responsável da casa" };
let registro: Record<string, unknown> | null;
beforeEach(() => {
  vi.resetAllMocks(); m.reqs.clear(); registro = null;
  m.tx.requisicaoPecuaria.findUnique.mockImplementation(async ({ where }: { where: { chave: string } }) => m.reqs.get(where.chave) ?? null);
  m.tx.requisicaoPecuaria.create.mockImplementation(async ({ data }: { data: Record<string, unknown> & { chave: string } }) => { m.reqs.set(data.chave, data); return data; });
  m.tx.propriedade.findUnique.mockResolvedValue({ id: 7, ativo: true });
  m.tx.entradaProducaoLeite.findFirst.mockResolvedValue({ id: input.entradaId, movimento: { produtoId: id(3), data: new Date(input.data) } });
  m.tx.classificacaoEntradaLeite.findFirst.mockResolvedValue({natureza:"COMERCIAL"});
  m.saldo.mockResolvedValue([{ entradaId: input.entradaId, quantidade: new Prisma.Decimal(10) }]); m.baixar.mockResolvedValue({ id: id(4) }); m.estornar.mockResolvedValue({ id: id(5) });
  m.tx.retiradaInternaLeite.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { registro = { ...data, id: id(9), status: "CONFIRMADO", versao: 1, criadoEm: new Date(input.data), estornadoEm: null, motivoEstorno: null, entrada: { sessao: { nome: "Manhã" }, movimento: { produtoId: id(3), produto: { nome: "Leite" } } } }; return registro; });
  m.tx.retiradaInternaLeite.findFirst.mockImplementation(async () => registro); m.tx.retiradaInternaLeite.findFirstOrThrow.mockImplementation(async () => registro);
  m.tx.retiradaInternaLeite.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(registro!, data, { versao: Number(registro!.versao) + 1 }); return registro; });
});
describe("retirada interna rastreada", () => {
  it("10L menos descarte3 deixa7, saída única sem destinatário/caixa e reenvio não duplica", async () => {
    const dto = await registrarRetiradaInternaLeite(input, 5);
    expect(dto).toMatchObject({ quantidadeLitros: 3, saldoOrigemAntes: 10, saldoOrigemDepois: 7, status: "CONFIRMADO" });
    expect(m.baixar).toHaveBeenCalledWith(m.tx, expect.objectContaining({ origem: "NUTRICAO", quantidade: 3, entradaIds: [input.entradaId], propriedadeId: 7, usuarioId: 5 }));
    expect(dto).not.toHaveProperty("parcelas"); expect(dto).not.toHaveProperty("valorTotal");
    expect(await registrarRetiradaInternaLeite(input, 5)).toEqual(dto); expect(m.baixar).toHaveBeenCalledTimes(1);
    await expect(registrarRetiradaInternaLeite({ ...input, quantidadeLitros: 4 }, 5)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("saldo alterado, origem errada e data anterior não baixam", async () => {
    m.saldo.mockResolvedValueOnce([{ entradaId: input.entradaId, quantidade: new Prisma.Decimal(9) }]);
    await expect(registrarRetiradaInternaLeite(input, 5)).rejects.toMatchObject({ code: "CONFLITO" });
    m.tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce(null);
    await expect(registrarRetiradaInternaLeite(input, 5)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    await expect(registrarRetiradaInternaLeite({ ...input, data: "2026-09-30" }, 5)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(m.baixar).not.toHaveBeenCalled(); expect(m.tx.retiradaInternaLeite.create).not.toHaveBeenCalled();
  });
  it("respeita bloqueio do período no motor antes de gravar fato e estorno exige versão", async () => {
    m.baixar.mockRejectedValueOnce(new FinanceiroError("PERIODO_FECHADO", "Período fechado"));
    await expect(registrarRetiradaInternaLeite(input, 5)).rejects.toThrow("Período fechado"); expect(m.tx.retiradaInternaLeite.create).not.toHaveBeenCalled();
    const dto = await registrarRetiradaInternaLeite(input, 5);
    await expect(estornarRetiradaInternaLeite(dto.id, { chave: id(20), propriedadeId: 7, versaoEsperada: 2, motivo: "Quantidade informada equivocadamente" }, 5)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(m.estornar).not.toHaveBeenCalled();
  });
  it("estorno preserva fato e inverso com autor/motivo, retry não devolve litros duas vezes", async () => {
    const dto = await registrarRetiradaInternaLeite(input, 5);
    const pedido = { chave: id(20), propriedadeId: 7, versaoEsperada: 1, motivo: "Quantidade informada equivocadamente" };
    expect(await estornarRetiradaInternaLeite(dto.id, pedido, 5)).toMatchObject({ status: "ESTORNADO", versao: 2, motivoEstorno: pedido.motivo });
    await estornarRetiradaInternaLeite(dto.id, pedido, 5); expect(m.estornar).toHaveBeenCalledTimes(1);
    expect(m.tx.retiradaInternaLeite.update).toHaveBeenCalledWith({ where: { id: dto.id }, data: expect.objectContaining({ movimentoEstornoId: id(5), estornadoPorId: 5, motivoEstorno: pedido.motivo }) });
  });
});

it("recusa retirar para pessoas quando a natureza da origem não é comercial",async()=>{m.tx.classificacaoEntradaLeite.findFirst.mockResolvedValue({natureza:"NAO_COMERCIAL"});await expect(registrarRetiradaInternaLeite(input,5)).rejects.toMatchObject({code:"VALIDACAO"});expect(m.baixar).not.toHaveBeenCalled()});
