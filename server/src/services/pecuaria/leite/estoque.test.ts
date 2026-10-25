import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AplicacaoCarenciaProducao } from "./carencia-producao.js";

const f = vi.hoisted(() => ({ transacao: vi.fn(), tx: {} as Prisma.TransactionClient, auditar: vi.fn(), periodo: vi.fn(), classificar: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../../estoque/transacao.js", () => ({ transacaoEstoque: f.transacao }));
vi.mock("../../financeiro/regras.js", async importar => ({ ...await importar<typeof import("../../financeiro/regras.js")>(), auditar: f.auditar, exigirPeriodoAberto: f.periodo }));
vi.mock("../../estoque/leite.js", async importar => ({ ...await importar<typeof import("../../estoque/leite.js")>(), classificarEntradaLeiteTx: f.classificar }));
vi.mock("../../estoque/valorizacao.js", () => ({ travarValorizacaoTx: vi.fn(), previaRetroatividadeTx: vi.fn(async () => ({ permitido: true })) }));

vi.mock("./producao.js", async original => ({ ...await original<typeof import("./producao.js")>(), conferirAnimaisOrigemGeralTx: vi.fn(async () => []) }));
import { travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { correcaoVendaLeiteSchema, consultaVendasLeiteSchema, anularEntradaProducaoLeite, apurarValorProducaoLeite, classificarEntradaLeiteSchema, confirmarProducaoLeite, confirmarProducaoGeral, confirmarParcelasOrdenha, confirmarSessaoProducaoLeite, confirmarSessaoProducaoLeiteSchema, exigirSessaoLeiteEditavelTx, confirmarProducaoLeiteSchema, apuracaoValorLeiteSchema } from "./estoque.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const contexto = { propriedadeId: 7, usuarioId: 9 };
const input = { sessaoId: id(1), versaoEsperada: 3, produtoId: id(2), chave: id(3), medicaoIds: [id(11)], natureza: "COMERCIAL" as const, motivoNatureza: "Grupo segregado comercial" };
function banco() {
  const participantes = [{ id: id(4), animalId: id(40), finalidadeId: id(400), finalidadeSnapshot: { regra: "FINALIDADE_LEITE_V1", aptidao: "LEITE", finalidadeId: id(400), dataOperacional: "2026-10-18", desde: "2020-01-01", ate: null }, excluidoEm: null }, { id: id(5), animalId: id(50), finalidadeId: id(500), finalidadeSnapshot: { regra: "FINALIDADE_LEITE_V1", aptidao: "LEITE", finalidadeId: id(500), dataOperacional: "2026-10-18", desde: "2020-01-01", ate: null }, excluidoEm: null }];
  return {
    requisicaoPecuaria: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: unknown }) => data) },
    baixaAnimal: { findMany: vi.fn(async (): Promise<{ id: string; animalId: string; data: Date; destinoFechadoId: string | null }[]> => []) },
    participanteProducaoLeite: { findMany: vi.fn(async () => participantes) },
    finalidadeAnimal: { findMany: vi.fn(async (): Promise<{ id: string; animalId: string; aptidao: string; desde: Date; ate: Date | null }[]> => participantes.map(p => ({ id: p.finalidadeId, animalId: p.animalId, aptidao: "LEITE", desde: new Date("2020-01-01"), ate: null }))) },
    aplicacaoProduto: { findMany: vi.fn(async (): Promise<AplicacaoCarenciaProducao[]> => []) },
    $executeRaw: vi.fn(), $queryRaw: vi.fn(async () => [{ id: input.sessaoId }]),
    entradaProducaoLeite: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null),
      findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), create: vi.fn(async ({ data }: { data: Prisma.EntradaProducaoLeiteUncheckedCreateInput }) => ({ id: id(6), ...data })) },
    vinculoMedicaoEntradaLeite: { findMany: vi.fn(async () => [] as { medicaoId: string }[]), updateMany: vi.fn() },
    apuracaoValorLeite: { findUnique: vi.fn(async () => null), create: vi.fn(async ({ data }: { data: Prisma.ApuracaoValorLeiteUncheckedCreateInput }) => ({ id: id(8), ...data })) },
    sessaoOrdenha: { findUniqueOrThrow: vi.fn(async () => ({ id: input.sessaoId, versao: 3, nome: "Manhã", dia: { dataOperacional: new Date("2026-10-18"), participantes },
      medicoes: [{ id: id(11), estado: "MEDIDO", litros: new Prisma.Decimal(12), versao: 2, origensEstoque: [], participante: participantes[0] },
        { id: id(12), estado: "PENDENTE", litros: null, versao: 1, origensEstoque: [], participante: participantes[1] }] })) },
    medicaoGeralLeite: { findUniqueOrThrow: vi.fn() },
    produto: { findFirst: vi.fn(async () => ({ id: input.produtoId, unidade: "L", rastrearPartidas: false })) },
    movimentoEstoque: { count: vi.fn(async () => 0), create: vi.fn(async ({ data }: { data: Prisma.MovimentoEstoqueUncheckedCreateInput }) => ({ id: id(7), ...data })), update: vi.fn() },
  };
}
let tx: ReturnType<typeof banco>;
beforeEach(() => { vi.clearAllMocks(); tx = banco(); f.tx = tx as unknown as Prisma.TransactionClient; f.transacao.mockImplementation((executar: (tx: Prisma.TransactionClient) => unknown) => executar(f.tx)); });

