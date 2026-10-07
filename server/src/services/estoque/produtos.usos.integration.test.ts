import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../db.js";
import { criarProduto, atualizarProduto, listarProdutos } from "./produtos.js";
import { produtoSchema } from "./produtos.schemas.js";
import { criarDieta } from "../pecuaria/nutricao/dietas.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const produtos: string[] = [], categorias: string[] = [];
const dietas: string[] = [];
afterAll(async () => {
  if (process.env.PECUARIA_DB_INTEGRATION !== "1") return;
  await prisma.auditoriaPecuaria.deleteMany({ where: { entidadeId: { in: dietas } } });
  await prisma.itemDieta.deleteMany({ where: { dietaId: { in: dietas } } });
  await prisma.dieta.deleteMany({ where: { id: { in: dietas } } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: produtos } } });
  await prisma.perfilSanitarioProduto.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.perfilNutricionalProduto.deleteMany({ where: { produtoId: { in: produtos } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
  await prisma.categoria.deleteMany({ where: { id: { in: categorias } } });
});
comBanco("Produto com usos próprios", () => {
  it("combina usos, filtra pelo Produto e troca categoria preservando perfis", async () => {
    const origem = await prisma.categoria.create({ data: { nome: `Geral usos ${run}`, usoSanitario: false, usoNutricional: false } });
    const destino = await prisma.categoria.create({ data: { nome: `Outra usos ${run}` } });
    categorias.push(origem.id, destino.id);
    const p = await criarProduto(produtoSchema.parse({ nome: `Produto usos ${run}`, categoriaId: origem.id, unidade: "KG", usoSanitario: true, usoNutricional: true, rastrearPartidas: true, perfilSanitario: { carenciaLeiteHoras: null, carenciaCarneHoras: 0 }, perfilNutricional: { materiaSecaPercentual: 90.25 } }), null);
    produtos.push(p.id);
    expect(p).toMatchObject({ usoSanitario: true, usoNutricional: true, rastrearPartidas: true });
    expect((await listarProdutos({ uso: "nutricional", q: run })).map((i) => i.id)).toContain(p.id);
    await prisma.perfilSanitarioProduto.update({ where: { produtoId: p.id }, data: { referenciaTecnica: "Histórico preservado" } });
    const trocado = await atualizarProduto(p.id, { nome: p.nome, unidade: "KG", categoriaId: destino.id, usoSanitario: true, usoNutricional: true, usoGenetico: false, fornecedorIds: [], centroCustoIds: [], perfilSanitario: { carenciaLeiteHoras: null, carenciaCarneHoras: 0 }, perfilNutricional: { materiaSecaPercentual: 90.25 } }, null);
    expect(trocado.perfilSanitario?.referenciaTecnica).toBe("Histórico preservado");
    expect(trocado).toMatchObject({ usoSanitario: true, usoNutricional: true, perfilSanitario: { carenciaCarneHoras: 0 }, perfilNutricional: { materiaSecaPercentual: "90.25" } });
    await expect(atualizarProduto(p.id, { usoSanitario: false }, null)).rejects.toMatchObject({ campo: "usoSanitario", code: "CONFLITO" });
    await expect(atualizarProduto(p.id, { usoNutricional: false }, null)).rejects.toMatchObject({ campo: "usoNutricional", code: "CONFLITO" });
    await expect(atualizarProduto(p.id, { rastrearPartidas: false }, null)).rejects.toMatchObject({ campo: "rastrearPartidas", code: "CONFLITO" });
  });
  it("categoria marcada não habilita usos silenciosamente em produtos novos", async () => {
    const categoria = await prisma.categoria.create({ data: { nome: `Categoria legado usos ${run}`, usoSanitario: true } });
    categorias.push(categoria.id);
    const p = await criarProduto(produtoSchema.parse({ nome: `Geral sem uso ${run}`, categoriaId: categoria.id }), null);
    produtos.push(p.id);
    expect(p).toMatchObject({ usoSanitario: false, usoNutricional: false, rastrearPartidas: false });
    expect((await listarProdutos({ uso: "sanitario", q: run })).map((i) => i.id)).not.toContain(p.id);
  });
  it("categorias padrão existem sem alterar classificações de outras categorias", async () => {
    expect(await prisma.categoria.count({ where: { nome: { in: ["Sanidade", "Nutrição"] } } })).toBe(2);
  });
  it("criação de receita concorrente com remoção de uso não deixa vínculo inelegível", async () => {
    const categoria = await prisma.categoria.create({ data: { nome: `Concorrência usos ${run}` } }); categorias.push(categoria.id);
    const p = await criarProduto(produtoSchema.parse({ nome: `Concorrência produto ${run}`, categoriaId: categoria.id, unidade: "KG", usoNutricional: true }), null); produtos.push(p.id);
    const resultados = await Promise.allSettled([
      criarDieta({ nome: `Receita concorrente ${run}`, itens: [{ produtoId: p.id, quantidadeCabecaDia: 3 }] }, null),
      atualizarProduto(p.id, { usoNutricional: false }, null),
    ]);
    if (resultados[0].status === "fulfilled") dietas.push(resultados[0].value.id);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const atualizado = await prisma.produto.findUniqueOrThrow({ where: { id: p.id }, include: { itemDietas: true } });
    expect(atualizado.usoNutricional || atualizado.itemDietas.length === 0).toBe(true);
  });
});
