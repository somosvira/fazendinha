import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ tx: {} as Record<string, unknown>, transacao: vi.fn(), baixar: vi.fn(), saldos: vi.fn(), confirmar: vi.fn(), salvar: vi.fn(), auditar: vi.fn(), cria: vi.fn(), registrar: vi.fn(), valores: vi.fn(), consumir: vi.fn(), vincular: vi.fn(), corrigir: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: f.transacao }));
vi.mock("../rebanho/regras.js", async importar => ({ ...await importar<typeof import("../rebanho/regras.js")>(), auditar: f.auditar, travarAnimais: vi.fn() }));
vi.mock("../reproducao/colostro.js", () => ({ conferirCriaTx: f.cria, registrarColostroTx: f.registrar, corrigirColostroTx: f.corrigir }));
vi.mock("../consumo.js", () => ({ consumirEstoqueTx: f.consumir }));
vi.mock("./acompanhamento.js", () => ({ vincularFornecimentoColostragemTx: f.vincular }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn() }));
vi.mock("../leite/configuracoes.js", () => ({ conferirSitioLeiteTx: vi.fn() }));
vi.mock("../leite/tanques.js", () => ({ salvarParcelasTx: f.salvar }));
vi.mock("../leite/estoque.js", () => ({ confirmarProducaoGeralTx: f.confirmar }));
vi.mock("../../estoque/leite.js", () => ({ baixarLeiteTx: f.baixar, saldosOrigensLeiteTx: f.saldos, classificarEntradaLeiteTx: vi.fn(), estornarBaixaLeiteTx: vi.fn(), valoresMovimentosLeiteTx: f.valores }));
vi.mock("../../estoque/valorizacao.js", () => ({ travarValorizacaoTx: vi.fn(), registrarInversoValorizadoTx: vi.fn() }));
import { consultarOrigemColostro, consultarCustosColostroTx, confirmarRetiradaColostro, destinarColostro, enriquecerColostro, registrarRetiradaColostro, estornarRetiradaColostro, estornarDestinacaoColostro, listarFornecimentosColostro, listarProducoesRetiradaColostro } from "./colostro.js";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const data = new Date("2026-10-20T00:00:00Z");
const D = (v: number | string) => new Prisma.Decimal(v);
function origem(enriquecida = false, brix?: string) {
  return { id: id(1), propriedadeId: 7, versao: 3, status: "CONFIRMADO", quantidadeLitros: D("2.2"), valorTotal: D("11.00"),
    loteColostroId: enriquecida ? null : id(2), preparoId: enriquecida ? id(3) : null,
    loteColostro: enriquecida ? null : { id: id(2), data, ocorridoEm: null, matrizId: id(4), partoId: id(5), entradaId: id(6), entrada: { movimentoId: id(21) }, origemFisicaSnapshot: { recipiente: "Recipiente real" } },
    preparo: enriquecida ? { id: id(3), data, ocorridoEm: null, origens: [], insumos: [{ movimento: { valorTotal: D(11) } }] } : null,
    unidades: [], fornecimentos: [], preparos: [], amostras: brix ? [{ id: id(20), data, formatoSnapshot: { politicaBrix: { campo: "BRIX", limiteInclusivo: "25", configuracaoId: null, versaoConfiguracao: 0 } }, resultados: [{ campo: "BRIX", valor: brix }] }] : [], criadoEm: data, criadoPorId: 9 };
}
function banco() {
  return { $executeRaw: vi.fn(async () => 1), $queryRaw: vi.fn(async () => []),
    requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, periodoFinanceiro: { findUnique: vi.fn() },
    alocacaoFornecimentoColostro: { findFirst: vi.fn(), updateMany:vi.fn(), findMany: vi.fn(async (_args: unknown) => []), create: vi.fn() }, origemPreparoColostro: { findMany: vi.fn(async (_args: unknown) => []), create: vi.fn() },
    origemColostro: { findFirst: vi.fn(async (_args: unknown) => origem()), update: vi.fn(), create: vi.fn() },
    loteColostro: { findFirstOrThrow:vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    entradaProducaoLeite: { findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(async () => []) },
    medicaoGeralLeite: { findMany:vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn() },
    criaParto: { findMany: vi.fn(async () => []) }, partoAnimal: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
    destinacaoColostro: { findMany: vi.fn(async () => []), findUniqueOrThrow:vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() }, unidadeBancoColostro: { findMany: vi.fn(async () => []), updateMany:vi.fn(), create: vi.fn(), update: vi.fn() },
    fornecimentoColostro:{count:vi.fn(),findMany:vi.fn(),findFirst:vi.fn()}, parcelaDestinoLeite:{findFirst:vi.fn()},
    insumoPreparoColostro: { create: vi.fn() }, preparoColostro: { findMany: vi.fn(async () => []), create: vi.fn(), findFirst: vi.fn() }, produto: { findFirst: vi.fn() },
  };
}
let tx: ReturnType<typeof banco>;
beforeEach(() => {
  vi.clearAllMocks(); f.valores.mockResolvedValue(new Map()); tx = banco(); f.tx = tx;
  f.transacao.mockImplementation((executar: (tx: unknown) => unknown) => executar(tx));
  const requisicoes = new Map<string, unknown>();
  tx.requisicaoPecuaria.findUnique.mockImplementation(async ({ where }) => requisicoes.get(where.chave) ?? null);
  tx.requisicaoPecuaria.create.mockImplementation(async ({ data }) => { requisicoes.set(data.chave, data); return data; });
});
describe("serviços colostro: fronteiras e atomicidade", () => {
  it.each([
    { caso: "bruto para cria", enriquecida: false, unidade: false, congelamento: false },
    { caso: "enriquecido para cria", enriquecida: true, unidade: false, congelamento: false },
    { caso: "unidade bruta", enriquecida: false, unidade: true, congelamento: false },
    { caso: "unidade enriquecida", enriquecida: true, unidade: true, congelamento: false },
    { caso: "congelamento bruto", enriquecida: false, unidade: false, congelamento: true },
    { caso: "congelamento enriquecido", enriquecida: true, unidade: false, congelamento: true },
  ])("recusa período fechado antes de qualquer escrita: $caso", async ({ enriquecida, unidade, congelamento }) => {
    tx.origemColostro.findFirst.mockResolvedValue({ ...origem(enriquecida, "27"), unidades: unidade ? [{ id: id(70), propriedadeId: 7,
      volumeLitros: D(2), status: "CONGELADA", versao: 1, dataCongelamento: data, dataRetirada: null }] : [] } as never);
    tx.entradaProducaoLeite.findFirst.mockResolvedValue({ movimento: { produtoId: id(8) } });
    tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValue({ id: id(6), movimento: { produtoId: id(8) } });
    f.saldos.mockResolvedValue([{ entradaId: id(6), quantidade: D('2.2'), natureza: 'COLOSTRO' }]);
    f.cria.mockResolvedValue({ animalId: id(4) }); f.registrar.mockResolvedValue({ id: id(10) }); f.baixar.mockResolvedValue({ id: id(12) });
    tx.destinacaoColostro.create.mockResolvedValue({ id: id(11) });
    tx.destinacaoColostro.findFirst.mockResolvedValue({ id: id(11), origemId: id(1), data, ocorridoEm: null, versao: 1,
      status: "CONFIRMADO", snapshot: {}, alocacoes: [], unidades: [] });
    const comando = { chave: id(9), propriedadeId: 7, versaoEsperada: 3, data: "2026-10-20", horarioEstimado: false,
      ...(unidade ? { unidadeId: id(70) } : {}), crias: congelamento ? [] : [{ criaId: id(14), quantidadeLitros: 1, tipo: "FRESCO" as const }],
      unidades: congelamento ? [{ codigo: "U-001" }] : [], responsavel: "Operador" };
    tx.periodoFinanceiro.findUnique.mockResolvedValue({ status: "FECHADO" });
    await expect(destinarColostro(id(1), comando, 9)).rejects.toMatchObject({ code: "PERIODO_FECHADO" });
    expect(tx.periodoFinanceiro.findUnique).toHaveBeenCalledWith({ where: { propriedadeId_ano_mes: { propriedadeId: 7, ano: 2026, mes: 10 } } });
    for (const gravar of [tx.destinacaoColostro.create, tx.destinacaoColostro.update, tx.alocacaoFornecimentoColostro.create,
      tx.unidadeBancoColostro.create, tx.unidadeBancoColostro.update, tx.origemColostro.update, tx.requisicaoPecuaria.create,
      f.baixar, f.registrar, f.vincular, f.auditar]) expect(gravar).not.toHaveBeenCalled();
    tx.periodoFinanceiro.findUnique.mockResolvedValue({ status: "ABERTO" });
    await expect(destinarColostro(id(1), comando, 9)).resolves.toMatchObject({ status: "CONFIRMADO" });
    expect(tx.destinacaoColostro.create).toHaveBeenCalledTimes(1);
    expect(tx.periodoFinanceiro.findUnique).toHaveBeenCalledTimes(2);
  });

  it("recupera destinação concluída após fechar o período sem repetir escrita ou gate", async () => {
    tx.origemColostro.findFirst.mockResolvedValue(origem(true));
    tx.destinacaoColostro.create.mockResolvedValue({ id: id(11) });
    tx.destinacaoColostro.findFirst.mockResolvedValue({ id: id(11), origemId: id(1), data, ocorridoEm: null, versao: 1,
      status: "CONFIRMADO", snapshot: {}, alocacoes: [], unidades: [] });
    const comando = { chave: id(9), propriedadeId: 7, versaoEsperada: 3, data: "2026-10-20", horarioEstimado: false,
      crias: [], unidades: [{ codigo: "U-001" }], responsavel: "Operador" };
    const primeiro = await destinarColostro(id(1), comando, 9);
    tx.periodoFinanceiro.findUnique.mockResolvedValue({ status: "FECHADO" });
    const reenvio = await destinarColostro(id(1), comando, 9);
    expect(reenvio).toEqual(primeiro);
    expect(tx.periodoFinanceiro.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.destinacaoColostro.create).toHaveBeenCalledTimes(1);
    expect(tx.unidadeBancoColostro.create).toHaveBeenCalledTimes(1);
    expect(tx.origemColostro.update).toHaveBeenCalledTimes(1);
    expect(tx.requisicaoPecuaria.create).toHaveBeenCalledTimes(1);
    expect(f.auditar).toHaveBeenCalledTimes(1);
    await expect(destinarColostro(id(1), { ...comando, responsavel: "Outro operador" }, 9)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("mascara valores no DTO de origem e não consulta custo oculto", async () => {
    tx.origemColostro.findFirst.mockResolvedValue(origem(true));
    const resultado = await consultarOrigemColostro(id(1), 7, { verValores: false });
    expect(resultado.custo).toEqual({ situacao: "OCULTO", valorTotal: null });
    expect(JSON.stringify(resultado)).not.toContain("11.00");
    expect(tx.entradaProducaoLeite.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.origemColostro.findFirst.mock.calls[0][0]).toMatchObject({ where: { id: id(1), propriedadeId: 7 } });
  });
  it("mostra custo comprovado quando autorizado e mantém Brix do enriquecimento pendente", async () => {
    tx.origemColostro.findFirst.mockResolvedValue(origem(true));

    const resultado = await consultarOrigemColostro(id(1), 7, { verValores: true });
    expect(resultado.custo).toEqual({ situacao: "APURADO", valorTotal: "11.00" });
    expect(resultado.brix.situacao).toBe("PENDENTE"); expect(resultado.tipo).toBe("ENRIQUECIDO");
  });
  it("recusa versão obsoleta antes de qualquer baixa ou destinação", async () => {
    await expect(destinarColostro(id(1), { chave: id(9), propriedadeId: 7, versaoEsperada: 2, data: "2026-10-20", horarioEstimado: false,
      crias: [], unidades: [{ codigo: "U1" }], responsavel: "Operador" }, 9)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(f.baixar).not.toHaveBeenCalled(); expect(tx.destinacaoColostro.create).not.toHaveBeenCalled();
  });
  it("não fornece colostro à cria sem Brix adequado nem exceção explícita", async () => {
    tx.origemColostro.findFirst.mockResolvedValue(origem(true));
    await expect(destinarColostro(id(1), { chave: id(9), propriedadeId: 7, versaoEsperada: 3, data: "2026-10-20", horarioEstimado: false,
      crias: [{ criaId: id(14), quantidadeLitros: 1, tipo: "FRESCO" }], unidades: [], responsavel: "Operador" }, 9)).rejects.toMatchObject({ campo: "excecaoBrix" });
    expect(tx.destinacaoColostro.create).not.toHaveBeenCalled(); expect(tx.unidadeBancoColostro.create).not.toHaveBeenCalled();
  });
  it("não enriquece origem já enriquecida nem baixa insumos", async () => {
    tx.origemColostro.findFirst.mockResolvedValue(origem(true));
    await expect(enriquecerColostro({ chave: id(9), propriedadeId: 7, data: "2026-10-20", horarioEstimado: false, volumeFinalLitros: 2.2, responsavel: "Operador",
      origens: [{ origemId: id(1), versaoEsperada: 3, quantidadeLitros: 2 }],
      insumos: [{ produtoId: id(8), quantidade: 0.2, unidade: "KG", cienciaValidadeDesconhecida: false, documentacaoExcepcional: false }] }, 9)).rejects.toMatchObject({ campo: "origens" });
    expect(tx.preparoColostro.create).not.toHaveBeenCalled(); expect(f.baixar).not.toHaveBeenCalled();
  });
  it("confirma entrada existente sem gerar outra produção ou baixar litros", async () => {
    const lote = { id: id(2), propriedadeId: 7, matrizId: id(4), partoId: id(5), data, ocorridoEm: null, horarioEstimado: false,
      medicaoGeralId: id(7), entradaId: id(6), quantidadeLitros: D(6), status: "RASCUNHO", versao: 1, origemFisicaSnapshot: { versaoMedicao: 2 }, criadoEm: data };
    tx.loteColostro.findFirst.mockResolvedValue(lote); tx.loteColostro.findUniqueOrThrow.mockResolvedValue(lote);
    tx.partoAnimal.findUniqueOrThrow.mockResolvedValue({ status: "VALIDO" });
    tx.medicaoGeralLeite.findUniqueOrThrow.mockResolvedValue({ id: id(7), versao: 2, litros: D(6), natureza: "COLOSTRO", entradasEstoque: [{ id: id(6) }] });
    tx.entradaProducaoLeite.findFirst.mockResolvedValue({ movimento: { quantidade: D(6), produtoId: id(8), produto: { ativo: true, unidade: "L", rastrearPartidas: false } } });
    f.saldos.mockResolvedValue([{ entradaId: id(6), quantidade: D(6) }]); tx.origemColostro.create.mockResolvedValue({ id: id(1) });
    await confirmarRetiradaColostro(id(2), { chave: id(9), propriedadeId: 7, versaoEsperada: 1, motivoNatureza: "Colostro desta matriz" }, 9);
    expect(f.confirmar).not.toHaveBeenCalled(); expect(f.salvar).not.toHaveBeenCalled(); expect(f.baixar).not.toHaveBeenCalled();
    expect(tx.origemColostro.create).toHaveBeenCalledWith({ data: { propriedadeId: 7, loteColostroId: id(2), quantidadeLitros: D(6), criadoPorId: 9 } });
  });
  it("não cria parto fictício para registrar retirada", async () => {
    tx.partoAnimal.findFirst.mockResolvedValue(null);
    await expect(registrarRetiradaColostro({ chave: id(9), propriedadeId: 7, partoId: id(5), data: "2026-10-20", horarioEstimado: false,
      primeiraRetirada: true, quantidadeLitros: 6, responsavel: "Operador", producao: { tipo: "EXISTENTE", entradaId: id(6), versaoEsperada: 1 } }, 9)).rejects.toMatchObject({ campo: "partoId" });
    expect(tx.loteColostro.create).not.toHaveBeenCalled(); expect(f.salvar).not.toHaveBeenCalled();
  });
  it("estorna rascunho sem apagar ou anular produção existente", async () => {
    const lote = { id: id(2), propriedadeId: 7, matrizId: id(4), data, quantidadeLitros: D(6), status: "RASCUNHO", versao: 1, criadoEm: data };
    tx.loteColostro.findFirst.mockResolvedValue({ ...lote, origem: null }); tx.loteColostro.findUniqueOrThrow.mockResolvedValue(lote);
    await estornarRetiradaColostro(id(2), { chave: id(9), propriedadeId: 7, versaoEsperada: 1, motivo: "Retirada duplicada na anotação" }, 9);
    expect(tx.loteColostro.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ESTORNADO", motivoEstorno: "Retirada duplicada na anotação" }) }));
    expect(f.baixar).not.toHaveBeenCalled(); expect(f.confirmar).not.toHaveBeenCalled();
  });
  it("destina 6L em 4L à cria e 2L ao banco usando uma transação e uma baixa física", async () => {
    const raw = { ...origem(false, "27"), quantidadeLitros: D(6) };
    tx.origemColostro.findFirst.mockResolvedValue(raw);
    tx.entradaProducaoLeite.findFirst.mockResolvedValue({ movimento: { produtoId: id(8) } });
    tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValue({ id: id(6), movimento: { produtoId: id(8) } });
    f.saldos.mockResolvedValue([{ entradaId: id(6), quantidade: D(6), natureza: "COLOSTRO", valor: D(12) }]);
    f.cria.mockResolvedValue({ animalId: id(4) }); f.registrar.mockResolvedValue({ id: id(10) }); f.baixar.mockResolvedValue({ id: id(12) });

    tx.destinacaoColostro.create.mockResolvedValue({ id: id(11) });
    tx.destinacaoColostro.findFirst.mockResolvedValue({ id: id(11), origemId: id(1), data, ocorridoEm: null, versao: 1,
      status: "CONFIRMADO", snapshot: { custosOrigens: { [id(1)]: "8.00" } },
      alocacoes: [{ id: id(13), fornecimentoId: id(10), fornecimento: { criaId: id(14) }, quantidadeLitros: D(4), movimentoId: id(12), ativo: true }],
      unidades: [{ id: id(15), codigo: "U-001", status: "CONGELADA", volumeLitros: D(2) }] });
    const resultado = await destinarColostro(id(1), { chave: id(9), propriedadeId: 7, versaoEsperada: 3, data: "2026-10-20", horarioEstimado: false,
      crias: [{ criaId: id(14), quantidadeLitros: 4, tipo: "FRESCO" }], unidades: [{ codigo: "U-001" }], responsavel: "Operador" }, 9);
    expect(f.transacao).toHaveBeenCalledTimes(1); expect(f.baixar).toHaveBeenCalledTimes(1);
    expect(f.baixar).toHaveBeenCalledWith(tx, expect.objectContaining({ quantidade: D(4), entradaIds: [id(6)], permitirOrigemColostro: true }));
    expect(tx.unidadeBancoColostro.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ volumeLitros: D(2), origemId: id(1) }) }));
    expect(resultado.custo).toEqual({ situacao: "OCULTO", valorTotal: null });
    expect(f.confirmar).not.toHaveBeenCalled(); expect(f.salvar).not.toHaveBeenCalled();
    expect(f.vincular).toHaveBeenCalledWith(tx, expect.objectContaining({ animalId: id(4), criaId: id(14), fornecimentoId: id(10) }), 9);
  });

  it("apura descendentes em leitura depois do custo da origem e conserva centavos e sobra", async () => {
    const bruto = id(30), enriquecido = id(31), alocacaoPreparo = id(32), entradaMov = id(33), preparoMov = id(34);
    const fornecimentos = [id(35), id(36)].map((ident, indice) => ({ id: ident, origemId: enriquecido, quantidadeLitros: D(1), movimentoId: null,
      fornecimentoId: id(40 + indice), fornecimento: { data, criadoEm: new Date(data.getTime() + indice), cria: { animalId: id(50 + indice) } } }));
    tx.origemColostro.findFirst.mockImplementation(async (args: unknown) => {
      const identidade = (args as { where: { id: string } }).where.id;
      return (identidade === bruto ? { id: bruto, quantidadeLitros: D(6), loteColostro: { entrada: { movimentoId: entradaMov } }, preparo: null }
        : { id: enriquecido, quantidadeLitros: D("2.2"), loteColostro: null,
          preparo: { origens: [{ id: alocacaoPreparo, origemId: bruto }], insumos: [{ movimento: { valorTotal: D("0.40") } }] } }) as never;
    });
    tx.alocacaoFornecimentoColostro.findMany.mockImplementation(async (args: unknown) => {
      const onde = (args as { where: { origemId?: string } }).where;
      return (onde.origemId === bruto ? [] : fornecimentos) as never;
    });
    tx.origemPreparoColostro.findMany.mockImplementation(async (args: unknown) => ((args as { where: { origemId: string } }).where.origemId === bruto
      ? [{ id: alocacaoPreparo, movimentoId: preparoMov, quantidadeLitros: D(2), preparo: { data, criadoEm: data } }] : []) as never);
    const banco = tx as unknown as Prisma.TransactionClient;
    const pendente = await consultarCustosColostroTx(banco, 7, {});
    expect(pendente.map(l => l.valorTotal)).toEqual([null, null]);
    f.valores.mockResolvedValue(new Map([[entradaMov, { valorTotal: D("0.03") }], [preparoMov, { valorTotal: D("0.01") }]]));
    const apurado = await consultarCustosColostroTx(banco, 7, {});
    expect(apurado.map(l => l.valorTotal?.toFixed(2))).toEqual(["0.19", "0.18"]);
    expect(apurado.reduce((s, l) => s.plus(l.valorTotal!), D(0)).plus("0.04").toFixed(2)).toBe("0.41");
    expect(tx.origemColostro.update).not.toHaveBeenCalled();
  });

  it("consulta custo somente de alocações ativas e fornecimentos válidos no sítio e período", async () => {
    const r = await consultarCustosColostroTx(tx as unknown as Prisma.TransactionClient, 7,
      { de: "2026-10-01", ate: "2026-10-28", animalIds: [id(4)] });
    expect(r).toEqual([]);
    expect(tx.alocacaoFornecimentoColostro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      ativo: true, origem: { propriedadeId: 7 }, fornecimento: { propriedadeId: 7, status: "VALIDO",
        data: { gte: new Date("2026-10-01T00:00:00Z"), lte: new Date("2026-10-28T00:00:00Z") }, cria: { animalId: { in: [id(4)] } } },
    } }));
    expect(tx.origemColostro.findFirst).not.toHaveBeenCalled();
  });

  it("detecta ciclo em descendentes de custo sem recursão ilimitada", async () => {
    tx.alocacaoFornecimentoColostro.findMany.mockResolvedValue([{ origemId: id(1) }] as never);
    tx.origemColostro.findFirst.mockResolvedValue({ id: id(1), quantidadeLitros: D(2), loteColostro: null,
      preparo: { origens: [{ id: id(2), origemId: id(1) }], insumos: [] } } as never);
    await expect(consultarCustosColostroTx(tx as unknown as Prisma.TransactionClient, 7, {})).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.origemColostro.update).not.toHaveBeenCalled();
  });

  it("congela colostro com Brix pendente sem exigir exceção de fornecimento", async () => {
    tx.origemColostro.findFirst.mockResolvedValue(origem(true));
    tx.destinacaoColostro.create.mockResolvedValue({ id: id(11) });
    tx.destinacaoColostro.findFirst.mockResolvedValue({ id: id(11), origemId: id(1), data, ocorridoEm: null, versao: 1, status: "CONFIRMADO",
      snapshot: { brix: { situacao: "PENDENTE" }, excecaoBrix: null }, alocacoes: [], unidades: [] });
    const resultado = await destinarColostro(id(1), { chave: id(9), propriedadeId: 7, versaoEsperada: 3, data: "2026-10-20", horarioEstimado: false,
      crias: [], unidades: [{ codigo: "PENDENTE-1" }], responsavel: "Operador" }, 9);
    expect(resultado.brix).toEqual({ situacao: "PENDENTE" }); expect(resultado.excecaoBrix).toBeNull();
    expect(tx.unidadeBancoColostro.create).toHaveBeenCalledTimes(1); expect(f.baixar).not.toHaveBeenCalled();
  });
  it("usa parcialmente remanescente retirado sem devolver sua sobra ao saldo livre", async () => {
    const unidade = { id: id(70), propriedadeId: 7, origemId: id(1), volumeLitros: D(2), status: "RETIRADA", versao: 2,
      codigo: "U-70", dataCongelamento: data, dataRetirada: data, retiradoEm: null };
    const fonte = { ...origem(true, "27"), unidades: [unidade],
      fornecimentos: [{ unidadeId: unidade.id, quantidadeLitros: D("0.75") }] };
    tx.origemColostro.findFirst.mockResolvedValue(fonte as never);
    const antes = await consultarOrigemColostro(id(1), 7);
    expect(antes.livreLitros).toBe("0.2"); expect(antes.unidades[0].saldoRestanteLitros).toBe("1.25");
    f.cria.mockResolvedValue({ animalId: id(4) }); f.registrar.mockResolvedValue({ id: id(10) });
    tx.destinacaoColostro.create.mockResolvedValue({ id: id(11) });
    tx.destinacaoColostro.findFirst.mockResolvedValue({ id: id(11), origemId: id(1), data, ocorridoEm: null, versao: 1, status: "CONFIRMADO", snapshot: {}, alocacoes: [], unidades: [] });
    await destinarColostro(id(1), { chave: id(9), propriedadeId: 7, versaoEsperada: 3, data: "2026-10-20", horarioEstimado: false,
      unidadeId: unidade.id, crias: [{ criaId: id(14), quantidadeLitros: 1, tipo: "DESCONGELADO" }], unidades: [], responsavel: "Operador" }, 9);
    expect(tx.unidadeBancoColostro.update).toHaveBeenCalledWith({ where: { id: unidade.id, versao: 2 }, data: { status: "RETIRADA", versao: { increment: 1 } } });
    expect(f.baixar).not.toHaveBeenCalled();
    await expect(destinarColostro(id(1), { chave: id(90), propriedadeId: 7, versaoEsperada: 3, data: "2026-10-20", horarioEstimado: false,
      unidadeId: unidade.id, crias: [{ criaId: id(14), quantidadeLitros: 1.3, tipo: "DESCONGELADO" }], unidades: [], responsavel: "Operador" }, 9)).rejects.toMatchObject({ code: "CONFLITO" });
  });

  it("normaliza 500G em 0,5KG no insumo persistido e conserva a unidade original no snapshot", async () => {
    tx.entradaProducaoLeite.findFirst.mockResolvedValue({ movimento: { produtoId: id(8) } });
    tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValue({ id: id(6), movimento: { produtoId: id(8) } });
    f.saldos.mockResolvedValue([{ entradaId: id(6), quantidade: D("2.2"), natureza: "COLOSTRO", valor: null }]);
    tx.preparoColostro.create.mockResolvedValue({ id: id(3) }); f.baixar.mockResolvedValue({ id: id(12) });
    tx.produto.findFirst.mockResolvedValue({ id: id(80), ativo: true, unidade: "KG", rastrearPartidas: false });
    f.consumir.mockResolvedValue({ movimentoEstoqueId: id(81), valorProdutoAtribuido: D("2.50"), partida: null });
    tx.origemColostro.create.mockResolvedValue({ id: id(82) });
    tx.preparoColostro.findFirst.mockResolvedValue({ id: id(3), data, ocorridoEm: null, volumeFinalLitros: D("2.2"), status: "CONFIRMADO", versao: 1,
      origens: [], insumos: [], origemResultado: { id: id(82), valorTotal: null }, criadoEm: data });
    await enriquecerColostro({ chave: id(9), propriedadeId: 7, data: "2026-10-20", horarioEstimado: false, volumeFinalLitros: 2.2, responsavel: "Operador",
      origens: [{ origemId: id(1), versaoEsperada: 3, quantidadeLitros: 2 }],
      insumos: [{ produtoId: id(80), quantidade: 500, unidade: "G", cienciaValidadeDesconhecida: false, documentacaoExcepcional: false }] }, 9);
    expect(f.consumir).toHaveBeenCalledWith(tx, expect.objectContaining({ quantidade: D("0.5") }));
    expect(tx.insumoPreparoColostro.create).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: D("0.5"), unidade: "KG", movimentoId: id(81) }) });
    expect(tx.preparoColostro.create).toHaveBeenCalledWith({ data: expect.objectContaining({ snapshot: expect.objectContaining({ insumosInformados: [expect.objectContaining({ quantidade: 500, unidade: "G" })] }) }) });
  });

});

