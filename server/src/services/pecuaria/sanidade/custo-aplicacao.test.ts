import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { custoAplicacao } from "./custo-aplicacao.js";
const fato = { id: "aplicacao", animalId: "animal", propriedadeId: 2, data: new Date("2026-10-30"), nomeProdutoAplicado: "Produto", status: "VALIDO" as const, consumoMantido: false, origemInsumo: "BAIXA_ESTOQUE" as const, movimentoEstoqueId: "saida", operacaoServicoId: "servico", valorProdutoAtribuido: new Prisma.Decimal("12.30"), valorServicoAtribuido: new Prisma.Decimal("7.40") };
describe("custo real da aplicação", () => {
  it("soma somente parcelas atribuídas e preserva origens distintas", () => {
    expect(custoAplicacao(fato)).toMatchObject({ totalConhecido: "19.70", cobertura: "COMPLETO", componentes: [{ natureza: "MATERIAL", valor: "12.30", origemId: "saida" }, { natureza: "SERVICO", valor: "7.40", origemId: "servico" }] });
  });
  it("não transforma uma parcela conhecida em custo completo", () => {
    expect(custoAplicacao({ ...fato, valorServicoAtribuido: null })).toMatchObject({ totalConhecido: "12.30", cobertura: "PARCIAL", componentesPendentes: 1 });
    expect(custoAplicacao({ ...fato, valorProdutoAtribuido: null, valorServicoAtribuido: null })).toMatchObject({ totalConhecido: null, cobertura: "DESCONHECIDO" });
  });
  it("inclui material no pacote uma única vez", () => {
    expect(custoAplicacao({ ...fato, valorProdutoAtribuido: null, classificacaoCusto: { finalidade: "SANIDADE", coberturaServico: "AMBOS", materialNaoAplicavel: false, servicoNaoAplicavel: false, valorMaterialDocumentado: null } })).toMatchObject({ totalConhecido: "7.40", cobertura: "COMPLETO", componentes: [{ estado: "INCLUIDO_PACOTE", valor: null }, { valor: "7.40" }] });
  });
  it("anulada com consumo mantido preserva custo; estornada fica fora do atual", () => {
    expect(custoAplicacao({ ...fato, status: "ANULADO", consumoMantido: false })).toBeNull();
    expect(custoAplicacao({ ...fato, status: "ANULADO", consumoMantido: true })).toMatchObject({ totalConhecido: "19.70" });
  });
});
