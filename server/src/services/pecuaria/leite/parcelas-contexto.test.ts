import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ origens: vi.fn(), carencia: vi.fn() }));
vi.mock("./producao.js", () => ({ conferirAnimaisOrigemGeralTx: f.origens }));
vi.mock("./carencia-producao.js", () => ({ conferirCarenciaProducaoTx: f.carencia }));
import { conferirContextoParcelaTx, conferirSegregacaoParcelas, partoCompativelColostro, consultarContextoParcelasTx } from "./parcelas-contexto.js";
import { criterioColostroSchema } from "./schemas.js";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const data = new Date("2026-10-24T00:00:00Z");
const parto = { id: id(1), animalId: id(2), propriedadeId: 1, versao: 4, data, status: "VALIDO" };
const lactacao = { id: id(3), animalId: id(2), partoId: parto.id, inicio: data, encerradaEm: null };
const parcela = { natureza: "COLOSTRO" as const, animaisOrigem: [id(2)] };
const configuracao = { id: id(4), criterioColostro: { tipo: "PRIMEIRA_ORDENHA" as const } };
let mocks: { lactacaoAnimal: { findMany: ReturnType<typeof vi.fn> }; partoAnimal: { findMany: ReturnType<typeof vi.fn> }; animal: { findMany: ReturnType<typeof vi.fn> }; medicaoGeralLeite: { findMany: ReturnType<typeof vi.fn> } };
let tx: Prisma.TransactionClient;
beforeEach(() => {
  vi.resetAllMocks();
  mocks = { medicaoGeralLeite: { findMany: vi.fn(async () => []) }, lactacaoAnimal: { findMany: vi.fn(async () => [lactacao]) }, partoAnimal: { findMany: vi.fn(async () => [parto]) }, animal: { findMany: vi.fn(async () => []) } };
  tx = mocks as unknown as Prisma.TransactionClient;
  f.origens.mockResolvedValue([{ animalId: id(2), lactacaoId: id(3) }]);
  f.carencia.mockResolvedValue({ animais: [{ animalId: id(2), estado: "SEM_RESTRICAO_REGISTRADA", evidencias: [] }] });
});
describe("critério versionado de colostro", () => {
  it("a janela civil inclui D0 e exclui a fronteira final sem converter meses ou inventar horário", () => {
    const criterio = criterioColostroSchema.parse({ tipo: "JANELA_DIAS", dias: 3 });
    expect(criterio).toEqual({ tipo: "JANELA_DIAS", dias: 3, incluiD0: true });
    expect(partoCompativelColostro(data, data, criterio)).toBe(true);
    expect(partoCompativelColostro(new Date("2026-10-26"), data, criterio)).toBe(true);
    expect(partoCompativelColostro(new Date("2026-10-27"), data, criterio)).toBe(false);
    expect(partoCompativelColostro(new Date("2026-10-23"), data, criterio)).toBe(false);
    expect(partoCompativelColostro(data, data, null)).toBe(false);
    expect(criterioColostroSchema.safeParse({ tipo: "JANELA_DIAS", dias: 0 }).success).toBe(false);
    expect(criterioColostroSchema.safeParse({ tipo: "JANELA_DIAS", dias: 3, incluiD0: false }).success).toBe(false);
  });
  it("D0 exige parto real ligado à lactação, finalidade e localização validadas e declaração explícita da primeira ordenha", async () => {
    await expect(conferirContextoParcelaTx(tx, 1, data, null, configuracao, parcela)).rejects.toMatchObject({ campo: "primeiraOrdenhaColostro" });
    const resultado = await conferirContextoParcelaTx(tx, 1, data, null, configuracao, { ...parcela, primeiraOrdenhaColostro: true });
    expect(resultado.snapshot).toEqual({ configuracaoId: id(4), criterio: { tipo: "PRIMEIRA_ORDENHA" }, partos: [{ id: id(1), versao: 4, animalId: id(2), data: "2026-10-24" }], primeiraOrdenhaColostro: true });
    expect(f.origens).toHaveBeenCalledWith(tx, 1, data, [id(2)]);
    mocks.partoAnimal.findMany.mockResolvedValue([]);
    await expect(conferirContextoParcelaTx(tx, 1, data, null, configuracao, { ...parcela, primeiraOrdenhaColostro: true })).rejects.toMatchObject({ campo: "declaracaoDireta" });
  });
  it("lactação sem vínculo com o parto e janela encerrada não comprovam o contexto", async () => {
    mocks.lactacaoAnimal.findMany.mockResolvedValue([{ ...lactacao, partoId: null }]);
    mocks.partoAnimal.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.length ? [parto] : []);
    await expect(conferirContextoParcelaTx(tx, 1, data, null, configuracao, parcela)).rejects.toMatchObject({ campo: "declaracaoDireta" });
    mocks.lactacaoAnimal.findMany.mockResolvedValue([lactacao]);
    await expect(conferirContextoParcelaTx(tx, 1, new Date("2026-10-27"), null,
      { id: id(4), criterioColostro: { tipo: "JANELA_DIAS", dias: 3, incluiD0: true } }, parcela)).rejects.toMatchObject({ campo: "declaracaoDireta" });
  });
  it("não declara outra primeira ordenha do mesmo parto e ignora a própria parcela na revalidação", async () => {
    mocks.medicaoGeralLeite.findMany.mockResolvedValue([{ id: id(90), criterioColostroSnapshot: { partos: [{ id: parto.id, animalId: parto.animalId }] } }]);
    await expect(conferirContextoParcelaTx(tx, 1, data, null, configuracao, { ...parcela, primeiraOrdenhaColostro: true })).rejects.toMatchObject({ code: "CONFLITO" });
    mocks.medicaoGeralLeite.findMany.mockResolvedValue([]);
    await conferirContextoParcelaTx(tx, 1, data, null, configuracao, { ...parcela, primeiraOrdenhaColostro: true }, id(90));
    expect(mocks.medicaoGeralLeite.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ NOT: { id: id(90) } }) }));
  });
  it("permite declaração direta com origens desconhecidas sem fabricar parto, carência ou liberação comercial", async () => {
    mocks.lactacaoAnimal.findMany.mockResolvedValue([]); mocks.partoAnimal.findMany.mockResolvedValue([]);
    f.origens.mockResolvedValue([]); f.carencia.mockResolvedValue({ animais: [] });
    const direta = { ...parcela, animaisOrigem: [], declaracaoDireta: { justificativa: "Volume separado sem origem identificada" } };
    const r = await conferirContextoParcelaTx(tx, 1, data, null, { id: id(4), criterioColostro: null }, direta);
    expect(r).toMatchObject({ origens: [], carencia: { animais: [] }, snapshot: { criterio: null, partos: [] } });
    await expect(conferirContextoParcelaTx(tx, 1, data, null, configuracao, { ...direta, natureza: "COMERCIAL" })).rejects.toThrow("não libera");
  });
  it("descarte sem carência no contexto exige justificativa; desconhecido segue explícito", async () => {
    await expect(conferirContextoParcelaTx(tx, 1, data, null, configuracao, { ...parcela, natureza: "NAO_COMERCIAL" })).rejects.toMatchObject({ campo: "declaracaoDireta" });
    f.carencia.mockResolvedValue({ animais: [{ animalId: id(2), estado: "NAO_AFERIVEL", evidencias: [{ estadoCarenciaLeite: "DESCONHECIDO" }] }] });
    const r = await conferirContextoParcelaTx(tx, 1, data, null, configuracao, { ...parcela, natureza: "NAO_COMERCIAL" });
    expect(r.carencia.animais[0].estado).toBe("NAO_AFERIVEL");
  });
  it("a consulta sugere somente D0 com parto comprovado e conserva a regra separada das origens gerais", async () => {
    mocks.animal.findMany.mockResolvedValue([{ id: id(2), sexo: "F", brinco: "001", nome: "Vaca", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2020-01-01"),
      destinos: [{ id: id(8), aptidao: "LEITE", desde: new Date("2020-01-01"), ate: null }],
      localizacoes: [{ id: id(9), propriedadeId: 1, desde: new Date("2020-01-01"), ate: null }], baixas: [] }]);
    const r = await consultarContextoParcelasTx(tx, 1, data, { criterioColostro: configuracao.criterioColostro, ordenhas: [{ posicaoId: id(10), horario: "06:00" }] });
    expect(r.origensColostro).toEqual([{ animalId: id(2), brinco: "001", nome: "Vaca", del: 0, partoId: id(1) }]);
    expect(r.partos).toEqual([{ id: id(1), versao: 4, animalId: id(2), data: "2026-10-24" }]);
    expect(f.carencia).toHaveBeenCalledWith(tx, { data, horario: "06:00", animalIds: [id(2)] });
  });
  it("não repete sugestão de primeira ordenha já declarada, sem impor prazo arbitrário ao histórico", async () => {
    const animal = { id: id(2), sexo: "F", brinco: "001", nome: "Vaca", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2020-01-01"),
      destinos: [{ id: id(8), aptidao: "LEITE", desde: new Date("2020-01-01"), ate: null }],
      localizacoes: [{ id: id(9), propriedadeId: 1, desde: new Date("2020-01-01"), ate: null }], baixas: [] };
    mocks.animal.findMany.mockResolvedValue([animal]);
    const outroDia = new Date("2027-02-21");
    expect(partoCompativelColostro(outroDia, data, { tipo: "PRIMEIRA_ORDENHA" })).toBe(true);
    mocks.medicaoGeralLeite.findMany.mockResolvedValue([{ id: id(90), criterioColostroSnapshot: { partos: [{ id: parto.id, animalId: parto.animalId }] } }]);
    const r = await consultarContextoParcelasTx(tx, 1, outroDia, { criterioColostro: configuracao.criterioColostro, ordenhas: [] });
    expect(r.partos).toHaveLength(1);
    expect(r.origensColostro).toEqual([]);
  });

  it.each([false, true])("preserva o estado sanitário, mas só expõe evidências pelo sítio atual (atual no sítio: %s)", async atualNoSitio => {
    const transferencia = new Date("2026-10-25");
    const animal = { id: id(2), sexo: "F", brinco: "001", nome: "Vaca", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2020-01-01"),
      destinos: [{ id: id(8), aptidao: "LEITE", desde: new Date("2020-01-01"), ate: null }],
      localizacoes: [
        { id: id(12), propriedadeId: atualNoSitio ? 2 : 3, desde: transferencia, ate: null, criadoEm: transferencia },
        { id: id(9), propriedadeId: 2, desde: new Date("2020-01-01"), ate: transferencia, criadoEm: new Date("2020-01-01") },
      ], baixas: [] };
    mocks.animal.findMany.mockResolvedValue([animal]);
    mocks.partoAnimal.findMany.mockResolvedValue([]);
    const { classificarCarenciaProducao, conferirCarenciaOrigensVendaTx } = await vi.importActual<typeof import("./carencia-producao.js")>("./carencia-producao.js");
    // Aplicação no sítio A, produção histórica em B, animal atualmente em B ou C.
    const aplicacao = { id: id(50), animalId: animal.id, propriedadeId: 1, data: new Date("2026-10-23"), aplicadaEm: new Date("2026-10-23T12:00:00Z"),
      precisaoTemporal: "HORA", estadoCarenciaLeite: "INFORMADO", carenciaLeiteHoras: 48, aptidaoCarenciaSnapshot: "LEITE", consumoMantido: false, administracaoMantida: null };
    const carencia = classificarCarenciaProducao({ data, horario: "06:00", animalIds: [animal.id] }, [aplicacao]);
    f.carencia.mockResolvedValue(carencia);
    const r = await consultarContextoParcelasTx(tx, 2, data, { ordenhas: [{ posicaoId: id(10), horario: "06:00" }] });
    expect(r.carencias[0].animais).toEqual([{ animalId: animal.id, estado: "EM_CARENCIA", brinco: "001", nome: "Vaca",
      evidencias: atualNoSitio ? carencia.animais[0].evidencias : [] }]);
    if (!atualNoSitio) expect(JSON.stringify(r)).not.toContain(aplicacao.id);
    expect(mocks.animal.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({
      localizacoes: { orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] },
    }) }));
    const interno = await conferirContextoParcelaTx(tx, 2, data, "06:00", configuracao, { natureza: "COMERCIAL", animaisOrigem: [animal.id] });
    expect(interno.carencia).toEqual(carencia);
    const vendaTx = {
      entradaProducaoLeite: { findMany: vi.fn(async () => [{ id: id(60), medicaoGeralId: id(61), movimentoId: id(62), snapshot: { animaisOrigem: [{ animalId: animal.id }] },
        movimento: { data }, sessao: { horario: "06:00" }, vinculosMedicoes: [] }]) },
      movimentoEstoque: { findUniqueOrThrow: vi.fn(async () => ({ propriedadeId: 2 })) },
      aplicacaoProduto: { findMany: vi.fn(async () => [aplicacao]) },
    };
    await expect(conferirCarenciaOrigensVendaTx(vendaTx as unknown as Prisma.TransactionClient, [id(60)])).rejects.toMatchObject({ code: "CONFLITO" });
    expect(carencia.animais[0].evidencias).toHaveLength(1);
  });

});
it("recipientes são distintos por parcela, inclusive diferenças de caixa e espaços", () => {
  expect(() => conferirSegregacaoParcelas([{ natureza: "COMERCIAL", recipiente: "Balde A" }, { natureza: "COLOSTRO", recipiente: " balde a " }])).toThrow("recipiente físico distinto");
  expect(() => conferirSegregacaoParcelas([{ natureza: "COMERCIAL", tanqueId: id(1) }, { natureza: "COMERCIAL", tanqueId: id(1) }])).toThrow("recipiente físico distinto");
  expect(() => conferirSegregacaoParcelas([{ natureza: "COMERCIAL", tanqueId: id(1) }, { natureza: "COMERCIAL", tanqueId: id(2) }])).not.toThrow();
});
