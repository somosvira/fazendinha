// Render smoke do módulo Equipe & Ponto — espelha cultivo/__smoke__: pega erros
// de runtime que tsc/build não pegam. Usa react-dom/server (sem DOM); hooks de
// fetch não disparam no SSR (useEffect), então cada tab renderiza o shell de
// carregando — todas com o eyebrow "Equipe · …".
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { EquipeContent, type EqpSub } from "../EquipeContent";

const ABAS: EqpSub[] = ["dashboard", "funcionarios", "ponto", "folha"];

describe("equipe render smoke", () => {
  for (const aba of ABAS) {
    it(`EquipeContent renderiza a sub-aba ${aba}`, () => {
      const html = renderToString(h(EquipeContent, { aba, onNavEqp: () => {} }));
      expect(html).toContain("Equipe ·");
    });
  }
});
