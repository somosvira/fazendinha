import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { anularAplicacao, criarAplicacao, reconciliarOrigem } from "./aplicacoes.js";
import { obterAplicacao, ocultarCustosDetalhe } from "./detalhes.js";
import { listarMovimentos, listarSaldos } from "../../estoque/estoque.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const ontem = new Date(Date.parse(hojeFazenda()) - 86400000).toISOString().slice(0, 10);
const ids = { sitio: 0, animal: "", produto: "", operacao: "", item: "" };

afterAll(async () => {
  if (!ids.sitio) return;
  const movimentos = await prisma.movimentoEstoque.findMany({ where: { produtoId: ids.produto }, select: { id: true } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { animalId: ids.animal } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: ids.animal } });
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: ids.sitio } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: [...movimentos.map((m) => m.id), ids.operacao] } } });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: ids.produto } });
  await prisma.operacao.deleteMany({ where: { id: ids.operacao } });
  await prisma.produto.deleteMany({ where: { id: ids.produto } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: ids.animal } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: ids.animal } });
  await prisma.animal.deleteMany({ where: { id: ids.animal } });
  await prisma.propriedade.deleteMany({ where: { id: ids.sitio } });
});

const aplicacao = (dose: string) => ({ animalId: ids.animal, propriedadeId: ids.sitio, data: ontem, aplicadaEm: `${ontem}T10:00:00-03:00`, finalidade: "VACINA" as const, nomeProdutoAplicado: "Medicamento anotado em campo", dose, unidadeDose: "ML" as const, carenciaLeiteHoras: 0, carenciaCarneHoras: 0 });
const reconciliacao = () => ({ origemInsumo: "COMPRA_CONSUMO_DIRETO" as const, produtoId: ids.produto, itemCompraDiretaId: ids.item, confirmarEquivalencia: true, motivo: "Conferido o mesmo medicamento no comprovante" });

