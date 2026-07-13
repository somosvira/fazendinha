// Render smoke do módulo Cultivo (milho) — espelha rebanho/__smoke__: pega
// erros de runtime que tsc/build não pegam. Usa react-dom/server (sem DOM);
// hooks de fetch não disparam no SSR (useEffect), então cada tab renderiza o
// shell de carregando/vazio.
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { CultivoContent, type MilSub } from "../CultivoContent";

const ABAS: MilSub[] = ["dashboard", "safras", "custos", "producao", "silos", "custo"];

describe("cultivo render smoke", () => {
  for (const aba of ABAS) {
    it(`CultivoContent renderiza a sub-aba ${aba}`, () => {
      const html = renderToString(h(CultivoContent, { aba, onNavMil: () => {} }));
      expect(html).toContain("Cultivo · milho");
    });
  }
});
