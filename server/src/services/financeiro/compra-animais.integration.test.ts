// Compra e devolução de animais contra o PostgreSQL: operação financeira e Rebanho no mesmo commit.
// Só roda com FINANCE_DB_INTEGRATION=1 e PECUARIA_DB_INTEGRATION=1 (o CI liga), no banco permitido
// por `exigirBancoIntegracaoPecuaria`. Cada execução cria os próprios sítios, fornecedor, conta,
// centro e animais, e o afterAll apaga tudo em ordem segura de FK.
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../lib/banco-pecuaria-integration.fixture.js";
import { cadastrar, darBaixa, estornarBaixa } from "../pecuaria/rebanho/animais.js";
import { hojeFazenda } from "../pecuaria/rebanho/regras.js";
import { criarOperacao, estornarOperacao, obterOperacao } from "./operacoes.js";
import { confirmarRascunho } from "./rascunhos.js";
import { operacaoSchema } from "./schemas.js";

const comBanco = process.env.FINANCE_DB_INTEGRATION === "1" && process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const RUN = crypto.randomUUID().slice(0, 8);
const HOJE = hojeFazenda();
const sitios: number[] = [];
const parceiros: string[] = [];
const centros: string[] = [];
const usuarios: number[] = [];
let sitio: number, fornecedor: string, outroFornecedor: string, conta: string, centro: string, usuario: number;
let seq = 0;

const brinco = () => `CA${RUN}${++seq}`;
const animal = (extra: Record<string, unknown> = {}) => ({
  brinco: brinco(), sexo: "F", dataNascimento: "2024-03-01", aptidao: "CORTE", pesoEntradaKg: 300, ...extra,
});
const itemAnimal = (pesoPago: number, precoKg: number, extra: Record<string, unknown> = {}) => ({
  descricao: "Novilha", quantidade: pesoPago, unidade: "kg", valorTotal: Math.round(pesoPago * precoKg * 100) / 100, animal: animal(extra),
});

/** Entrada como o formulário a envia (e como o rascunho a guarda), antes do parse do schema. */
const compraBruta = (itens: unknown[], extra: Record<string, unknown> = {}) => ({
  tipo: "COMPRA_ANIMAIS", data: HOJE, descricao: `Compra de animais ${RUN}`, parceiroId: fornecedor, centroCustoId: centro,
  itens, financeiro: { condicao: "A_VISTA", contaId: conta }, ...extra,
});

function compra(itens: unknown[], extra: Record<string, unknown> = {}) {
  return { ...operacaoSchema.parse(compraBruta(itens, extra)), propriedadeId: sitio };
}

const devolucao = (animalId: string, valorTotal: number, parceiroId = fornecedor) => ({ ...operacaoSchema.parse({
  tipo: "DEVOLUCAO", data: HOJE, descricao: "Devolução ao vendedor", parceiroId, centroCustoId: centro,
  itens: [{ descricao: "Novilha devolvida", quantidade: 1, unidade: "cab", valorTotal, animalId }],
  financeiro: { condicao: "A_VISTA", contaId: conta },
}), propriedadeId: sitio });

async function baixaAtiva(animalId: string) {
  return prisma.baixaAnimal.findFirst({ where: { animalId, estornadaEm: null }, select: { tipo: true } });
}

beforeAll(async () => {
  if (process.env.FINANCE_DB_INTEGRATION !== "1" || process.env.PECUARIA_DB_INTEGRATION !== "1") return;
  exigirBancoIntegracaoPecuaria();
  sitio = (await prisma.propriedade.create({ data: { nome: `Compra animais ${RUN}` } })).id; sitios.push(sitio);
  fornecedor = (await prisma.parceiro.create({ data: { nome: `Vendedor ${RUN}`, tipo: "FORNECEDOR", papeis: { create: { papel: "FORNECEDOR" } } } })).id;
  outroFornecedor = (await prisma.parceiro.create({ data: { nome: `Outro vendedor ${RUN}`, tipo: "FORNECEDOR", papeis: { create: { papel: "FORNECEDOR" } } } })).id;
  parceiros.push(fornecedor, outroFornecedor);
  conta = (await prisma.contaFinanceira.create({ data: { nome: `Banco ${RUN}`, tipo: "BANCO", propriedadeId: sitio, saldoAbertura: 100_000, dataSaldoAbertura: new Date("2026-01-01") } })).id;
  centro = (await prisma.centroCusto.create({ data: { nome: `Rebanho ${RUN}` } })).id; centros.push(centro);
  usuario = (await prisma.usuario.create({ data: { nome: `Compra animais ${RUN}`, email: `compra-animais-${RUN}@example.invalid`, papel: "proprietario", abas: ["cadastros"], areas: ["financeiro", "pecuaria"], flags: ["lancar", "verValores"], status: "ATIVO" } })).id; usuarios.push(usuario);
});

