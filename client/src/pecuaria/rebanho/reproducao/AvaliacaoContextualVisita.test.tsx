// @vitest-environment jsdom
import { expect, it } from "vitest";
import { limparCamposContextuais } from "./AvaliacaoContextualVisita";
import type { RascunhoVisita } from "./visitas-api";
it("rascunho conferido omite campos clínicos vazios e revisão anterior, conservando zero e falso", () => {
  const original: RascunhoVisita = {
    resultado: "NAO_AVALIADO",
    realizadoSemDG: true,
    tipoExameId: "tipo",
    sexoFetal: "",
    tentativaId: "",
    gestacaoId: "",
    revisaoContextual: "a".repeat(64),
    cienciaSanitaria: false,
    resultados: [
      { campo: "MEDIDA", valor: 0 },
      { campo: "CONDICAO", valor: false },
    ],
    avaliacaoContextual: {
      catalogoId: "catalogo",
      itens: [{ codigo: "MEDIDA", estado: "CONCLUSIVO" }],
      condutas: [],
    },
    vinculosConclusao: [],
  };
  const limpo = limparCamposContextuais(original);
  expect(limpo).not.toHaveProperty("sexoFetal");
  expect(limpo).not.toHaveProperty("tentativaId");
  expect(limpo).not.toHaveProperty("revisaoContextual");
  expect(limpo).toMatchObject({
    resultado: "NAO_AVALIADO",
    realizadoSemDG: true,
    cienciaSanitaria: false,
    resultados: [
      { campo: "MEDIDA", valor: 0 },
      { campo: "CONDICAO", valor: false },
    ],
    vinculosConclusao: [],
  });
  expect(original.sexoFetal).toBe("");
});
