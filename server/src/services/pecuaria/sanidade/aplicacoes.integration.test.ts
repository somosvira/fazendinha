import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar, darBaixa } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { estornarOperacao } from "../../financeiro/operacoes.js";
import { anularAplicacao, carenciaAnimal, criarAplicacao } from "./aplicacoes.js";
import { listarRateios, salvarRateio } from "./rateios.js";
import { criarProtocolo, iniciarExecucao, listarTarefas, publicarProtocolo } from "./protocolos.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const propriedadeIds: number[] = [];
const animalIds: string[] = [];
const operacaoIds: string[] = [];
const produtoIds: string[] = [];
const protocoloIds: string[] = [];
const execucaoIds: string[] = [];

const diasAntes = (n: number) => new Date(Date.parse(hojeFazenda()) - n * 86_400_000).toISOString().slice(0, 10);

afterAll(async () => {
  if (!propriedadeIds.length) return;
  await prisma.auditoriaPecuaria.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: propriedadeIds } } });
  await prisma.baixaAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.tarefaSanitaria.deleteMany({ where: { execucaoId: { in: execucaoIds } } });
  await prisma.execucaoProtocoloSanitario.deleteMany({ where: { id: { in: execucaoIds } } });
  await prisma.etapaProtocoloSanitario.deleteMany({ where: { protocoloId: { in: protocoloIds } } });
  await prisma.protocoloSanitario.deleteMany({ where: { id: { in: protocoloIds } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtoIds } } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { entidadeId: { in: protocoloIds } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.animal.deleteMany({ where: { id: { in: animalIds } } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: operacaoIds } } });
  await prisma.operacao.deleteMany({ where: { id: { in: operacaoIds } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedadeIds } } });
});