describe('reutilização de fornecimento já registrado',()=>{
 const horario=new Date('2026-10-20T11:30:00Z');
 const comando=()=>({chave:id(90),propriedadeId:7,versaoEsperada:3,data:'2026-10-20',ocorridoEm:horario.toISOString(),horarioEstimado:false,crias:[{criaId:id(14),quantidadeLitros:4,tipo:'FRESCO' as const,fornecimentoColostroId:id(10)}],unidades:[],responsavel:'Operadora'});
 beforeEach(()=>{
  tx.origemColostro.findFirst.mockResolvedValue({...origem(true,'27'),quantidadeLitros:D(6)} as never);
  tx.destinacaoColostro.create.mockResolvedValue({id:id(11)});
  tx.destinacaoColostro.findFirst.mockResolvedValue({id:id(11),origemId:id(1),data,ocorridoEm:horario,versao:1,status:'CONFIRMADO',snapshot:{fornecimentosCriados:[]},alocacoes:[],unidades:[]});
  tx.fornecimentoColostro.findFirst.mockResolvedValue({id:id(10),criaId:id(14),propriedadeId:7,data,ocorridoEm:horario,horarioEstimado:false,quantidadeLitros:D(4),status:'VALIDO'});
  f.cria.mockResolvedValue({animalId:id(4),parto:{propriedadeId:99}});
 });
 it('vincula os 4 L do parto sem outro fornecimento e conserva sua identidade em replay',async()=>{
  await destinarColostro(id(1),comando(),9);await destinarColostro(id(1),comando(),9);
  expect(f.registrar).not.toHaveBeenCalled();expect(tx.alocacaoFornecimentoColostro.create).toHaveBeenCalledTimes(1);
  expect(tx.alocacaoFornecimentoColostro.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({fornecimentoId:id(10),quantidadeLitros:D(4)})}));
  expect(tx.destinacaoColostro.update).toHaveBeenCalledWith(expect.objectContaining({data:{snapshot:expect.objectContaining({fornecimentosCriados:[]})}}));
 });
 it.each(['volume','hora','estimativa','anulado','vinculado','estoque'])('recusa candidato incompatível após seleção: %s',async caso=>{
  if(caso==='volume')tx.fornecimentoColostro.findFirst.mockResolvedValue({data,quantidadeLitros:D(3),ocorridoEm:horario,horarioEstimado:false});
  if(caso==='hora')tx.fornecimentoColostro.findFirst.mockResolvedValue({data,quantidadeLitros:D(4),ocorridoEm:null,horarioEstimado:false});
  if(caso==='estimativa')tx.fornecimentoColostro.findFirst.mockResolvedValue({data,quantidadeLitros:D(4),ocorridoEm:horario,horarioEstimado:true});
  if(caso==='anulado')tx.fornecimentoColostro.findFirst.mockResolvedValue(null);
  if(caso==='vinculado')tx.alocacaoFornecimentoColostro.findFirst.mockResolvedValue({id:id(80)});
  if(caso==='estoque')tx.parcelaDestinoLeite.findFirst.mockResolvedValue({id:id(80)});
  await expect(destinarColostro(id(1),comando(),9)).rejects.toMatchObject({campo:'crias'});
  expect(tx.alocacaoFornecimentoColostro.create).not.toHaveBeenCalled();expect(f.baixar).not.toHaveBeenCalled();expect(f.registrar).not.toHaveBeenCalled();
 });
 it('estorna apenas o vínculo de fato existente, conservando fornecimento original válido',async()=>{
  const atual={id:id(11),origemId:id(1),data,versao:1,status:'CONFIRMADO',snapshot:{fornecimentosCriados:[]},unidades:[],alocacoes:[{id:id(12),quantidadeLitros:D(4),fornecimentoId:id(10),movimentoId:null,unidadeId:null,fornecimento:{versao:1,cria:{animalId:id(4)}}}]};
  tx.destinacaoColostro.findFirst.mockResolvedValue(atual);tx.destinacaoColostro.findUniqueOrThrow.mockResolvedValue(atual);
  await estornarDestinacaoColostro(id(11),{chave:id(91),propriedadeId:7,versaoEsperada:1,motivo:'Regularizar a origem'},9);
  expect(f.corrigir).not.toHaveBeenCalled();expect(tx.alocacaoFornecimentoColostro.updateMany).toHaveBeenCalledWith({where:{destinacaoId:id(11),ativo:true},data:{ativo:false}});
 });
 it('consulta somente fatos válidos, positivos e sem outra origem, com ID independente da página',async()=>{
  tx.fornecimentoColostro.count.mockResolvedValue(121);tx.fornecimentoColostro.findMany.mockResolvedValue([]);
  const r=await listarFornecimentosColostro(7,{criaId:id(14),data:'2026-10-20',pagina:7,porPagina:20,fornecimentoId:id(10)});
  expect(r.selecionado).toMatchObject({id:id(10),quantidadeLitros:'4.000'});
  expect(tx.fornecimentoColostro.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:120,take:20,where:{criaId:id(14),propriedadeId:7,data,status:'VALIDO',quantidadeLitros:{gt:0},alocacoesOrigem:{none:{ativo:true}},parcelasDestinoLeite:{none:{ativo:true}}}}));
 });
});