afterAll(async () => {
  if (!sitios.length) return;
  const propriedadeId = { in: sitios };
  const operacoes = (await prisma.operacao.findMany({ where: { propriedadeId }, select: { id: true } })).map((o) => o.id);
  const animais = (await prisma.animal.findMany({ where: { localizacoes: { some: { propriedadeId } } }, select: { id: true } })).map((a) => a.id);
  const animalId = { in: animais };
  await prisma.rascunhoOperacao.deleteMany({ where: { propriedadeId } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: operacoes } } });
  await prisma.liquidacao.deleteMany({ where: { transacao: { propriedadeId } } });
  await prisma.movimentoConta.deleteMany({ where: { transacao: { propriedadeId } } });
  await prisma.transacaoFinanceira.deleteMany({ where: { reversaoDeId: { not: null }, propriedadeId } });
  await prisma.transacaoFinanceira.deleteMany({ where: { propriedadeId } });
  await prisma.compromissoFinanceiro.deleteMany({ where: { operacao: { propriedadeId } } });
  await prisma.itemOperacao.deleteMany({ where: { operacao: { propriedadeId } } });
  await prisma.operacao.deleteMany({ where: { corrigeOperacaoId: { not: null }, propriedadeId } });
  await prisma.operacao.deleteMany({ where: { propriedadeId } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ animalId }, { entidadeId: { in: animais } }] } });
  await prisma.baixaAnimal.deleteMany({ where: { animalId } });
  await prisma.localizacaoAnimal.deleteMany({ where: { OR: [{ animalId }, { propriedadeId }] } });
  await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId } });
  await prisma.finalidadeAnimal.deleteMany({ where: { animalId } });
  await prisma.pesagem.deleteMany({ where: { animalId } });
  await prisma.composicaoRacial.deleteMany({ where: { animalId } });
  await prisma.animal.deleteMany({ where: { id: animalId } });
  await prisma.contaFinanceira.deleteMany({ where: { propriedadeId } });
  await prisma.centroCusto.deleteMany({ where: { id: { in: centros } } });
  await prisma.parceiroPapel.deleteMany({ where: { parceiroId: { in: parceiros } } });
  await prisma.parceiro.deleteMany({ where: { id: { in: parceiros } } });
  await prisma.propriedade.deleteMany({ where: { id: propriedadeId } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
});

