import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DestinoInternoLeiteInput } from "./destinos.schemas.js";
const mocks = vi.hoisted(() => ({
  requisicoes: new Map<string, Record<string, unknown>>(),
  tx: { $executeRaw: vi.fn(), propriedade: { findUnique: vi.fn() }, entradaProducaoLeite: { findFirst: vi.fn() },
    animal: { findMany: vi.fn(), count: vi.fn() }, criaParto: { findMany: vi.fn() }, partoAnimal: { findMany: vi.fn() },
    sessaoOrdenha: { findMany: vi.fn() },
    localizacaoAnimal: { findMany: vi.fn() },
    requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() },
    fornecimentoColostro: { findFirst: vi.fn(), findMany: vi.fn() }, parcelaDestinoLeite: { findFirst: vi.fn(), updateMany: vi.fn() },
    destinoInternoLeite: { create: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn() } },
  saldo: vi.fn(), baixar: vi.fn(), estornar: vi.fn(), travar: vi.fn(), animal: vi.fn(), cria: vi.fn(), registrarColostro: vi.fn(), corrigirColostro: vi.fn(), classificar: vi.fn(), classificacao: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: mocks.tx }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (executar: (tx: typeof mocks.tx) => Promise<unknown>) => executar(mocks.tx) }));
vi.mock("../../estoque/leite.js", () => ({ saldosOrigensLeiteTx: mocks.saldo, baixarLeiteTx: mocks.baixar, estornarBaixaLeiteTx: mocks.estornar, classificarEntradaLeiteTx: mocks.classificar, obterClassificacaoEntradaLeiteTx: mocks.classificacao }));
vi.mock("../../estoque/valorizacao.js", () => ({ travarValorizacaoTx: mocks.travar }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: mocks.animal }));
vi.mock("../reproducao/colostro.js", () => ({ conferirCriaTx: mocks.cria, registrarColostroTx: mocks.registrarColostro, corrigirColostroTx: mocks.corrigirColostro }));
import { registrarDestinoInterno, estornarDestinoInterno, listarCriasDestino, listarDestinatarios, listarOrigensDestino } from "./destinos.js";
import { RebanhoError } from "../rebanho/regras.js";
const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const base: DestinoInternoLeiteInput = { chave: uid(1), propriedadeId: 1, entradaId: uid(2), data: "2026-10-01", natureza: "LEITE_NAO_COMERCIAL",
  declaracaoOrigem: "Natureza do leite e uso informados pelo responsável", quantidadeDisponivelEsperadaLitros: 10,
  parcelas: [{ animalId: uid(3), quantidadeLitros: 3 }, { animalId: uid(4), quantidadeLitros: 4 }] };
type Fornecimento = { id: string; criaId: string; data: Date; quantidadeLitros: Prisma.Decimal; versao: number; status: string };
type Criacao = { chave: string; propriedadeId: number; entradaId: string; movimentoId: string; data: Date; natureza: string; declaracaoOrigem: string;
  quantidadeLitros: Prisma.Decimal; saldoOrigemAntes: Prisma.Decimal; saldoOrigemDepois: Prisma.Decimal; responsavel: string | null; observacao: string | null; criadoPorId: number | null;
  parcelas: { create: { animalId: string; quantidadeLitros: Prisma.Decimal; fornecimentoColostroId: string | null; criadoNoDestino: boolean }[] } };