describe('regularização de retirada após correção da produção',()=>{
 const rascunho=()=>({id:id(2),propriedadeId:7,matrizId:id(4),partoId:id(5),data,ocorridoEm:null,horarioEstimado:false,primeiraRetirada:true,medicaoGeralId:id(7),entradaId:null,quantidadeLitros:D(6),origemFisicaSnapshot:{versaoMedicao:2,recipiente:'Balde original'},status:'RASCUNHO',versao:1,criadoEm:data,origem:null});
 const medicao=()=>({id:id(7),versao:3,litros:D(5),natureza:'COLOSTRO',primeiraOrdenhaColostro:true,animaisOrigem:[id(4)],entradasEstoque:[],recipiente:'Balde corrigido',tanqueId:null,tanque:null,sessaoId:id(8),sessao:{nome:'Manhã'}});
 const input=()=>({chave:id(95),propriedadeId:7,partoId:id(5),data:'2026-10-20',horarioEstimado:false,primeiraRetirada:true,quantidadeLitros:5,responsavel:'Operadora',producao:{tipo:'EXISTENTE' as const,medicaoGeralId:id(7),versaoEsperada:3}});
 beforeEach(()=>{tx.partoAnimal.findFirst.mockResolvedValue({id:id(5),animalId:id(4),status:'VALIDO',data});tx.partoAnimal.findUniqueOrThrow.mockResolvedValue({status:'VALIDO'});});
 it('recusa confirmar anotação de 6 L após medição mudar para 5 L e permite estorno sem reescrever snapshot',async()=>{
  const antes=rascunho();let atual=antes;
  tx.loteColostro.findFirst.mockImplementation(async()=>atual);tx.loteColostro.findUniqueOrThrow.mockImplementation(async()=>atual);
  tx.medicaoGeralLeite.findUniqueOrThrow.mockResolvedValue(medicao());
  await expect(confirmarRetiradaColostro(id(2),{chave:id(94),propriedadeId:7,versaoEsperada:1,motivoNatureza:'Conferida pela operadora'},9)).rejects.toMatchObject({code:'CONFLITO'});
  expect(tx.origemColostro.create).not.toHaveBeenCalled();expect(f.confirmar).not.toHaveBeenCalled();
  tx.loteColostro.update.mockImplementation(async({data:d})=>(atual={...atual,status:d.status,versao:2}));
  await estornarRetiradaColostro(id(2),{chave:id(93),propriedadeId:7,versaoEsperada:1,motivo:'Medição corrigida para cinco litros'},9);
  expect(atual.quantidadeLitros.eq(6)).toBe(true);expect(atual.origemFisicaSnapshot).toEqual(antes.origemFisicaSnapshot);
  expect(tx.loteColostro.update).toHaveBeenCalledWith({where:{id:id(2),versao:1},data:expect.objectContaining({status:'ESTORNADO',versao:{increment:1},motivoEstorno:'Medição corrigida para cinco litros'})});
  expect(tx.medicaoGeralLeite.findUniqueOrThrow).toHaveBeenCalledTimes(1);
 });
 it('permite novo vínculo de 5 L após estorno, com outra identidade e snapshot atual',async()=>{
  tx.loteColostro.findFirst.mockImplementation(async({where})=>where.status?null:{...rascunho(),status:'ESTORNADO'});
  tx.medicaoGeralLeite.findFirst.mockResolvedValue(medicao());tx.loteColostro.create.mockResolvedValue({id:id(96)});
  tx.loteColostro.findFirstOrThrow.mockResolvedValue({...rascunho(),id:id(96),quantidadeLitros:D(5),origemFisicaSnapshot:{versaoMedicao:3}});
  await registrarRetiradaColostro(input(),9);
  expect(tx.loteColostro.findFirst).toHaveBeenCalledWith({where:{status:{not:'ESTORNADO'},OR:[{medicaoGeralId:id(7)}]}});
  expect(tx.loteColostro.create).toHaveBeenCalledWith({data:expect.objectContaining({quantidadeLitros:D(5),medicaoGeralId:id(7),origemFisicaSnapshot:expect.objectContaining({versaoMedicao:3})})});
  expect(tx.loteColostro.update).not.toHaveBeenCalled();expect(f.salvar).not.toHaveBeenCalled();
 });
 it('recusa segundo vínculo ativo antes de criar outra anotação',async()=>{
  tx.loteColostro.findFirst.mockResolvedValue({...rascunho(),quantidadeLitros:D(5)});
  await expect(registrarRetiradaColostro(input(),9)).rejects.toMatchObject({code:'CONFLITO'});
  expect(tx.loteColostro.create).not.toHaveBeenCalled();
 });
 it('oferece produção corrigida quando só há retirada estornada e exclui qualquer vínculo ativo',async()=>{
  tx.medicaoGeralLeite.findMany.mockResolvedValue([medicao()]);
  const r=await listarProducoesRetiradaColostro(7,{partoId:id(5),data:'2026-10-20'});
  expect(r.itens[0]).toMatchObject({medicaoGeralId:id(7),quantidadeLitros:'5',versaoEsperada:3});
  expect(tx.medicaoGeralLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({lotesColostro:{none:{status:{not:'ESTORNADO'}}}})}));
  expect(tx.entradaProducaoLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({lotesColostro:{none:{status:{not:'ESTORNADO'}}}})}));
 });
});
