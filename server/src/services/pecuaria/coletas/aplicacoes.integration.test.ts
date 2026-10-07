import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { hojeFazenda } from "../rebanho/regras.js";
import { concluirColeta, obterColeta, prepararColeta, salvarColeta } from "./coletas.js";
import { rascunhoColetaSchema } from "./schemas.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const propriedades: number[] = []; const lotes: string[] = []; const animais: string[] = []; const produtos: string[] = []; const fichas: string[] = [];
const data = new Date(Date.parse(hojeFazenda()) - 86400000).toISOString().slice(0, 10);

afterAll(async () => {
  if (!propriedades.length) return;
  await prisma.coletaCampo.deleteMany({ where: { id: { in: fichas } } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { propriedadeId: { in: propriedades } } });
  await prisma.aplicacaoProduto.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
  await prisma.animal.deleteMany({ where: { id: { in: animais } } });
  await prisma.lote.deleteMany({ where: { id: { in: lotes } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedades } } });
});

async function prepararCenario(tag: string, saldo = 10, segundaDose = "2") {
  const propriedadeId = (await prisma.propriedade.create({ data: { nome: `Coleta aplicação ${tag} ${run}` } })).id; propriedades.push(propriedadeId);
  const loteId = (await prisma.lote.create({ data: { nome: `Lote ${tag} ${run}`, propriedadeId } })).id; lotes.push(loteId);
  const produto = await prisma.produto.create({ data: { nome: `Vacina coleta ${tag} ${run}`, unidade: "ML", usoSanitario: true } }); produtos.push(produto.id);
  for (const ordem of [1, 2]) {
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `CA${run}-${tag}-${ordem}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId, loteId }), null);
    animais.push(animal.id);
  }
  await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId, tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date(data), quantidade: saldo, custoUnitario: 2, valorTotal: saldo * 2 } });
  const ficha = await prepararColeta({ id: crypto.randomUUID(), propriedadeId, data, tipo: "APLICACAO", titulo: `Aplicação ${tag}`, loteIds: [loteId] }, null); fichas.push(ficha.id);
  const rascunho = rascunhoColetaSchema.parse(ficha.rascunho);
  const preenchida = { ...rascunho, itens: rascunho.itens.map((item, i) => ({ ...item, situacao: "REALIZADO" as const, aplicacao: {
    animalId: item.animalId, propriedadeId, data, aplicadaEm: `${data}T12:00:00-03:00`, finalidade: "VACINA" as const,
    produtoId: produto.id, nomeProdutoAplicado: produto.nome, origemInsumo: "BAIXA_ESTOQUE" as const,
    dose: i === 0 ? "2" : segundaDose, unidadeDose: "ML" as const, carenciaLeiteHoras: 0, carenciaCarneHoras: 48,
  } })) };
  const salva = await salvarColeta(ficha.id, propriedadeId, ficha.versao, preenchida, null);
  return { propriedadeId, produtoId: produto.id, ficha: salva, animalIds: rascunho.itens.map((i) => i.animalId) };
}

comBanco("coleta de aplicações com estoque V3 no PostgreSQL isolado", () => {
  it("preparar e preencher não movimentam estoque; concluir baixa doses e reenvio não duplica", async () => {
    const c = await prepararCenario("baixa");
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: c.produtoId, tipo: "SAIDA" } })).toBe(0);
    const concluida = await concluirColeta(c.ficha.id, c.propriedadeId, c.ficha.versao, null);
    const repetida = await concluirColeta(c.ficha.id, c.propriedadeId, c.ficha.versao, null);
    expect(repetida.resultados).toEqual(concluida.resultados);
    const aplicacoes = await prisma.aplicacaoProduto.findMany({ where: { animalId: { in: c.animalIds } }, include: { movimentoEstoque: true } });
    expect(aplicacoes).toHaveLength(2);
    for (const a of aplicacoes) {
      expect(a.propriedadeId).toBe(c.propriedadeId); expect(a.dose?.toString()).toBe("2");
      expect(a.movimentoEstoque).toMatchObject({ origem: "SANIDADE", propriedadeId: c.propriedadeId });
      expect(a.movimentoEstoque?.quantidade.toString()).toBe("2"); expect(a.movimentoEstoque?.valorTotal?.toString()).toBe("4");
    }
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: c.produtoId, tipo: "SAIDA" } })).toBe(2);
    expect(await prisma.auditoriaPecuaria.count({ where: { entidade: "AplicacaoProduto", animalId: { in: c.animalIds } } })).toBe(2);
  });

  it("saldo insuficiente no segundo animal desfaz aplicações, saídas e auditoria do primeiro", async () => {
    const c = await prepararCenario("rollback", 5, "99");
    await expect(concluirColeta(c.ficha.id, c.propriedadeId, c.ficha.versao, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "itens.1.dose" });
    expect(await prisma.aplicacaoProduto.count({ where: { animalId: { in: c.animalIds } } })).toBe(0);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: c.produtoId, tipo: "SAIDA" } })).toBe(0);
    expect(await prisma.auditoriaPecuaria.count({ where: { entidade: "AplicacaoProduto", animalId: { in: c.animalIds } } })).toBe(0);
    expect(await obterColeta(c.ficha.id, c.propriedadeId)).toMatchObject({ status: "EM_PREENCHIMENTO", versao: c.ficha.versao, resultados: null });
  });

  it("conclusões concorrentes da mesma versão retornam os mesmos fatos e uma única baixa por animal", async () => {
    const c = await prepararCenario("concorrente");
    const [a, b] = await Promise.all([concluirColeta(c.ficha.id, c.propriedadeId, c.ficha.versao, null), concluirColeta(c.ficha.id, c.propriedadeId, c.ficha.versao, null)]);
    expect(a.resultados).toEqual(b.resultados); expect(a.versao).toBe(c.ficha.versao + 1); expect(b.versao).toBe(a.versao);
    expect(await prisma.aplicacaoProduto.count({ where: { animalId: { in: c.animalIds } } })).toBe(2);
    expect(await prisma.movimentoEstoque.count({ where: { produtoId: c.produtoId, tipo: "SAIDA" } })).toBe(2);
    expect(await prisma.auditoriaPecuaria.count({ where: { entidade: "ColetaCampo", entidadeId: c.ficha.id, acao: "CONCLUSAO" } })).toBe(1);
  });
});