describeComBanco("aplicação com doses inclusas em Serviço", () => {
  it("registra medicamento e origem financeira sem Produto nem estoque; bloqueia cancelamento enquanto vinculada", async () => {
    const propriedade = await prisma.propriedade.create({ data: { nome: `Pec V3 serviço ${run}` } });
    propriedadeIds.push(propriedade.id);
    const animal = await cadastrar(cadastrarAnimalSchema.parse({
      brinco: `V3${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE",
      dataNascimento: diasAntes(800), dataEntrada: diasAntes(30), propriedadeId: propriedade.id,
    }), null);
    animalIds.push(animal.id);
    const servico = await prisma.operacao.create({ data: {
      tipo: "SERVICO", status: "CONFIRMADA", data: new Date(`${diasAntes(1)}T00:00:00Z`),
      descricao: "Veterinário com doses inclusas", valorTotal: 1000, propriedadeId: propriedade.id,
    } });
    operacaoIds.push(servico.id);

    const data = diasAntes(1);
    const aplicacao = await criarAplicacao({
      animalId: animal.id, propriedadeId: propriedade.id, data,
      aplicadaEm: `${data}T14:00:00-03:00`, finalidade: "VACINA",
      origemInsumo: "INCLUSO_SERVICO", nomeProdutoAplicado: "Vacina identificada pelo veterinário",
      dose: "2", unidadeDose: "ML", carenciaLeiteHoras: 0, carenciaCarneHoras: 48,
      operacaoServicoId: servico.id,
    }, null);
    expect(aplicacao.produtoId).toBeNull();
    expect(aplicacao.movimentoEstoqueId).toBeNull();
    expect(aplicacao.itemCompraDiretaId).toBeNull();
    expect(aplicacao.operacaoServicoId).toBe(servico.id);
    expect(aplicacao.nomeProdutoAplicado).toContain("Vacina");
    const outroAnimal = await cadastrar(cadastrarAnimalSchema.parse({
      brinco: `V3B${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE",
      dataNascimento: diasAntes(700), dataEntrada: diasAntes(20), propriedadeId: propriedade.id,
    }), null);
    animalIds.push(outroAnimal.id);
    const outraAplicacao = await criarAplicacao({
      animalId: outroAnimal.id, propriedadeId: propriedade.id, data,
      aplicadaEm: `${data}T15:00:00-03:00`, finalidade: "VACINA",
      origemInsumo: "INCLUSO_SERVICO", nomeProdutoAplicado: "Vacina identificada pelo veterinário",
      dose: "2", unidadeDose: "ML", carenciaLeiteHoras: 0, carenciaCarneHoras: 48,
      operacaoServicoId: servico.id,
    }, null);
    expect(outraAplicacao.operacaoServicoId).toBe(servico.id);
    await salvarRateio({ servicoId: servico.id, propriedadeId: propriedade.id, tipo: "APLICACAO", id: aplicacao.id, valor: "600", motivo: "Rateio manual confirmado" }, null);
    await salvarRateio({ servicoId: servico.id, propriedadeId: propriedade.id, tipo: "APLICACAO", id: outraAplicacao.id, valor: "400", motivo: "Complemento manual confirmado" }, null);
    expect((await listarRateios(servico.id, propriedade.id)).totalAtribuido).toBe("1000");
    await expect(salvarRateio({ servicoId: servico.id, propriedadeId: propriedade.id, tipo: "APLICACAO", id: outraAplicacao.id, valor: "401", motivo: "Tentativa acima do confirmado" }, null)).rejects.toThrow(/ultrapassa/);
    expect((await prisma.operacao.findUniqueOrThrow({ where: { id: servico.id } })).valorTotal.toString()).toBe("1000");
    expect(outraAplicacao.movimentoEstoqueId).toBeNull();
    expect(outraAplicacao.valorProdutoAtribuido).toBeNull();
    expect((await carenciaAnimal(animal.id, propriedade.id)).carne).toMatchObject({ estado: "CONHECIDO" });
    await expect(estornarOperacao(servico.id, "Correção", { propriedadeId: propriedade.id })).rejects.toThrow(/aplicações/);
    await anularAplicacao(aplicacao.id, propriedade.id, "Registro lançado incorretamente", null);
    expect((await carenciaAnimal(animal.id, propriedade.id)).carne).toEqual({ estado: "NENHUMA" });
    await expect(estornarOperacao(servico.id, "Correção", { propriedadeId: propriedade.id })).rejects.toThrow(/aplicações/);
    await anularAplicacao(outraAplicacao.id, propriedade.id, "Registro lançado incorretamente", null);
  });
  it("reexecuta aplicação anulada e preserva ciência sanitária calculada no ato da baixa", async () => {
    const propriedadeId = propriedadeIds[0];
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `SN${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: diasAntes(800), dataEntrada: diasAntes(30), propriedadeId }), null);
    animalIds.push(animal.id);
    const produto = await prisma.produto.create({ data: { nome: `Vacina tarefa ${run}`, unidade: "ML", usoSanitario: true } });
    produtoIds.push(produto.id);
    const protocolo = await criarProtocolo({ nome: `Vacinação ${run}`, etapas: [{ tipo: "APLICACAO", diaRelativo: 0, produtoId: produto.id, finalidade: "VACINA", dose: 2, unidade: "ML" }] }, null);
    protocoloIds.push(protocolo.id);
    await publicarProtocolo(protocolo.id, null);
    const data = diasAntes(10);
    const execucao = await iniciarExecucao({ animalId: animal.id, propriedadeId, inicio: data, protocoloId: protocolo.id }, null);
    execucaoIds.push(execucao.id);
    const input = { animalId: animal.id, propriedadeId, data, aplicadaEm: `${data}T14:00:00-03:00`, finalidade: "VACINA" as const, origemInsumo: "SEM_ORIGEM_JUSTIFICADA" as const,
      produtoId: produto.id, nomeProdutoAplicado: produto.nome, dose: "2", unidadeDose: "ML" as const, carenciaLeiteHoras: 48, carenciaCarneHoras: 72, justificativaSemOrigem: "Caderno de campo sem nota da compra", tarefaId: execucao.tarefas[0].id };
    const primeira = await criarAplicacao(input, null);
    await anularAplicacao(primeira.id, propriedadeId, "Aplicação vinculada ao caderno incorreto", null);
    const keyed = { ...input, chave: crypto.randomUUID() };
    const segunda = await criarAplicacao(keyed, null);
    expect((await criarAplicacao(keyed, null)).id).toBe(segunda.id);
    await expect(criarAplicacao({ ...keyed, dose: "3" }, null)).rejects.toThrow(/outros dados/);
    expect(segunda.id).not.toBe(primeira.id);
    expect((await listarTarefas(propriedadeId, animal.id))[0].aplicacoes).toHaveLength(2);
    await expect(criarAplicacao(input, null)).rejects.toThrow(/não está disponível/);
    // Já encerrada hoje, mas ainda vigente na data histórica da saída.
    const dataBaixa = diasAntes(9);
    expect((await carenciaAnimal(animal.id, propriedadeId)).carne).toMatchObject({ estado: "CONHECIDO" });
    await expect(darBaixa({ animalId: animal.id, tipo: "VENDA", data: dataBaixa }, null)).rejects.toThrow(/Confirme ciência/);
    await darBaixa({ animalId: animal.id, tipo: "VENDA", data: dataBaixa, cienciaSanitaria: true, justificativaSanitaria: "Revisado com responsável pela saída" }, null);
    const baixa = await prisma.baixaAnimal.findFirstOrThrow({ where: { animalId: animal.id, estornadaEm: null } });
    expect(baixa.cienciaCarenciaSnapshot).toMatchObject({ ciente: true, propriedadeId, usuarioId: null, justificativa: "Revisado com responsável pela saída", carencias: { carne: { estado: "CONHECIDO" } } });
    await anularAplicacao(segunda.id, propriedadeId, "Correção posterior à baixa documentada", null);
    expect((await prisma.baixaAnimal.findUniqueOrThrow({ where: { id: baixa.id } })).cienciaCarenciaSnapshot).toEqual(baixa.cienciaCarenciaSnapshot);
  });
});
