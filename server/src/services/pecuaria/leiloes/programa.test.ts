import { expect, test } from "vitest";
import { lerAgenda, lerCatalogo, registroNormalizado } from "./programa.js";

test("deduplica evento pelo ID e lê somente lotes publicados", () => {
  const agenda = lerAgenda('<a href="/appportal/agenda/leilao/123-cat-touros"><span class="titulo">Touros &amp; Matrizes</span></a><a href="/appportal/agenda/leilao/123-outro"><span class="titulo">Outro</span></a>');
  expect(agenda).toHaveLength(1);
  expect(agenda[0]).toMatchObject({ id: "123", titulo: "Touros & Matrizes" });
  const catalogo = lerCatalogo('<time datetime="2026-11-14 12:00"></time><a href="/leilao/download/25505-catalogo">PDF</a><a data-idplaylist="x"><span class="transition">LOTE 01 CSCC 6840</span></a>');
  expect(catalogo.lotes).toEqual([{ numero: "01", titulo: "CSCC 6840", registro: null }]);
  expect(catalogo.catalogos).toHaveLength(1);
  expect(catalogo.horarioPublicado).toBe("2026-11-14 12:00");
});

test("só reconhece série e número explícitos com entidade e tipo", () => {
  expect(registroNormalizado("ABCZ RGD cscc-006840")).toBe("ABCZ:RGD:CSCC:6840");
  expect(registroNormalizado("CSCC 6840")).toBeNull();
  expect(registroNormalizado("ABCZ RGD 6840")).toBeNull();
  expect(registroNormalizado("ABCZ RGD CSCC 6840 E 6850")).toBeNull();
});
