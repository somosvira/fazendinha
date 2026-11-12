import { describe, expect, it } from "vitest";
import { uid } from "../../lib/uid.fixture.js";
import { buscaProdutosSchema, consultaCatalogoProdutosSchema, PRODUTO_OBRIGATORIO, PRODUTO_OU_CATALOGO, resolucaoProdutoSchema } from "./produtos-catalogo.schemas.js";
import { movimentoSchema } from "./estoque.js";
import { patchProdutoSchema } from "./produtos.schemas.js";
import { itemOperacaoSchema } from "../financeiro/schemas.js";
import { aplicacaoSchema } from "../pecuaria/sanidade/aplicacoes.schemas.js";

const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const mensagens = (r: { success: boolean; error?: { issues: { message: string; path: (string | number)[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

describe("resolucaoProdutoSchema: exatamente um entre produtoId e produtoCatalogoId", () => {
  it("aceita só produtoId ou só produtoCatalogoId", () => {
    expect(resolucaoProdutoSchema.safeParse({ produtoId: uid(1) }).success).toBe(true);
    expect(resolucaoProdutoSchema.safeParse({ produtoCatalogoId: uid(2), unidade: "KG", categoriaId: uid(3) }).success).toBe(true);
  });
  it("recusa os dois e recusa nenhum", () => {
    expect(mensagens(resolucaoProdutoSchema.safeParse({ produtoId: uid(1), produtoCatalogoId: uid(2) }))).toEqual([`produtoCatalogoId: ${PRODUTO_OU_CATALOGO}`]);
    expect(mensagens(resolucaoProdutoSchema.safeParse({}))).toEqual([`produtoId: ${PRODUTO_OBRIGATORIO}`]);
  });
});

describe("movimento manual de estoque", () => {
  const ajuste = { tipo: "AJUSTE", data: ontem, quantidade: 3, custoUnitario: 2, referenciaValor: "NF 1", evidenciaValor: "Nota conferida", observacao: "Inventário inicial" };
  it("aceita item do catálogo, com categoria opcional para a adoção", () => {
    expect(movimentoSchema.safeParse({ ...ajuste, produtoCatalogoId: uid(2) }).success).toBe(true);
    expect(movimentoSchema.safeParse({ ...ajuste, produtoCatalogoId: uid(2), categoriaId: uid(3) }).success).toBe(true);
  });
  it("exige exatamente um produto e só aceita categoria com item do catálogo", () => {
    expect(movimentoSchema.safeParse({ ...ajuste, produtoId: uid(1), produtoCatalogoId: uid(2) }).success).toBe(false);
    expect(movimentoSchema.safeParse(ajuste).success).toBe(false);
    expect(mensagens(movimentoSchema.safeParse({ ...ajuste, produtoId: uid(1), categoriaId: uid(3) }))[0]).toMatch(/^categoriaId:/);
  });
});

describe("item de operação financeira", () => {
  const item = { descricao: "Vermífugo", quantidade: 2, unidade: "un", valorUnitario: 10 };
  it("aceita produtoId, produtoCatalogoId ou nenhum (serviço sem produto)", () => {
    expect(itemOperacaoSchema.safeParse({ ...item, produtoId: uid(1) }).success).toBe(true);
    expect(itemOperacaoSchema.safeParse({ ...item, produtoCatalogoId: uid(2), categoriaId: uid(3) }).success).toBe(true);
    expect(itemOperacaoSchema.safeParse(item).success).toBe(true);
  });
  it("recusa os dois ao mesmo tempo", () => {
    expect(mensagens(itemOperacaoSchema.safeParse({ ...item, produtoId: uid(1), produtoCatalogoId: uid(2) }))).toEqual([`produtoCatalogoId: ${PRODUTO_OU_CATALOGO}`]);
  });
});

describe("aplicação sanitária", () => {
  const aplicacao = { animalId: uid(1), propriedadeId: 1, data: ontem, origemInsumo: "BAIXA_ESTOQUE", nomeProdutoAplicado: "Vermífugo", dose: "5", unidadeDose: "ML" };
  it("aceita produtoCatalogoId no lugar de produtoId", () => {
    expect(aplicacaoSchema.safeParse({ ...aplicacao, produtoCatalogoId: uid(2), categoriaId: uid(3) }).success).toBe(true);
    expect(aplicacaoSchema.safeParse({ ...aplicacao, produtoId: uid(2) }).success).toBe(true);
  });
  it("recusa os dois e categoria sem item do catálogo", () => {
    expect(aplicacaoSchema.safeParse({ ...aplicacao, produtoId: uid(1), produtoCatalogoId: uid(2) }).success).toBe(false);
    expect(aplicacaoSchema.safeParse({ ...aplicacao, produtoId: uid(1), categoriaId: uid(3) }).success).toBe(false);
  });
});

describe("consultas do catálogo", () => {
  it("busca unificada: limite padrão 10, máximo 50, uso conhecido", () => {
    expect(buscaProdutosSchema.parse({})).toEqual({ q: "", limite: 10 });
    expect(buscaProdutosSchema.parse({ q: " ivermectina ", uso: "sanitario", limite: "50" })).toEqual({ q: "ivermectina", uso: "sanitario", limite: 50 });
    expect(buscaProdutosSchema.safeParse({ limite: "51" }).success).toBe(false);
    expect(buscaProdutosSchema.safeParse({ uso: "agricola" }).success).toBe(false);
    expect(buscaProdutosSchema.safeParse({ outro: "x" }).success).toBe(false);
  });
  it("consulta paginada: padrões e limites", () => {
    expect(consultaCatalogoProdutosSchema.parse({})).toEqual({ busca: "", pagina: 1, porPagina: 20 });
    expect(consultaCatalogoProdutosSchema.safeParse({ porPagina: "51" }).success).toBe(false);
    expect(consultaCatalogoProdutosSchema.safeParse({ pagina: "0" }).success).toBe(false);
  });
  it("PATCH de produto aceita restaurarNome e null nos herdáveis", () => {
    expect(patchProdutoSchema.parse({ restaurarNome: true, apresentacao: null, fabricanteId: null, classificacaoTecnicaId: null }))
      .toEqual({ restaurarNome: true, apresentacao: null, fabricanteId: null, classificacaoTecnicaId: null });
    expect(patchProdutoSchema.safeParse({ restaurarNome: false }).success).toBe(false);
  });
});
