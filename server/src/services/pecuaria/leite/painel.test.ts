import { expect, it } from "vitest";
import { resumirPainelLeite } from "./painel.js";
it("soma sítios/rotinas diferentes sem transformar ausência em zero ou completa", () => {
  const r = resumirPainelLeite(
    [
      {
        propriedadeId: 1,
        data: new Date("2026-10-01"),
        ordenhas: 3,
        animais: 2,
        medidas: 6,
        resolvidas: 6,
        litros: "54",
      },
      {
        propriedadeId: 2,
        data: new Date("2026-10-01"),
        ordenhas: 2,
        animais: 1,
        medidas: 1,
        resolvidas: 1,
        litros: "9",
      },
    ],
    [1, 2],
    "2026-10-01",
    "2026-10-02",
  );
  expect(r).toMatchObject({
    litros: "63.000",
    diasSitioEsperados: 4,
    diasSitioInformados: 2,
    diasSitioSemFolha: 2,
    diasSitioParciais: 1,
    medicoesPendentes: 1,
    completa: false,
    rotinas: [2, 3],
  });
  expect(
    resumirPainelLeite([], [1], "2026-10-01", "2026-10-01").litros,
  ).toBeNull();
});
it("preserva zero explicitamente medido e separa uma folha sem participantes", () => {
  expect(
    resumirPainelLeite(
      [
        {
          propriedadeId: 1,
          data: new Date("2026-10-01"),
          ordenhas: 3,
          animais: 1,
          medidas: 1,
          resolvidas: 3,
          litros: "0",
        },
      ],
      [1],
      "2026-10-01",
      "2026-10-01",
    ),
  ).toMatchObject({ litros: "0.000", completa: true });
  expect(
    resumirPainelLeite(
      [
        {
          propriedadeId: 1,
          data: new Date("2026-10-01"),
          ordenhas: 3,
          animais: 0,
          medidas: 0,
          resolvidas: 0,
          litros: null,
        },
      ],
      [1],
      "2026-10-01",
      "2026-10-01",
    ),
  ).toMatchObject({
    litros: null,
    completa: false,
    diasSitioSemParticipantes: 1,
  });
});

it("distingue dia comprovadamente sem elegíveis e lacuna de finalidade", () => {
  const vazio = resumirPainelLeite([], [1], "2026-10-01", "2026-10-01", [{ propriedadeId: 1, data: "2026-10-01", estado: "SEM_ANIMAIS_ELEGIVEIS" }]);
  expect(vazio).toMatchObject({ litros: null, diasSitioSemAnimaisElegiveis: 1, diasSitioSemFolha: 0, completa: true });
  const lacuna = resumirPainelLeite([], [1], "2026-10-01", "2026-10-01", [{ propriedadeId: 1, data: "2026-10-01", estado: "FINALIDADE_PENDENTE" }]);
  expect(lacuna).toMatchObject({ litros: null, diasSitioFinalidadePendente: 1, completa: false });
  const folhaVazia = resumirPainelLeite([{propriedadeId:1,data:new Date("2026-10-01"),animais:0,ordenhas:3,medidas:0,resolvidas:0,litros:null}], [1], "2026-10-01", "2026-10-01", [{propriedadeId:1,data:"2026-10-01",estado:"ELEGIVEIS"}]);
  expect(folhaVazia.completa).toBe(false);
});
