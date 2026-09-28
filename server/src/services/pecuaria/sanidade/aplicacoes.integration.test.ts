import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { estornarOperacao } from "../../financeiro/operacoes.js";
import { anularAplicacao, carenciaAnimal, criarAplicacao } from "./aplicacoes.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const propriedadeIds: number[] = [];
const animalIds: string[] = [];
const operacaoIds: string[] = [];

const diasAntes = (n: number) => new Date(Date.parse(hojeFazenda()) - n * 86_400_000).toISOString().slice(0, 10);

afterAll(async () => {
  if (!propriedadeIds.length) return;
  await prisma.auditoriaPecuaria.deleteMany({ where: { animalId: { in: animalIds } } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animalIds } } });
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
    expect((await carenciaAnimal(animal.id, propriedade.id)).carne).toMatchObject({ estado: "CONHECIDO" });
    await expect(estornarOperacao(servico.id, "Correção", { propriedadeId: propriedade.id })).rejects.toThrow(/aplicações/);
    await anularAplicacao(aplicacao.id, propriedade.id, "Registro lançado incorretamente", null);
    expect((await carenciaAnimal(animal.id, propriedade.id)).carne).toEqual({ estado: "NENHUMA" });
  });
});
