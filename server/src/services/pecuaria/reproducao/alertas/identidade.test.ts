import { expect, it, vi } from "vitest";
import { resolverIdentidadeNecessidade } from "./identidade.js";
it("links de aliases anteriores seguem até a identidade atual sem perder o acesso", async () => {
  const antiga = { id: "antiga", convergidaParaId: "tarefa" };
  const tarefa = { id: "tarefa", convergidaParaId: "demanda" };
  const atual = { id: "demanda", convergidaParaId: null };
  const carregar = vi.fn(async (id: string) =>
    id === "tarefa" ? tarefa : atual,
  );
  expect(await resolverIdentidadeNecessidade(antiga, carregar)).toBe(atual);
  expect(carregar.mock.calls.map(([id]) => id)).toEqual(["tarefa", "demanda"]);
});
it("ciclo inválido não permite encaminhar uma ação", async () => {
  const antiga = { id: "antiga", convergidaParaId: "outra" };
  await expect(
    resolverIdentidadeNecessidade(antiga, async (id) => ({
      id,
      convergidaParaId: "antiga",
    })),
  ).rejects.toMatchObject({ code: "CONFLITO" });
});