describe("confirmar uma ordenha no estoque único", () => {
  it("segrega medições inteiras da mesma ordenha em grupos com naturezas e produtos próprios", async () => {
    const sessao = await tx.sessaoOrdenha.findUniqueOrThrow();
    sessao.medicoes[1] = { ...sessao.medicoes[1], estado: "MEDIDO", litros: new Prisma.Decimal(4) };
    tx.sessaoOrdenha.findUniqueOrThrow.mockResolvedValue(sessao);
    const primeiro = await confirmarProducaoLeite(input, contexto);
    await confirmarProducaoLeite({ ...input, chave: id(30), produtoId: id(31), medicaoIds: [id(12)], natureza: "COLOSTRO", motivoNatureza: "Colostro separado fisicamente" }, contexto);
    expect(tx.movimentoEstoque.create.mock.calls.map(c => c[0].data.quantidade.toString())).toEqual(["12", "4"]);
    expect(tx.entradaProducaoLeite.create.mock.calls.map(c => c[0].data.vinculosMedicoes)).toEqual([
      { create: [{ medicaoId: id(11), quantidade: new Prisma.Decimal(12), versaoMedicao: 2 }] },
      { create: [{ medicaoId: id(12), quantidade: new Prisma.Decimal(4), versaoMedicao: 1 }] },
    ]);
    expect(f.classificar.mock.calls.map(c => c[1].natureza)).toEqual(["COMERCIAL", "COLOSTRO"]);
    expect(primeiro.versaoSessao).toBe(3);
    expect(tx.entradaProducaoLeite.findFirst).not.toHaveBeenCalled();
  });
  it("impede reutilizar medição confirmada em qualquer produto antes da escrita física", async () => {
    tx.vinculoMedicaoEntradaLeite.findMany.mockResolvedValueOnce([{ medicaoId: id(11) }]);
    await expect(confirmarProducaoLeite({ ...input, produtoId: id(99) }, contexto)).rejects.toMatchObject({ code: "CONFLITO", campo: "medicaoIds" });
    expect(tx.vinculoMedicaoEntradaLeite.findMany).toHaveBeenCalledWith({ where: { medicaoId: { in: [id(11)] }, ativo: true }, select: { medicaoId: true } });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("recusa pendência, zero, medição estrangeira e animal excluído, sem aceitar fracionar litros", async () => {
    for (const medicaoIds of [[id(12)], [id(99)]])
      await expect(confirmarProducaoLeite({ ...input, medicaoIds }, contexto)).rejects.toMatchObject({ campo: "medicaoIds" });
    const sessao = await tx.sessaoOrdenha.findUniqueOrThrow();
    tx.sessaoOrdenha.findUniqueOrThrow.mockResolvedValueOnce({ ...sessao, medicoes: [{ ...sessao.medicoes[0], litros: new Prisma.Decimal(0) }] });
    await expect(confirmarProducaoLeite(input, contexto)).rejects.toMatchObject({ campo: "medicaoIds" });
    tx.sessaoOrdenha.findUniqueOrThrow.mockResolvedValueOnce({ ...sessao, medicoes: [{ ...sessao.medicoes[0], participante: { ...sessao.medicoes[0].participante, excluidoEm: new Date() } }] } as never);
    await expect(confirmarProducaoLeite(input, contexto)).rejects.toMatchObject({ campo: "medicaoIds" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(confirmarProducaoLeiteSchema.safeParse({ ...input, quantidadeLitros: 3 }).success).toBe(false);
    expect(confirmarProducaoLeiteSchema.safeParse({ ...input, medicaoIds: [id(11), id(11)] }).success).toBe(false);
    expect(confirmarProducaoLeiteSchema.parse({ ...input, medicaoIds: [id(12), id(11)] }).medicaoIds).toEqual([id(11), id(12)]);
  });
  it("anulação conserva histórico e libera somente as medições vinculadas à origem anulada", async () => {
    const movimento = { id: id(7), produtoId: input.produtoId, quantidade: new Prisma.Decimal(12), data: new Date("2026-10-18") };
    const origem = { id: id(6), sessaoId: input.sessaoId, movimentoId: movimento.id, status: "CONFIRMADA", movimento, alocacoes: [] };
    tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce(origem as never);
    tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValueOnce(origem);
    await anularEntradaProducaoLeite({ entradaId: origem.id, motivo: "Correção do grupo segregado" }, contexto);
    expect(tx.vinculoMedicaoEntradaLeite.updateMany).toHaveBeenCalledWith({ where: { entradaId: origem.id, ativo: true }, data: { ativo: false } });
    expect(tx.entradaProducaoLeite.update).toHaveBeenCalledWith({ where: { id: origem.id }, data: { status: "ANULADA" } });
    expect(tx.movimentoEstoque.create.mock.calls[0][0].data).toMatchObject({ reversaoDeId: movimento.id, tipo: "SAIDA" });
  });
  it("exige explicar cobertura parcial antes de criar quantidade física", async () => {
    await expect(confirmarProducaoLeite(input, contexto)).rejects.toMatchObject({ code: "VALIDACAO", campo: "motivoParcial" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(f.auditar).not.toHaveBeenCalled();
  });

  it("confirma somente os 12 litros medidos, sem valor fictício para a pendência", async () => {
    const entrada = await confirmarProducaoLeite({ ...input, motivoParcial: "Segunda vaca ainda sem medição" }, contexto);
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);
    const movimento = tx.movimentoEstoque.create.mock.calls[0][0].data;
    expect(movimento).toMatchObject({ tipo: "ENTRADA", origem: "PRODUCAO", propriedadeId: 7, custoUnitario: null, valorTotal: null, metodoValorizacao: "LEITE_FIFO_V1" });
    expect(movimento.quantidade.toString()).toBe("12");
    expect(entrada.snapshot).toMatchObject({ cobertura: { medidas: 1, pendentes: 1, esperadas: 2 }, medicoes: [{ litros: "12" }] });
    expect(f.auditar).toHaveBeenCalledTimes(1);
  });

  it("recusa natureza comercial em carência desconhecida e preserva colostro com sua evidência", async () => {
    tx.aplicacaoProduto.findMany.mockResolvedValue([{ id: id(200), animalId: id(40), data: new Date("2026-10-18"), aplicadaEm: null, precisaoTemporal: "DIA", estadoCarenciaLeite: "NAO_INFORMADO", carenciaLeiteHoras: null, aptidaoCarenciaSnapshot: "LEITE", consumoMantido: false, administracaoMantida: null }]);
    await expect(confirmarProducaoLeite({ ...input, motivoParcial: "Outra medição pendente" }, contexto)).rejects.toMatchObject({ code: "CONFLITO", campo: "natureza" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    const colostro = await confirmarProducaoLeite({ ...input, natureza: "COLOSTRO", motivoParcial: "Outra medição pendente" }, contexto);
    expect(colostro.snapshot).toMatchObject({ versao: 4, natureza: "COLOSTRO", carencia: { finalidade: "VENDA", animais: [{ estado: "NAO_AFERIVEL" }] } });
    expect(f.classificar).toHaveBeenLastCalledWith(f.tx, expect.objectContaining({ natureza: "COLOSTRO" }), contexto);
  });
  it("reenvio idêntico devolve a entrada sem reler medições nem criar estoque", async () => {
    const dados = { ...input, motivoParcial: "Medida conhecida parcialmente" };
    const entrada = await confirmarProducaoLeite(dados, contexto);
    tx.entradaProducaoLeite.findUnique.mockResolvedValueOnce(entrada as never);
    const repetida = await confirmarProducaoLeite(dados, contexto);
    expect(repetida).toEqual(entrada);
    expect(tx.sessaoOrdenha.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);
  });

  it("chave repetida com outros dados não muda volume confirmado", async () => {
    const entrada = await confirmarProducaoLeite({ ...input, motivoParcial: "Parcial comprovada" }, contexto);
    tx.entradaProducaoLeite.findUnique.mockResolvedValueOnce(entrada as never);
    await expect(confirmarProducaoLeite({ ...input, motivoParcial: "Outro motivo diferente" }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);
  });

  it("versão vencida ou sítio diferente não confirma estoque", async () => {
    await expect(confirmarProducaoLeite({ ...input, versaoEsperada: 2 }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(confirmarProducaoLeite(input, contexto)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });

  it("a guarda bloqueia a sessão confirmada e preserva a população original", async () => {
    tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce({ id: id(6) } as never);
    await expect(exigirSessaoLeiteEditavelTx(f.tx, input.sessaoId)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("não anula a origem que já financiou uma venda ou fornecimento", async () => {
    const movimento = { id: id(7), produtoId: input.produtoId, quantidade: new Prisma.Decimal(12), data: new Date("2026-10-18") };
    const entrada = { id: id(6), movimentoId: movimento.id, status: "CONFIRMADA", movimento,
      alocacoes: [{ movimento: { status: "CONFIRMADO", reversaoDeId: null } }] };
    tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce(entrada as never);
    tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValueOnce(entrada);
    await expect(anularEntradaProducaoLeite({ entradaId: entrada.id, motivo: "Correção da quantidade medida" }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(tx.entradaProducaoLeite.update).not.toHaveBeenCalled();
  });

  it("valor zero apurado exige os mesmos documentos e a API não recebe estado pendente livre", () => {
    expect(confirmarProducaoLeiteSchema.safeParse({ ...input, custoUnitario: 0 }).success).toBe(false);
    expect(apuracaoValorLeiteSchema.safeParse({ entradaId: id(6), chave: id(8), versaoEsperada: 0, valorTotal: 0 }).success).toBe(false);
    expect(apuracaoValorLeiteSchema.safeParse({ entradaId: id(6), chave: id(8), versaoEsperada: 0, valorTotal: 0, referencia: "Documento Z", evidencia: "Custo zero comprovado", motivo: "Apuração da produção" }).success).toBe(true);
    expect(classificarEntradaLeiteSchema.safeParse({ entradaId: id(6), chave: id(8), versaoEsperada: 1, natureza: "COMERCIAL", motivo: "Liberar somente uma parte", quantidadeLitros: 3 }).success).toBe(false);
  });

  it("apuração atribui R$900 à venda e R$150 ao fornecimento sem movimentar litros ou dinheiro", async () => {
    const entrada = { id: id(6), sessao: { ordem: 1 }, classificacoes: [{ id: id(90), natureza: "NAO_INFORMADA", versao: 1 }], movimento: { id: id(7), produtoId: input.produtoId, data: new Date("2026-10-18"), seq: 1, quantidade: new Prisma.Decimal(1000) },
      apuracoes: [], alocacoes: [{ id: id(20), quantidade: new Prisma.Decimal(600), valorTotal: null, movimento: { seq: 10, status: "CONFIRMADO", reversaoDeId: null, data: new Date("2026-10-18") } },
        { id: id(21), quantidade: new Prisma.Decimal(100), valorTotal: null, movimento: { seq: 11, status: "CONFIRMADO", reversaoDeId: null, data: new Date("2026-10-18") } }] };
    tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce(entrada as never);
    tx.entradaProducaoLeite.findMany.mockResolvedValueOnce([entrada]);
    const resultado = await apurarValorProducaoLeite({ entradaId: entrada.id, chave: id(99), versaoEsperada: 0, valorTotal: 1500,
      referencia: "Apuração 18/10", evidencia: "Documentos de custo com cobertura declarada", motivo: "Apuração dos custos atribuídos à ordenha" }, contexto);
    expect(resultado.valorTotal.toFixed(2)).toBe("1500.00");
    expect(tx.apuracaoValorLeite.create.mock.calls[0][0].data.apropriacoes).toMatchObject({ create: [
      { alocacaoId: id(20), valorTotal: new Prisma.Decimal(900) }, { alocacaoId: id(21), valorTotal: new Prisma.Decimal(150) },
    ] });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(tx.movimentoEstoque.update).not.toHaveBeenCalled();
    expect(f.periodo).toHaveBeenCalledTimes(4);
  });

  it("entre 21h e meia-noite da fazenda não confirma a produção de amanhã em UTC", async () => {
    const sessao = await tx.sessaoOrdenha.findUniqueOrThrow();
    tx.sessaoOrdenha.findUniqueOrThrow.mockResolvedValueOnce({ ...sessao, dia: { ...sessao.dia, dataOperacional: new Date("2026-10-20") } });
    vi.useFakeTimers().setSystemTime(new Date("2026-10-20T00:30:00Z"));
    try {
      await expect(confirmarProducaoLeite({ ...input, motivoParcial: "Confirmar volume medido" }, contexto)).rejects.toThrow(/produção futura/);
      expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});


describe("confirmação atômica da sessão", () => {
  function sessaoTresGrupos() {
    return tx.sessaoOrdenha.findUniqueOrThrow().then(sessao => {
      sessao.dia.participantes.push({ ...sessao.dia.participantes[0], id: id(60), animalId: id(61) });
      sessao.medicoes = [40, 10, 5].map((litros, i) => ({ ...sessao.medicoes[0], id: id(11 + i), litros: new Prisma.Decimal(litros), participante: sessao.dia.participantes[i] }));
      tx.sessaoOrdenha.findUniqueOrThrow.mockResolvedValue(sessao);
      return { sessaoId: input.sessaoId, versaoEsperada: input.versaoEsperada, chave: id(90), grupos: ["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"].map((natureza, i) => ({ produtoId: input.produtoId, chave: id(91 + i), medicaoIds: [id(11 + i)], natureza: natureza as "COMERCIAL" | "COLOSTRO" | "NAO_COMERCIAL", motivoNatureza: "Separado por natureza na origem" })) };
    });
  }
  it("registra 40 L comerciais, 10 L não comerciais e 5 L colostro com uma requisição idempotente", async () => {
    const dados = await sessaoTresGrupos();
    tx.entradaProducaoLeite.create.mockImplementation(async ({ data }) => ({ ...data, id: id(tx.entradaProducaoLeite.create.mock.calls.length + 100), movimento: { quantidade: tx.movimentoEstoque.create.mock.calls.at(-1)![0].data.quantidade } }) as never);
    const resultado = await confirmarSessaoProducaoLeite(dados, contexto);
    expect(f.transacao).toHaveBeenCalledTimes(1);
    expect(resultado.grupos.map(g => g.quantidadeLitros)).toEqual(["40", "10", "5"]);
    expect(f.classificar.mock.calls.map(c => c[1].natureza)).toEqual(["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"]);
    expect(tx.requisicaoPecuaria.create).toHaveBeenCalledTimes(1);
    const identidade = tx.requisicaoPecuaria.create.mock.calls[0][0].data;
    tx.requisicaoPecuaria.findUnique.mockResolvedValueOnce(identidade as never);
    expect(await confirmarSessaoProducaoLeite(dados, contexto)).toEqual(resultado);
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(3);
  });
  it("não aceita medição em dois grupos, omissão de medição positiva ou versão antiga", async () => {
    const dados = await sessaoTresGrupos();
    expect(confirmarSessaoProducaoLeiteSchema.safeParse({ ...dados, grupos: [dados.grupos[0], { ...dados.grupos[1], medicaoIds: dados.grupos[0].medicaoIds }] }).success).toBe(false);
    await expect(confirmarSessaoProducaoLeite({ ...dados, grupos: dados.grupos.slice(0, 2) }, contexto)).rejects.toMatchObject({ campo: "grupos" });
    await expect(confirmarSessaoProducaoLeite({ ...dados, versaoEsperada: 2 }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("propaga falha do segundo grupo para a transação chamadora sem registrar sucesso da requisição", async () => {
    const dados = await sessaoTresGrupos();
    tx.entradaProducaoLeite.create.mockImplementation(async ({ data }) => ({ ...data, id: id(100), movimento: { quantidade: new Prisma.Decimal(40) } }) as never);
    f.classificar.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Falha no segundo grupo"));
    await expect(confirmarSessaoProducaoLeite(dados, contexto)).rejects.toThrow("Falha no segundo grupo");
    expect(tx.requisicaoPecuaria.create).not.toHaveBeenCalled();
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(2);
    // O mock prova propagação no mesmo callback; rollback real exige PostgreSQL.
  });
});


describe("contrato de correção comercial", () => {
  const dados = { operacaoId: id(1), versaoEsperada: 1, chave: id(2), motivo: "Preço definitivo retificado", parceiroId: id(3), valorTotal: 250, financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } };
  it("não aceita alterar litros, produto ou data da retirada pelo contrato público", () => {
    expect(correcaoVendaLeiteSchema.safeParse(dados).success).toBe(true);
    for (const extra of [{ quantidadeLitros: 55 }, { produtoId: id(9) }, { data: "2026-10-19" }])
      expect(correcaoVendaLeiteSchema.safeParse({ ...dados, ...extra }).success).toBe(false);
  });
  it("consulta rejeita datas inexistentes, intervalo inverso e paginação excessiva", () => {
    for (const dados of [{ de: "2026-02-30" }, { de: "2026-10-20", ate: "2026-10-19" }, { pagina: 100001 }])
      expect(consultaVendasLeiteSchema.safeParse(dados).success).toBe(false);
    expect(consultaVendasLeiteSchema.parse({ de: "2024-02-29" })).toMatchObject({ pagina: 1, porPagina: 20 });
  });
});

describe("finalidade no lastro físico", () => {
  it.each(["CORTE", "REPRODUCAO"])("recusa %s em confirmação individual e coletiva antes do estoque", async aptidao => {
    const finalidades = await tx.finalidadeAnimal.findMany();
    tx.finalidadeAnimal.findMany.mockResolvedValue(finalidades.map(f => ({ ...f, aptidao })));
    await expect(confirmarProducaoLeite({ ...input, motivoParcial: "Volume parcial conferido" }, contexto)).rejects.toMatchObject({ campo: "finalidade" });
    await expect(confirmarSessaoProducaoLeite({ chave: id(600), sessaoId: input.sessaoId, versaoEsperada: 3, motivoParcial: "Volume parcial conferido", grupos: [{ chave: id(601), produtoId: input.produtoId, medicaoIds: input.medicaoIds, natureza: "COMERCIAL", motivoNatureza: input.motivoNatureza }] }, contexto)).rejects.toMatchObject({ campo: "finalidade" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("preserva retry concluído após mudança posterior de finalidade e mantém ordem dos locks", async () => {
    const dados = { ...input, motivoParcial: "Volume parcial conferido" };
    const entrada = await confirmarProducaoLeite(dados, contexto);
    expect(tx.participanteProducaoLeite.findMany.mock.invocationCallOrder[0]).toBeLessThan(tx.sessaoOrdenha.findUniqueOrThrow.mock.invocationCallOrder[0]);
    const leituras = tx.finalidadeAnimal.findMany.mock.calls.length;
    tx.entradaProducaoLeite.findUnique.mockResolvedValueOnce(entrada as never);
    tx.finalidadeAnimal.findMany.mockResolvedValue([]);
    expect(await confirmarProducaoLeite(dados, contexto)).toEqual(entrada);
    expect(tx.finalidadeAnimal.findMany.mock.calls.length).toBe(leituras);
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);
  });
  it("evidência legada ausente mantém a medição mas bloqueia uma nova origem", async () => {
    const sessao = await tx.sessaoOrdenha.findUniqueOrThrow();
    sessao.medicoes[0].participante.finalidadeSnapshot.regra = "LEGADO";
    tx.sessaoOrdenha.findUniqueOrThrow.mockResolvedValue(sessao);
    await expect(confirmarProducaoLeite({ ...input, motivoParcial: "Volume parcial conferido" }, contexto)).rejects.toMatchObject({ campo: "finalidade" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
});

it("a baixa no dia preserva confirmação single e coletiva da finalidade que ela fechou", async () => {
  const dados = { ...input, motivoParcial: "Volume parcial conferido" };
  const finalidades = await tx.finalidadeAnimal.findMany();
  tx.finalidadeAnimal.findMany.mockResolvedValue(finalidades.map(f => ({ ...f, ate: new Date("2026-10-18") })));
  tx.baixaAnimal.findMany.mockResolvedValue(finalidades.map(f => ({ id: `baixa-${f.animalId}`, animalId: f.animalId, destinoFechadoId: f.id, data: new Date("2026-10-18") })));
  tx.entradaProducaoLeite.create.mockImplementation(async ({ data }) => ({ id: id(6), ...data, movimento: { quantidade: new Prisma.Decimal(12) } }));
  const individual = await confirmarProducaoLeite(dados, contexto);
  expect(individual.movimentoId).toBeDefined();
  const coletiva = await confirmarSessaoProducaoLeite({ chave: id(700), sessaoId: input.sessaoId, versaoEsperada: 3, motivoParcial: dados.motivoParcial,
    grupos: [{ chave: id(701), produtoId: input.produtoId, medicaoIds: input.medicaoIds, natureza: "COMERCIAL", motivoNatureza: input.motivoNatureza }] }, contexto);
  expect(coletiva.grupos).toHaveLength(1);
});

it("confirma litros gerais uma vez, sem vínculos individuais ou custo inventado", async () => {
  const medicao = { id: id(70), sessaoId: input.sessaoId, tanqueId: id(71), versao: 1, litros: new Prisma.Decimal(800), reguaMm: null, origemLitros: "LITROS_INFORMADOS", animaisOrigem: [], natureza: "NAO_COMERCIAL", tanque: { nome: "Tanque" }, sessao: { id: input.sessaoId, nome: "Manhã", horario: null, versao: 3, dia: { dataOperacional: new Date("2026-10-18"), configuracao: { fonteProducao: "GERAL" } } }, entradasEstoque: [] as {id: string}[] };
  const medicoes = { findMany: vi.fn(async () => [medicao]), findFirst: vi.fn(async () => medicao), findFirstOrThrow: vi.fn(async () => medicao) };
  Object.assign(tx, { medicaoGeralLeite: medicoes });
  const comando = { chave: id(72), medicaoId: medicao.id, versaoEsperada: 1, produtoId: input.produtoId, motivoNatureza: "Leite separado para alimentação" };
  const r = await confirmarProducaoGeral(comando, contexto);
  expect(r.quantidadeLitros).toBe("800");
  expect(tx.movimentoEstoque.create).toHaveBeenCalledWith({ data: expect.objectContaining({ quantidade: new Prisma.Decimal(800), custoUnitario: null, valorTotal: null }) });
  const entrada = tx.entradaProducaoLeite.create.mock.calls[0][0].data;
  expect(entrada.medicaoGeralId).toBe(medicao.id);
  expect(entrada.vinculosMedicoes).toBeUndefined();
  medicao.entradasEstoque = [{ id: r.id }];
  await expect(confirmarProducaoGeral({ ...comando, chave: id(73) }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
  expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(1);
});
it("controle individual de data geral não gera uma segunda produção física", async () => {
  const sessao = await tx.sessaoOrdenha.findUniqueOrThrow();
  tx.sessaoOrdenha.findUniqueOrThrow.mockResolvedValue({ ...sessao, dia: { ...sessao.dia, configuracao: { fonteProducao: "GERAL" } } } as never);
  await expect(confirmarProducaoLeite({ ...input, motivoParcial: "Controle mensal" }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
  expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
});


describe("ordem das travas ao anular origem geral", () => {
  const origem = (numero: number, animaisOrigem: string[]) => ({
    id: id(numero), sessaoId: id(numero + 1), medicaoGeralId: id(numero + 2), movimentoId: id(numero + 3),
    status: "CONFIRMADA", medicaoGeral: { animaisOrigem }, alocacoes: [],
    movimento: { id: id(numero + 3), produtoId: input.produtoId, quantidade: new Prisma.Decimal(12), data: new Date("2026-10-18") },
  });
  it("duas aferições com animal compartilhado adquirem animal antes de sessão e produto", async () => {
    const primeira = origem(700, [id(40), id(50)]), segunda = origem(800, [id(40), id(60)]);
    for (const entrada of [primeira, segunda]) {
      tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce(entrada as never);
      tx.medicaoGeralLeite.findUniqueOrThrow.mockResolvedValueOnce(entrada.medicaoGeral);
      tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValueOnce(entrada);
      await anularEntradaProducaoLeite({ entradaId: entrada.id, motivo: "Origem conferida" }, contexto);
    }
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    for (const indice of [0, 1]) {
      expect(tx.$executeRaw.mock.calls[indice][1]).toContain(`pec-animal:${id(40)}`);
      expect(tx.$executeRaw.mock.invocationCallOrder[indice]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[indice]);
      expect(tx.$queryRaw.mock.invocationCallOrder[indice]).toBeLessThan(vi.mocked(travarValorizacaoTx).mock.invocationCallOrder[indice]);
    }
    expect(tx.entradaProducaoLeite.update).toHaveBeenCalledTimes(2);
    // Prova da ordem sequencial dos comandos; não representa concorrência PostgreSQL real.
  });
  it("revalida a composição antes de criar inverso quando a referência ficou obsoleta", async () => {
    const entrada = origem(700, [id(40)]);
    tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce(entrada as never);
    tx.medicaoGeralLeite.findUniqueOrThrow.mockResolvedValueOnce(entrada.medicaoGeral);
    tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValueOnce({ ...entrada, medicaoGeral: { animaisOrigem: [id(50)] } });
    await expect(anularEntradaProducaoLeite({ entradaId: entrada.id, motivo: "Origem conferida" }, contexto)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(tx.entradaProducaoLeite.update).not.toHaveBeenCalled();
  });
  it("reenvio da anulação geral recupera o inverso sem segunda saída", async () => {
    const entrada = origem(700, [id(40)]), motivo = "Origem conferida";
    const inverso = { id: id(900), observacao: motivo, criadoPorId: contexto.usuarioId };
    tx.entradaProducaoLeite.findFirst.mockResolvedValueOnce(entrada as never);
    tx.medicaoGeralLeite.findUniqueOrThrow.mockResolvedValueOnce(entrada.medicaoGeral);
    tx.entradaProducaoLeite.findUniqueOrThrow.mockResolvedValueOnce({ ...entrada, status: "ANULADA", movimento: { ...entrada.movimento, revertidoPor: inverso } });
    await expect(anularEntradaProducaoLeite({ entradaId: entrada.id, motivo }, contexto)).resolves.toEqual(inverso);
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(tx.entradaProducaoLeite.update).not.toHaveBeenCalled();
  });
});

describe("confirmação geral por conjunto", () => {
  const comando = { chave: id(920), parcelas: [1, 2, 3].map(n => ({ chave: id(920 + n), medicaoId: id(930 + n), versaoEsperada: 1, produtoId: input.produtoId, motivoNatureza: "Leite segregado na origem física" })) };
  function preparar() {
    const medicoes = comando.parcelas.map((p, i) => ({ id: p.medicaoId, sessaoId: input.sessaoId, tanqueId: id(950 + i), recipiente: null, versao: 1,
      litros: new Prisma.Decimal([40, 10, 5][i]), reguaMm: null, origemLitros: "LITROS_INFORMADOS", animaisOrigem: [], natureza: ["NAO_COMERCIAL", "COLOSTRO", "NAO_COMERCIAL"][i],
      tanque: { nome: `Tanque ${i}` }, sessao: { id: input.sessaoId, nome: "Manhã", horario: null, versao: 3, dia: { dataOperacional: new Date("2026-10-18"), configuracao: { fonteProducao: "GERAL" } } }, entradasEstoque: [] }));
    const medicoesTx = { findMany: vi.fn(async () => medicoes), findFirstOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => medicoes.find(m => m.id === where.id)) };
    Object.assign(tx, { medicaoGeralLeite: medicoesTx });
    tx.entradaProducaoLeite.create.mockImplementation(async ({ data }) => ({ ...data, id: id(970 + tx.entradaProducaoLeite.create.mock.calls.length) }));
    return { medicoes, medicoesTx };
  }
  it("confirma todas as parcelas na mesma transação e recupera reenvio integral sem nova entrada", async () => {
    preparar();
    const r = await confirmarParcelasOrdenha(comando, contexto);
    expect(r.entradas.map(e => e.quantidadeLitros)).toEqual(["40", "10", "5"]);
    expect(f.transacao).toHaveBeenCalledTimes(1);
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(3);
    const requisicao = tx.requisicaoPecuaria.create.mock.calls.at(-1)![0].data;
    tx.requisicaoPecuaria.findUnique.mockResolvedValueOnce(requisicao as never);
    expect(await confirmarParcelasOrdenha(comando, contexto)).toEqual(r);
    expect(tx.movimentoEstoque.create).toHaveBeenCalledTimes(3);
    expect(tx.$executeRaw.mock.calls[0][1]).toEqual(expect.arrayContaining([`pec-requisicao:${comando.chave}`, `pec-requisicao:${comando.parcelas[0].chave}`]));
  });
  it("falha de uma parcela recusa o callback do conjunto sem registrar sucesso do lote", async () => {
    preparar();
    f.classificar.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Falha na segunda parcela"));
    await expect(confirmarParcelasOrdenha(comando, contexto)).rejects.toThrow("Falha na segunda parcela");
    expect(f.transacao).toHaveBeenCalledTimes(1);
    expect(tx.requisicaoPecuaria.create.mock.calls.some(c => (c[0].data as { chave: string }).chave === comando.chave)).toBe(false);
    // A rejeição prova o limite transacional. Rollback e disputa real dependem do PostgreSQL autorizado.
  });
  it("confere todos os IDs no sítio e a identidade de sessão antes de mover estoque", async () => {
    const { medicoes, medicoesTx } = preparar();
    medicoesTx.findMany.mockResolvedValueOnce(medicoes.slice(0, 2));
    await expect(confirmarParcelasOrdenha(comando, contexto)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    medicoesTx.findMany.mockResolvedValueOnce([{ ...medicoes[0], sessaoId: id(999) }, ...medicoes.slice(1)]);
    await expect(confirmarParcelasOrdenha(comando, contexto)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
  it("carência comercial continua recusada e parcela zero não gera origem", async () => {
    const { medicoes } = preparar();
    medicoes[0].natureza = "COMERCIAL";
    await expect(confirmarParcelasOrdenha(comando, contexto)).rejects.toThrow("carências");
    medicoes[0].natureza = "NAO_COMERCIAL"; medicoes[0].litros = new Prisma.Decimal(0);
    await expect(confirmarParcelasOrdenha(comando, contexto)).rejects.toThrow("zero");
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
});
