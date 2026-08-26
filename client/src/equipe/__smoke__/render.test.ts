// Render smoke do módulo Equipe & Ponto — espelha cultivo/__smoke__: pega erros
// de runtime que tsc/build não pegam. Usa react-dom/server (sem DOM); hooks de
// fetch não disparam no SSR (useEffect), então cada tab renderiza o shell de
// carregando. (Títulos de topo foram removidos do produto — só o Relatório os mantém.)
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EquipeContent, type EqpSub } from "../EquipeContent";
import { ToastProvider } from "../../components/Toast";

const ABAS: EqpSub[] = ["dashboard", "funcionarios", "ponto", "folha"];

describe("equipe render smoke", () => {
  for (const aba of ABAS) {
    it(`EquipeContent renderiza a sub-aba ${aba}`, () => {
      // Em produção o App é envolto por QueryClientProvider + ToastProvider
      // (main.tsx); a aba ponto usa useQuery/useOfflineMutation e useToast(),
      // então o smoke reproduz os dois provedores.
      const html = renderToString(
        h(QueryClientProvider, { client: new QueryClient() },
          h(ToastProvider, null, h(EquipeContent, { aba, onNavEqp: () => {} }))),
      );
      // Título de topo removido — a casca `rb` prova que renderizou sem lançar.
      expect(html).toContain('class="rb"');
    });
  }
});