const fornecimentos = new Map<string, Fornecimento>();
function montar(data: Criacao) {
  return { ...data, id: uid(90), status: "CONFIRMADO", versao: 1, criadoEm: dia("2026-10-01"), estornadoEm: null as Date | null,
    motivoEstorno: null as string | null, movimentoEstornoId: null as string | null,
    entrada: { sessaoId: uid(70), movimento: { produtoId: uid(80) } },
    parcelas: data.parcelas.create.map((p, indice) => ({ ...p, id: uid(100 + indice), ativo: true,
      animal: { brinco: String(indice + 1), nome: null }, fornecimentoColostro: p.fornecimentoColostroId ? fornecimentos.get(p.fornecimentoColostroId) ?? null : null })) };
}
let registro: ReturnType<typeof montar> | null;
function copiar() { return registro && { ...registro, parcelas: registro.parcelas.map(p => ({ ...p })) }; }
beforeEach(() => {
  vi.resetAllMocks(); mocks.requisicoes.clear(); fornecimentos.clear(); registro = null;
  mocks.tx.$executeRaw.mockResolvedValue(0); mocks.tx.propriedade.findUnique.mockResolvedValue({ id: 1, ativo: true });
  mocks.tx.requisicaoPecuaria.findUnique.mockImplementation(async ({ where }: { where: { chave: string } }) => mocks.requisicoes.get(where.chave) ?? null);
  mocks.tx.requisicaoPecuaria.create.mockImplementation(async ({ data }: { data: Record<string, unknown> & { chave: string } }) => { mocks.requisicoes.set(data.chave, data); return data; });
  mocks.tx.entradaProducaoLeite.findFirst.mockResolvedValue({ id: uid(2), movimento: { data: dia("2026-10-01"), produto: { id: uid(80), ativo: true, unidade: "L", rastrearPartidas: false } } });
  mocks.saldo.mockResolvedValue([{ entradaId: uid(2), quantidade: new Prisma.Decimal(10) }]);
  mocks.baixar.mockResolvedValue({ id: uid(50) }); mocks.estornar.mockResolvedValue({ id: uid(51) });
  mocks.classificacao.mockResolvedValue({ natureza: "NAO_INFORMADA" }); mocks.classificar.mockResolvedValue({ id: uid(600), natureza: "NAO_COMERCIAL" });
  mocks.animal.mockResolvedValue({ id: uid(3), sexo: "M" });
  mocks.tx.localizacaoAnimal.findMany.mockResolvedValue([{ id: uid(500), propriedadeId: 1 }]);
  mocks.tx.animal.findMany.mockResolvedValue([{ id: uid(3), brinco: "B3", nome: null, sexo: "M" }]); mocks.tx.animal.count.mockResolvedValue(1);
  mocks.tx.criaParto.findMany.mockResolvedValue([{ id: uid(13), animalId: uid(3), partoId: uid(30), viva: true }]);
  mocks.tx.partoAnimal.findMany.mockResolvedValue([{ id: uid(30) }]); mocks.tx.fornecimentoColostro.findMany.mockResolvedValue([]);
  mocks.tx.sessaoOrdenha.findMany.mockResolvedValue([{ id: uid(70), nome: "Manhã" }]);
  mocks.cria.mockImplementation(async (_tx: unknown, criaId: string) => ({ animalId: criaId === uid(13) ? uid(3) : uid(4) }));
  mocks.tx.parcelaDestinoLeite.findFirst.mockResolvedValue(null);
  mocks.tx.fornecimentoColostro.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => fornecimentos.get(where.id) ?? null);
  mocks.registrarColostro.mockImplementation(async (_tx: unknown, input: { criaId: string; quantidade: number }) => {
    const f = { id: uid(200 + fornecimentos.size), criaId: input.criaId, quantidadeLitros: new Prisma.Decimal(input.quantidade), data: dia("2026-10-01"), versao: 1, status: "VALIDO" };
    fornecimentos.set(f.id, f); return f;
  });
  mocks.tx.destinoInternoLeite.create.mockImplementation(async ({ data }: { data: Criacao }) => { registro = montar(data); return copiar(); });
  mocks.tx.destinoInternoLeite.findFirst.mockImplementation(async () => copiar());
  mocks.tx.destinoInternoLeite.findFirstOrThrow.mockImplementation(async () => copiar());
  mocks.tx.parcelaDestinoLeite.updateMany.mockImplementation(async () => { registro!.parcelas.forEach(p => { p.ativo = false; }); return { count: registro!.parcelas.length }; });
  mocks.tx.destinoInternoLeite.update.mockImplementation(async ({ data }: { data: { status: string; estornadoEm: Date; motivoEstorno: string; movimentoEstornoId: string } }) => {
    Object.assign(registro!, data, { versao: registro!.versao + 1 }); return copiar();
  });
});
describe("destino interno atômico e sua origem física", () => {
  it("origens retornam sítio resolvido e nome da ordenha, sem custos monetários", async () => {
    mocks.saldo.mockResolvedValue([{ entradaId: uid(2), entrada: { sessaoId: uid(70) }, data: "2026-10-01", quantidade: new Prisma.Decimal(10),
      natureza: "COLOSTRO", classificacaoId: uid(600) }]);
    const resposta = await listarOrigensDestino(1, uid(80), "2026-10-01");
    expect(resposta).toMatchObject({ propriedadeId: 1, itens: [{ nomeOrdenha: "Manhã", quantidadeDisponivelLitros: 10, natureza: "COLOSTRO" }] });
    expect(resposta.itens[0]).not.toHaveProperty("valorTotal");
  });
  it("declara restrição da origem inteira antes de consumir e conserva a sobra restrita", async () => {
    await registrarDestinoInterno(base, 7);
    expect(mocks.classificar).toHaveBeenCalledWith(mocks.tx, { entradaId: uid(2), natureza: "NAO_COMERCIAL", motivo: base.declaracaoOrigem }, { propriedadeId: 1, usuarioId: 7 });
    expect(mocks.classificar.mock.invocationCallOrder[0]).toBeLessThan(mocks.baixar.mock.invocationCallOrder[0]);
  });
  it("não chama leite comum de comercial e recusa fonte já declarada como colostro", async () => {
    const input = { ...base, natureza: "LEITE_COMUM" as const };
    mocks.classificacao.mockResolvedValue({ natureza: "COLOSTRO" });
    await expect(registrarDestinoInterno(input, 7)).rejects.toThrow(/origem está declarada como colostro/);
    expect(mocks.baixar).not.toHaveBeenCalled();
    mocks.classificacao.mockResolvedValue({ natureza: "NAO_COMERCIAL" });
    await registrarDestinoInterno(input, 7);
    expect(mocks.classificar).not.toHaveBeenCalled();
  });
  it("pickers históricos incluem machos e só oferecem cria e fornecimento comprovados", async () => {
    const candidatos = await listarDestinatarios(1, "2026-10-01", "B3", 2);
    expect(candidatos.itens).toMatchObject([{ animalId: uid(3), sexo: "M", criaId: uid(13) }]);
    expect(mocks.tx.animal.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10, skip: 10, where: expect.objectContaining({
      dataEntrada: { lte: dia("2026-10-01") }, localizacoes: expect.objectContaining({ some: expect.objectContaining({ propriedadeId: 1 }) }),
    }) }));
    mocks.tx.fornecimentoColostro.findMany.mockResolvedValue([{ id: uid(40), criaId: uid(13), data: dia("2026-10-01"), quantidadeLitros: new Prisma.Decimal(3) }]);
    const crias = await listarCriasDestino(1, "2026-10-01");
    expect(crias.itens).toMatchObject([{ animalId: uid(3), criaId: uid(13), fornecimentos: [{ id: uid(40), quantidadeLitros: 3 }] }]);
    expect(mocks.tx.fornecimentoColostro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ propriedadeId: 1,
      status: "VALIDO", data: dia("2026-10-01"), parcelasDestinoLeite: { none: { ativo: true } },
    }) }));
    expect(mocks.baixar).not.toHaveBeenCalled();
  });
  it("serve 3+4 L da origem10, mantém3 L e reenvio não duplica saída/parcelas", async () => {
    const dto = await registrarDestinoInterno(base, 7);
    expect(dto).toMatchObject({ quantidadeLitros: 7, saldoOrigemAntes: 10, saldoOrigemDepois: 3, natureza: "LEITE_NAO_COMERCIAL" });
    expect(dto.parcelas.map(p => p.quantidadeLitros)).toEqual([3, 4]);
    expect(mocks.baixar).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ origem: "NUTRICAO", entradaIds: [uid(2)], quantidade: new Prisma.Decimal(7) }));
    expect(mocks.registrarColostro).not.toHaveBeenCalled();
    expect(await registrarDestinoInterno(base, 7)).toEqual(dto);
    expect(mocks.baixar).toHaveBeenCalledTimes(1); expect(mocks.tx.destinoInternoLeite.create).toHaveBeenCalledTimes(1);
    await expect(registrarDestinoInterno({ ...base, natureza: "LEITE_COMUM" }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("recusa saldo alterado, origem inexistente e destinatário fora da data/sítio antes da saída", async () => {
    mocks.saldo.mockResolvedValue([{ entradaId: uid(2), quantidade: new Prisma.Decimal(9) }]);
    await expect(registrarDestinoInterno(base, 7)).rejects.toMatchObject({ campo: "quantidadeDisponivelEsperadaLitros" });
    mocks.tx.entradaProducaoLeite.findFirst.mockResolvedValue(null);
    await expect(registrarDestinoInterno(base, 7)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.baixar).not.toHaveBeenCalled();
  });
  it("não permite destinatário fora do sítio/data ou com localização sobreposta", async () => {
    mocks.animal.mockRejectedValueOnce(new RebanhoError("VALIDACAO", "Animal não estava no sítio na data"));
    await expect(registrarDestinoInterno(base, 7)).rejects.toThrow(/sítio/);
    mocks.tx.localizacaoAnimal.findMany.mockResolvedValue([{ id: uid(500), propriedadeId: 1 }, { id: uid(501), propriedadeId: 2 }]);
    await expect(registrarDestinoInterno({ ...base, chave: uid(8) }, 7)).rejects.toThrow(/localização histórica/);
    expect(mocks.baixar).not.toHaveBeenCalled();
  });
  it("colostro cria um fornecimento por cria real sem pressupor parto ou qualidade", async () => {
    const dto = await registrarDestinoInterno({ ...base, natureza: "COLOSTRO", parcelas: base.parcelas.map((p, i) => ({ ...p, criaId: uid(13 + i) })) }, 7);
    expect(mocks.registrarColostro).toHaveBeenCalledTimes(2);
    expect(dto.parcelas.every(p => p.criadoNoDestino && p.fornecimentoColostroId)).toBe(true);
    expect(mocks.registrarColostro.mock.calls[0][1]).toMatchObject({ criaId: uid(13), quantidade: 3, unidade: "L" });
    expect(mocks.registrarColostro.mock.calls[0][1]).not.toHaveProperty("metodoQualidade");
    expect(mocks.baixar).toHaveBeenCalledTimes(1);
  });
  it("vincula fornecimento existente compatível sem recriar e recusa vínculo duplicado", async () => {
    const f = { id: uid(40), criaId: uid(13), data: dia("2026-10-01"), quantidadeLitros: new Prisma.Decimal(3), versao: 1, status: "VALIDO" };
    fornecimentos.set(f.id, f);
    const input = { ...base, natureza: "COLOSTRO" as const, parcelas: [{ animalId: uid(3), criaId: uid(13), quantidadeLitros: 3, fornecimentoColostroId: f.id }] };
    const dto = await registrarDestinoInterno(input, 7);
    expect(dto.parcelas[0]).toMatchObject({ fornecimentoColostroId: f.id, criadoNoDestino: false });
    expect(mocks.registrarColostro).not.toHaveBeenCalled();
    fornecimentos.set(f.id, { ...f, quantidadeLitros: new Prisma.Decimal(2) });
    await expect(registrarDestinoInterno({ ...input, chave: uid(9) }, 7)).rejects.toThrow(/corresponder/);
    fornecimentos.set(f.id, f);
    mocks.tx.parcelaDestinoLeite.findFirst.mockResolvedValue({ id: uid(60) });
    await expect(registrarDestinoInterno({ ...input, chave: uid(8) }, 7)).rejects.toThrow(/origem de estoque ativa/);
    expect(mocks.baixar).toHaveBeenCalledTimes(1);
  });
  it("cria inexistente, quantidade clínica divergente e futuro não geram consumo", async () => {
    mocks.cria.mockRejectedValue(new RebanhoError("VALIDACAO", "Cria não cadastrada"));
    await expect(registrarDestinoInterno({ ...base, natureza: "COLOSTRO", parcelas: [{ animalId: uid(3), criaId: uid(13), quantidadeLitros: 3 }] }, 7)).rejects.toThrow(/Cria/);
    await expect(registrarDestinoInterno({ ...base, data: "2099-01-01" }, 7)).rejects.toMatchObject({ campo: "data" });
    expect(mocks.baixar).not.toHaveBeenCalled(); expect(mocks.registrarColostro).not.toHaveBeenCalled();
  });
  it("estorno é único, conserva parcelas e anula só colostro criado pelo destino", async () => {
    const dto = await registrarDestinoInterno({ ...base, natureza: "COLOSTRO", parcelas: [{ animalId: uid(3), criaId: uid(13), quantidadeLitros: 3 }] }, 7);
    const input = { chave: uid(5), propriedadeId: 1, versaoEsperada: 1, motivo: "Fornecimento lançado indevidamente" };
    const estornado = await estornarDestinoInterno(dto.id, input, 7);
    expect(estornado).toMatchObject({ status: "ESTORNADO", versao: 2, movimentoEstornoId: uid(51) });
    expect(estornado.parcelas[0].ativo).toBe(false);
    expect(mocks.corrigirColostro).toHaveBeenCalledWith(mocks.tx, dto.parcelas[0].fornecimentoColostroId, expect.objectContaining({ anular: true, versaoEsperada: 1 }), 7);
    expect(await estornarDestinoInterno(dto.id, input, 7)).toEqual(estornado);
    expect(mocks.estornar).toHaveBeenCalledTimes(1);
    expect(mocks.tx.parcelaDestinoLeite.updateMany.mock.invocationCallOrder[0]).toBeLessThan(mocks.corrigirColostro.mock.invocationCallOrder[0]);
  });
  it("estornar vínculo anterior não anula o fato clínico independente", async () => {
    fornecimentos.set(uid(40), { id: uid(40), criaId: uid(13), data: dia("2026-10-01"), quantidadeLitros: new Prisma.Decimal(3), versao: 2, status: "VALIDO" });
    const dto = await registrarDestinoInterno({ ...base, natureza: "COLOSTRO", parcelas: [{ animalId: uid(3), criaId: uid(13), quantidadeLitros: 3, fornecimentoColostroId: uid(40) }] }, 7);
    await expect(estornarDestinoInterno(dto.id, { chave: uid(5), propriedadeId: 1, versaoEsperada: 9, motivo: "Estorno indevido" }, 7)).rejects.toMatchObject({ campo: "versaoEsperada" });
    expect(mocks.estornar).not.toHaveBeenCalled();
    await estornarDestinoInterno(dto.id, { chave: uid(6), propriedadeId: 1, versaoEsperada: 1, motivo: "Corrigir somente a origem física" }, 7);
    expect(mocks.corrigirColostro).not.toHaveBeenCalled();
  });
});
