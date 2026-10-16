import { describe, expect, it } from "vitest";
import { destinoDoMovimento } from "./navegacao";

describe("atalhos do estoque para fatos V3", () => {
  it("abre a aplicação sanitária com animal e ID para navegação direta", () => {
    expect(destinoDoMovimento({ operacaoId: null, operacaoNumero: null, vinculo: { tipo: "APLICACAO_SANITARIA", id: "ap-1", animalId: "animal-1" } }))
      .toEqual({ href: "/pecuaria/rebanho/sanidade?aba=aplicacoes&animalId=animal-1&aplicacaoId=ap-1&detalheTipo=aplicacao&detalheId=ap-1", rotulo: "Aplicação sanitária", area: "pecuaria" });
  });

  it("abre o fechamento nutricional com lote e ID", () => {
    expect(destinoDoMovimento({ operacaoId: null, operacaoNumero: null, vinculo: { tipo: "FECHAMENTO_NUTRICIONAL", id: "fe-1", loteId: "lote-1" } }))
      .toEqual({ href: "/pecuaria/rebanho/nutricao?aba=fechamentos&loteId=lote-1&fechamentoId=fe-1", rotulo: "Fechamento nutricional", area: "pecuaria" });
  });
});

it("abre tentativa no sítio histórico da saída", () => {
  expect(destinoDoMovimento({ operacaoId: null, operacaoNumero: null, propriedadeId: 7, vinculo: { tipo: "TENTATIVA_REPRODUTIVA", id: "tentativa-1", animalId: "animal-1" } })).toEqual({ href: "/pecuaria/reproducao?animalId=animal-1&tentativaId=tentativa-1&propriedadeId=7", rotulo: "Procedimento reprodutivo", area: "pecuaria" });
});