comBanco("reconciliação e rastreabilidade sanitária", () => {
  beforeAll(async () => {
    const sitio = await prisma.propriedade.create({ data: { nome: `Reconciliação ${run}` } }); ids.sitio = sitio.id;
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `RC${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", propriedadeId: sitio.id, dataNascimento: "2020-01-01", dataEntrada: "2026-01-01" }), null); ids.animal = animal.id;
    const produto = await prisma.produto.create({ data: { nome: `Produto comprovado ${run}`, unidade: "ML", usoSanitario: true } }); ids.produto = produto.id;
    const op = await prisma.operacao.create({ data: { tipo: "COMPRA_CONSUMO_DIRETO", status: "CONFIRMADA", propriedadeId: sitio.id, descricao: "Compra do medicamento", data: new Date(ontem), valorTotal: "0.01", itens: { create: { ordem: 1, produtoId: produto.id, descricao: produto.nome, quantidade: 3, unidade: "ML", valorUnitario: "0.0033", valorTotal: "0.01", estocavel: false } } }, include: { itens: true } }); ids.operacao = op.id; ids.item = op.itens[0].id;
  });

  it("nome diferente exige ciência e conserva dose, nome e justificativa sem gerar estoque", async () => {
    const a = await criarAplicacao({ ...aplicacao("1"), origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Comprovante não estava disponível" }, null);
    await expect(reconciliarOrigem(a.id, ids.sitio, { ...reconciliacao(), confirmarEquivalencia: false }, null)).rejects.toMatchObject({ campo: "confirmarEquivalencia" });
    const salva = await reconciliarOrigem(a.id, ids.sitio, reconciliacao(), null);
    expect(salva.nomeProdutoAplicado).toBe(a.nomeProdutoAplicado);
    expect(salva.justificativaSemOrigem).toBe(a.justificativaSemOrigem);
    expect(salva.dose?.toString()).toBe("1");
    expect(salva.quantidadeCompraDireta?.toString()).toBe("1");
    expect(salva.movimentoEstoqueId).toBeNull();
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: ids.produto } })).toBe(0);
    const detalhe = await obterAplicacao(a.id, ids.sitio);
    expect(detalhe.animal.brinco).toBe(`RC${run}`);
    expect(detalhe.propriedade).toEqual({ id: ids.sitio, nome: `Reconciliação ${run}` });
    expect(detalhe.produto).toMatchObject({ id: ids.produto, unidade: "ML" });
    expect(JSON.parse(JSON.stringify(detalhe)).compraDireta).toMatchObject({ id: ids.item, quantidade: "3", quantidadeDestinada: "1", quantidadeDisponivel: "2", valorTotal: "0.01", operacao: { id: ids.operacao, descricao: "Compra do medicamento", numero: expect.any(Number) } });
    expect(ocultarCustosDetalhe(detalhe)).toMatchObject({ valorProdutoAtribuido: null, compraDireta: { valorTotal: null, quantidadeDisponivel: "2" } });
    expect((await prisma.auditoriaPecuaria.findFirstOrThrow({ where: { entidadeId: a.id, acao: "ORIGEM_RECONCILIADA" } })).depois).toMatchObject({ confirmarEquivalencia: true });
    await anularAplicacao(a.id, ids.sitio, "Corrigir destinação do medicamento", null);
  });

  it("reconciliações concorrentes reservam a mesma compra e não excedem dose nem centavos", async () => {
    const [a, b] = await Promise.all([1, 2].map(() => criarAplicacao({ ...aplicacao("2"), origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Nota localizada posteriormente" }, null)));
    const resultados = await Promise.allSettled([a.id, b.id].map((id) => reconciliarOrigem(id, ids.sitio, reconciliacao(), null)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((r) => r.status === "rejected")).toHaveLength(1);
    const vinculada = resultados.find((r) => r.status === "fulfilled");
    if (!vinculada || vinculada.status !== "fulfilled") throw new Error("Aplicação não vinculada");
    const ultima = await criarAplicacao({ ...aplicacao("1"), origemInsumo: "COMPRA_CONSUMO_DIRETO", produtoId: ids.produto, itemCompraDiretaId: ids.item }, null);
    const soma = await prisma.aplicacaoProduto.aggregate({ where: { itemCompraDiretaId: ids.item, status: "VALIDO" }, _sum: { quantidadeCompraDireta: true, valorProdutoAtribuido: true } });
    expect(soma._sum.quantidadeCompraDireta?.toString()).toBe("3");
    expect(soma._sum.valorProdutoAtribuido?.toString()).toBe("0.01");
    await expect(criarAplicacao({ ...aplicacao("0.001"), origemInsumo: "COMPRA_CONSUMO_DIRETO", produtoId: ids.produto, itemCompraDiretaId: ids.item }, null)).rejects.toMatchObject({ campo: "itemCompraDiretaId" });
    await anularAplicacao(vinculada.value.id, ids.sitio, "Liberar parcela da compra direta", null);
    await anularAplicacao(ultima.id, ids.sitio, "Liberar última parcela da compra", null);
    expect((await prisma.operacao.findUniqueOrThrow({ where: { id: ids.operacao } })).valorTotal.toString()).toBe("0.01");
  });

  it("duplo envio da mesma reconciliação cria somente um vínculo e uma auditoria", async () => {
    const a = await criarAplicacao({ ...aplicacao("0.5"), origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Origem pendente da conferência" }, null);
    const resultados = await Promise.allSettled([1, 2].map(() => reconciliarOrigem(a.id, ids.sitio, reconciliacao(), null)));
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.auditoriaPecuaria.count({ where: { entidadeId: a.id, acao: "ORIGEM_RECONCILIADA" } })).toBe(1);
    await anularAplicacao(a.id, ids.sitio, "Liberar aplicação concorrente", null);
  });

  it("fato de outro sítio permanece inacessível e não recebe origem", async () => {
    const a = await criarAplicacao({ ...aplicacao("1"), origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Origem pendente da conferência" }, null);
    await expect(reconciliarOrigem(a.id, ids.sitio + 100000, reconciliacao(), null)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect((await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: a.id } })).origemInsumo).toBe("SEM_ORIGEM_JUSTIFICADA");
  });

  it("consulta explícita acha a saída revertida e seu inverso mantendo saldo e lista padrão", async () => {
    await prisma.movimentoEstoque.create({ data: { produtoId: ids.produto, propriedadeId: ids.sitio, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date(ontem), quantidade: 10, custoUnitario: 2, valorTotal: 20 } });
    const a = await criarAplicacao({ ...aplicacao("2"), origemInsumo: "BAIXA_ESTOQUE", produtoId: ids.produto }, null);
    await anularAplicacao(a.id, ids.sitio, "Anular baixa lançada incorretamente", null);
    const movimento = (await listarMovimentos({ movimentoId: a.movimentoEstoqueId!, propriedadeId: ids.sitio })).itens[0];
    expect(movimento).toMatchObject({ status: "REVERTIDO", vinculo: { tipo: "APLICACAO_SANITARIA", id: a.id }, estorno: { id: expect.any(String) } });
    const inverso = await prisma.movimentoEstoque.findUniqueOrThrow({ where: { id: movimento.estorno!.id } });
    expect(await obterAplicacao(a.id, ids.sitio)).toMatchObject({ status: "ANULADO", movimentoEstoque: { status: "REVERTIDO" }, estorno: { id: inverso.id } });
    expect(inverso.reversaoDeId).toBe(a.movimentoEstoqueId);
    expect(inverso.quantidade.equals(new Prisma.Decimal(2))).toBe(true);
    expect((await listarMovimentos({ produtoId: ids.produto, propriedadeId: ids.sitio })).itens.some((m) => m.id === a.movimentoEstoqueId)).toBe(true);
    expect((await listarSaldos({ propriedadeId: ids.sitio })).find((s) => s.produtoId === ids.produto)?.saldo).toBe(10);
  });
});