comBanco("compra de animais — PostgreSQL", () => {
  it("confirma operação, itens, pagamento e animais no mesmo commit, sem estoque", async () => {
    const frete = { descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 300 };
    const operacao = await criarOperacao(compra([itemAnimal(312.5, 12), itemAnimal(298, 12), frete]));
    const detalhe = await obterOperacao(operacao.id, sitio);
    expect(detalhe.tipo).toBe("COMPRA_ANIMAIS");
    expect(detalhe.valorTotal.toString()).toBe("7626");
    expect(detalhe.movimentosEstoque).toEqual([]);
    expect(detalhe.transacoes).toHaveLength(1);
    const deAnimal = detalhe.itens.filter((item) => item.animalId);
    expect(deAnimal).toHaveLength(2);
    expect(detalhe.itens.find((item) => item.descricao === "Frete")?.animalId).toBeNull();
    for (const item of deAnimal) {
      const registro = await prisma.animal.findUniqueOrThrow({ where: { id: item.animalId! }, include: { localizacoes: true, pesagens: true } });
      expect(registro.origem).toBe("COMPRADO");
      expect(registro.dataEntrada.toISOString().slice(0, 10)).toBe(HOJE);
      expect(registro.localizacoes[0]?.propriedadeId).toBe(sitio);
      expect(registro.pesagens.map((p) => [p.tipo, p.pesoKg.toString()])).toEqual([["ENTRADA", "300"]]);
      expect(item.animal?.brinco).toBe(registro.brinco);
    }
  });

  it("brinco já ativo no sítio desfaz tudo: nenhuma operação nem animal", async () => {
    const existente = await cadastrar({ brinco: brinco(), sexo: "F", dataNascimento: "2024-01-01", nascimentoEstimado: false, origem: "COMPRADO", dataEntrada: HOJE,
      partosAntesDaEntrada: 0, propriedadeId: sitio, aptidao: "CORTE", composicao: [] }, null);
    const antes = await prisma.operacao.count({ where: { propriedadeId: sitio } });
    const animaisAntes = await prisma.animal.count({ where: { localizacoes: { some: { propriedadeId: sitio } } } });
    const repetido = itemAnimal(300, 10, { brinco: existente.brinco });
    await expect(criarOperacao(compra([itemAnimal(300, 10), repetido]))).rejects.toMatchObject({ campo: "itens.1.animal.brinco" });
    expect(await prisma.operacao.count({ where: { propriedadeId: sitio } })).toBe(antes);
    expect(await prisma.animal.count({ where: { localizacoes: { some: { propriedadeId: sitio } } } })).toBe(animaisAntes);
  });

  it("reenvio da mesma chave devolve a mesma operação sem cadastrar de novo", async () => {
    const entrada = compra([itemAnimal(300, 10)], { chave: crypto.randomUUID() });
    const primeira = await criarOperacao(entrada);
    const segunda = await criarOperacao(entrada);
    expect(segunda.id).toBe(primeira.id);
    expect(await prisma.itemOperacao.count({ where: { operacaoId: primeira.id } })).toBe(1);
  });

  it("devolução parcial, estorno total e correção preservam os registros dos animais", async () => {
    const operacao = await criarOperacao(compra([itemAnimal(300, 10), itemAnimal(310, 10), itemAnimal(320, 10)]));
    const ids = (await prisma.itemOperacao.findMany({ where: { operacaoId: operacao.id }, orderBy: { ordem: "asc" } })).map((item) => item.animalId!);

    const devolucaoEntrada = (parceiroId: string) => devolucao(ids[0], 3000, parceiroId);
    await expect(criarOperacao(devolucaoEntrada(outroFornecedor))).rejects.toMatchObject({ campo: "parceiroId" });
    const feita = await criarOperacao(devolucaoEntrada(fornecedor));
    expect(await baixaAtiva(ids[0])).toMatchObject({ tipo: "COMPRA_ESTORNADA" });
    expect(await baixaAtiva(ids[1])).toBeNull();
    await expect(criarOperacao(devolucaoEntrada(fornecedor))).rejects.toMatchObject({ code: "CONFLITO", campo: "itens.0.animalId" });
    // Animal de compra ativa não sai por "excluir cadastro": a saída passa pelo Financeiro.
    await expect(darBaixa({ animalId: ids[2], data: HOJE, tipo: "CADASTRO_INDEVIDO", motivoId: null, observacao: "Teste" }, null)).rejects.toMatchObject({ code: "CONFLITO" });

    // A baixa da devolução só se desfaz pela operação.
    await expect(estornarBaixa(ids[0], { motivo: "Tentativa manual" }, null)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(estornarOperacao(operacao.id, "Compra lançada errada", { propriedadeId: sitio })).rejects.toMatchObject({ code: "CONFLITO" });

    await estornarOperacao(feita.id, "Animal ficou na fazenda", { propriedadeId: sitio });
    expect(await baixaAtiva(ids[0])).toBeNull();

    await prisma.pesagem.create({ data: { animalId: ids[1], data: new Date(HOJE), pesoKg: 315, tipo: "ROTINA", origem: "MANUAL" } });
    await estornarOperacao(operacao.id, "Compra lançada com preço errado", { propriedadeId: sitio });
    for (const id of ids) expect(await baixaAtiva(id)).toMatchObject({ tipo: "COMPRA_ESTORNADA" });
    expect(await prisma.pesagem.count({ where: { animalId: ids[1] } })).toBe(2);

    const correcao = (animalIds: string[]) => ({ ...operacaoSchema.parse({
      tipo: "COMPRA_ANIMAIS", data: HOJE, descricao: "Compra corrigida", parceiroId: fornecedor, centroCustoId: centro, corrigeOperacaoId: operacao.id,
      itens: animalIds.map((animalId) => ({ descricao: "Novilha", quantidade: 1, unidade: "cab", valorTotal: 3200, animalId })),
      financeiro: { condicao: "A_PRAZO", parcelas: [{ valor: 3200 * animalIds.length, dataVencimento: new Date("2026-12-31") }] },
    }), propriedadeId: sitio });
    await expect(criarOperacao(correcao(ids.slice(0, 2)))).rejects.toMatchObject({ code: "CONFLITO", campo: "itens" });
    const corrigida = await criarOperacao(correcao(ids));
    expect(corrigida.corrigeOperacaoId).toBe(operacao.id);
    await expect(criarOperacao(correcao(ids))).rejects.toMatchObject({ code: "CONFLITO", campo: "itens.0.animalId" });
    for (const id of ids) expect(await baixaAtiva(id)).toBeNull();
  });

  it("o banco recusa o mesmo animal em duas compras ativas", async () => {
    const operacao = await criarOperacao(compra([itemAnimal(300, 10)]));
    const item = await prisma.itemOperacao.findFirstOrThrow({ where: { operacaoId: operacao.id } });
    const outra = await criarOperacao(compra([itemAnimal(300, 10)]));
    await expect(prisma.itemOperacao.create({ data: {
      operacaoId: outra.id, ordem: 99, descricao: "Duplicado", quantidade: 1, unidade: "cab", valorUnitario: 1, valorTotal: 1, animalId: item.animalId,
    } })).rejects.toBeTruthy();
  });

  it("compra de 200 animais (o limite) confirma e cadastra os 200 no mesmo commit", async () => {
    const itens = Array.from({ length: 200 }, () => ({ descricao: "Novilha", quantidade: 1, unidade: "cab", valorTotal: 100, animal: animal() }));
    const operacao = await criarOperacao(compra(itens));
    const vinculados = (await prisma.itemOperacao.findMany({ where: { operacaoId: operacao.id, animalId: { not: null } }, select: { animalId: true } })).map((item) => item.animalId!);
    expect(vinculados).toHaveLength(200);
    expect(await prisma.animal.count({ where: { id: { in: vinculados }, origem: "COMPRADO" } })).toBe(200);
    expect(await prisma.localizacaoAnimal.count({ where: { animalId: { in: vinculados }, propriedadeId: sitio } })).toBe(200);
    expect(operacao.valorTotal.toString()).toBe("20000");
  }, 180_000);

  it("rascunho de compra de animais: confirma e cadastra; sem acesso à Pecuária é recusado sem gravar nada", async () => {
    const rascunho = await prisma.rascunhoOperacao.create({ data: { propriedadeId: sitio, criadoPorId: usuario, dados: JSON.parse(JSON.stringify({ operacao: compraBruta([itemAnimal(300, 10), itemAnimal(310, 10)]) })) } });
    const contagens = async () => [
      await prisma.operacao.count({ where: { propriedadeId: sitio } }),
      await prisma.animal.count({ where: { localizacoes: { some: { propriedadeId: sitio } } } }),
    ];
    const antes = await contagens();

    await expect(confirmarRascunho(sitio, usuario, undefined, undefined, { permitirAnimais: false })).rejects.toMatchObject({ code: "CONFLITO" });
    // Leitura prévia desatualizada (dizia "sem animais"): a conferência dentro da transação recusa.
    await expect(confirmarRascunho(sitio, usuario, undefined, undefined, { previa: { envolveAnimais: false, animais: 0 } })).rejects.toMatchObject({ code: "CONFLITO" });
    expect(await contagens()).toEqual(antes);
    expect(await prisma.rascunhoOperacao.count({ where: { id: rascunho.id } })).toBe(1);

    const confirmada = await confirmarRascunho(sitio, usuario, undefined, undefined, { permitirAnimais: true, previa: { envolveAnimais: true, animais: 2 } });
    expect(confirmada.tipo).toBe("COMPRA_ANIMAIS");
    const vinculados = confirmada.itens.filter((item) => item.animalId);
    expect(vinculados).toHaveLength(2);
    expect(await contagens()).toEqual([antes[0] + 1, antes[1] + 2]);
    expect(await prisma.animal.count({ where: { id: { in: vinculados.map((item) => item.animalId!) }, origem: "COMPRADO", criadoPorId: usuario } })).toBe(2);
    expect(await prisma.rascunhoOperacao.count({ where: { id: rascunho.id } })).toBe(0);
  });

  it("detalhe da compra traz o resumo do animal e a situação: ativo, devolvido e compra estornada", async () => {
    const operacao = await criarOperacao(compra([itemAnimal(300, 10, { sexo: "M" }), itemAnimal(300, 10)]));
    const ids = (await prisma.itemOperacao.findMany({ where: { operacaoId: operacao.id }, orderBy: { ordem: "asc" } })).map((item) => item.animalId!);
    const situacoes = async () => (await obterOperacao(operacao.id, sitio)).itens.map((item) => item.animal?.situacao);

    const inicial = await obterOperacao(operacao.id, sitio);
    expect(inicial.itens[0].animal).toMatchObject({ id: ids[0], sexo: "M", aptidao: "CORTE", rotuloComposicao: "Desconhecida", situacao: { baixa: null, devolucao: null } });
    expect(inicial.itens[1].animal).toMatchObject({ sexo: "F" });
    expect(await situacoes()).toEqual([{ baixa: null, devolucao: null }, { baixa: null, devolucao: null }]);

    const feita = await criarOperacao(devolucao(ids[0], 3000));
    const [devolvido, ativo] = await situacoes();
    expect(devolvido).toMatchObject({ baixa: { tipo: "COMPRA_ESTORNADA" }, devolucao: { id: feita.id, numero: feita.numero } });
    expect(ativo).toEqual({ baixa: null, devolucao: null });

    await estornarOperacao(feita.id, "Animal ficou na fazenda", { propriedadeId: sitio });
    await estornarOperacao(operacao.id, "Compra lançada errada", { propriedadeId: sitio });
    expect(await situacoes()).toEqual([
      { baixa: expect.objectContaining({ tipo: "COMPRA_ESTORNADA" }), devolucao: null },
      { baixa: expect.objectContaining({ tipo: "COMPRA_ESTORNADA" }), devolucao: null },
    ]);
  });

  it("devolução não passa do valor pago na compra, nem com desconto comercial", async () => {
    // 300 kg a R$ 10 = R$ 3.000, menos R$ 300 de desconto = R$ 2.700 pagos pela cabeça.
    const operacao = await criarOperacao(compra([itemAnimal(300, 10)], { descontoComercial: 300 }));
    const item = await prisma.itemOperacao.findFirstOrThrow({ where: { operacaoId: operacao.id } });
    expect(item.valorTotal.toString()).toBe("2700");

    const baixas = await prisma.baixaAnimal.count({ where: { animalId: item.animalId! } });
    await expect(criarOperacao(devolucao(item.animalId!, 2700.01))).rejects.toMatchObject({
      code: "VALIDACAO", campo: "itens.0.valorTotal", message: "O valor devolvido não pode passar do valor pago (R$ 2.700,00)",
    });
    expect(await prisma.baixaAnimal.count({ where: { animalId: item.animalId! } })).toBe(baixas);
    await expect(criarOperacao(devolucao(item.animalId!, 2700))).resolves.toMatchObject({ tipo: "DEVOLUCAO" });
  });
});
