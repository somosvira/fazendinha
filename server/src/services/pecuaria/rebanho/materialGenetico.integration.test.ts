// Testes de banco do material genético (v2): sêmen e embrião como produto do estoque.
// Só rodam com PECUARIA_DB_INTEGRATION=1, como os demais testes de banco da pecuária.

import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { criarGenitor, editarGenitor } from "./genitores.js";
import { criarMaterialGenetico, editarMaterialGenetico, listarMaterialGenetico } from "./materialGenetico.js";
import { RebanhoError } from "./regras.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;

const RUN = crypto.randomUUID().slice(0, 8);
const genitores: string[] = [];
const categorias: string[] = [];
const materiais: string[] = [];

async function categoria(usoGenetico: boolean) {
  const c = await prisma.categoria.create({ data: { nome: `Genética ${RUN} ${categorias.length}`, usoGenetico } });
  categorias.push(c.id);
  return c.id;
}

async function genitor(sexo: "F" | "M", nome: string) {
  const g = await criarGenitor({ sexo, nome: `${nome} ${RUN}`, composicao: [] }, null);
  genitores.push(g.id);
  return g;
}

afterAll(async () => {
  const produtos = await prisma.materialGenetico.findMany({ where: { id: { in: materiais } }, select: { produtoId: true } });
  const produtoIds = produtos.map((p) => p.produtoId);
  await prisma.auditoriaPecuaria.deleteMany({ where: { entidadeId: { in: [...materiais, ...genitores] } } });
  await prisma.materialGenetico.deleteMany({ where: { id: { in: materiais } } });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: { in: produtoIds } } });
  await prisma.auditoriaFinanceira.deleteMany({ where: { entidadeId: { in: produtoIds } } });
  await prisma.produto.deleteMany({ where: { id: { in: produtoIds } } });
  await prisma.categoria.deleteMany({ where: { id: { in: categorias } } });
  await prisma.genitorExterno.deleteMany({ where: { id: { in: genitores } } });
});

describeComBanco("material genético (banco real)", () => {
  it("sêmen de touro externo cria produto em DOSE com nome sugerido", async () => {
    const cat = await categoria(true);
    const touro = await genitor("M", "Zeus");
    const m = await criarMaterialGenetico({
      tipo: "SEMEN", tipoSemen: "SEXADO_FEMEA", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: cat },
    }, null);
    materiais.push(m.id);
    expect(m.produto.unidade).toBe("DOSE");
    expect(m.produto.nome).toBe(`Sêmen Zeus ${RUN} (sexado fêmea)`);
    expect(m.touro).toMatchObject({ tipo: "EXTERNO", id: touro.id });
    expect(m.doadora).toBeNull();

    const lista = await listarMaterialGenetico({ tipo: "SEMEN" });
    expect(lista.find((x) => x.id === m.id)?.saldo).toBeNull();
  });

  it("embrião exige touro macho e doadora fêmea e vira produto em UN", async () => {
    const cat = await categoria(true);
    const touro = await genitor("M", "Apolo");
    const doadora = await genitor("F", "Estrela");
    const m = await criarMaterialGenetico({
      tipo: "EMBRIAO", touro: { tipo: "EXTERNO", id: touro.id }, doadora: { tipo: "EXTERNO", id: doadora.id }, produto: { categoriaId: cat },
    }, null);
    materiais.push(m.id);
    expect(m.produto.unidade).toBe("UN");
    expect(m.produto.nome).toBe(`Embrião Apolo ${RUN} × Estrela ${RUN}`);

    await expect(criarMaterialGenetico({
      tipo: "EMBRIAO", touro: { tipo: "EXTERNO", id: doadora.id }, doadora: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: cat, nome: `Troca ${RUN}` },
    }, null)).rejects.toMatchObject({ campo: "touro" });
  });

  it("recusa categoria sem uso genético e nome de produto repetido", async () => {
    const semUso = await categoria(false);
    const comUso = await categoria(true);
    const touro = await genitor("M", "Hermes");
    await expect(criarMaterialGenetico({ tipo: "SEMEN", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: semUso } }, null))
      .rejects.toBeInstanceOf(RebanhoError);

    const m = await criarMaterialGenetico({ tipo: "SEMEN", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: comUso } }, null);
    materiais.push(m.id);
    await expect(criarMaterialGenetico({ tipo: "SEMEN", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: comUso } }, null))
      .rejects.toMatchObject({ code: "CONFLITO" });
  });

  it("edita o tipo de sêmen e o CHECK do banco mantém a separação dos tipos", async () => {
    const cat = await categoria(true);
    const touro = await genitor("M", "Ares");
    const m = await criarMaterialGenetico({ tipo: "SEMEN", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: cat } }, null);
    materiais.push(m.id);
    expect(m.tipoSemen).toBe("CONVENCIONAL");
    const editado = await editarMaterialGenetico(m.id, { tipoSemen: "SEXADO_MACHO" }, null);
    expect(editado.tipoSemen).toBe("SEXADO_MACHO");

    await expect(prisma.materialGenetico.update({ where: { id: m.id }, data: { tipo: "EMBRIAO", tipoSemen: "SEXADO_MACHO" } })).rejects.toThrow();
  });

  it("cadastra embrião sem doadora conhecida e permite informá-la depois", async () => {
    const cat = await categoria(true);
    const touro = await genitor("M", "Desconhecida");
    const doadora = await genitor("F", "Identificada");
    const material = await criarMaterialGenetico({ tipo: "EMBRIAO", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: cat } }, null);
    materiais.push(material.id);
    expect(material.doadora).toBeNull();
    expect(material.produto.nome).toBe(`Embrião Desconhecida ${RUN}`);
    const atualizado = await editarMaterialGenetico(material.id, { doadora: { tipo: "EXTERNO", id: doadora.id } }, null);
    expect(atualizado.doadora).toMatchObject({ id: doadora.id });
    await expect(editarMaterialGenetico(material.id, { doadora: { tipo: "EXTERNO", id: doadora.id } }, null))
      .rejects.toMatchObject({ campo: "doadora" });
  });

  it("editarGenitor recusa trocar o sexo de genitor usado em material genético", async () => {
    const cat = await categoria(true);
    const touro = await genitor("M", "Cronos");
    const m = await criarMaterialGenetico({ tipo: "SEMEN", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: cat } }, null);
    materiais.push(m.id);
    await expect(editarGenitor(touro.id, { sexo: "F" }, null)).rejects.toMatchObject({ code: "CONFLITO", campo: "sexo" });
  });

  it("saldo aparece mesmo com categoria sem uso genético ou produto inativo", async () => {
    const cat = await categoria(true);
    const touro = await genitor("M", "Urano");
    const m = await criarMaterialGenetico({ tipo: "SEMEN", touro: { tipo: "EXTERNO", id: touro.id }, produto: { categoriaId: cat } }, null);
    materiais.push(m.id);
    await prisma.movimentoEstoque.create({
      data: { produtoId: m.produto.id, tipo: "ENTRADA", origem: "COMPRA", data: new Date(), quantidade: 5, custoUnitario: 10, valorTotal: 50 },
    });
    await prisma.categoria.update({ where: { id: cat }, data: { usoGenetico: false } });
    await prisma.produto.update({ where: { id: m.produto.id }, data: { ativo: false } });
    const lista = await listarMaterialGenetico({ incluirInativos: true });
    expect(lista.find((x) => x.id === m.id)?.saldo).toBe(5);
  });
});
