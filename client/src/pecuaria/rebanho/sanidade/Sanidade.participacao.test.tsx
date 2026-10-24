// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const participacao = vi.hoisted(() => vi.fn());
vi.mock("../protocolos/ParticipacaoProtocolo", () => ({ ParticipacaoProtocolo: (props: object) => { participacao(props); return <p>Operação individual</p>; } }));
import { Sanidade } from "./Sanidade";
afterEach(() => { cleanup(); participacao.mockClear(); window.history.replaceState(null, "", "/"); });
it("rota individual preserva sítio, retorno e filtros sem efeitos da agenda", async () => {
  const url = "/pecuaria/sanidade/participacoes/p?sitio=126&retorno=%2Fpecuaria%2Frebanho&protocoloContexto=participacao%3Ap&etapaId=e&paginaTarefas=2";
  window.history.replaceState(null, "", url);
  render(<Sanidade podeLancar/>);
  expect(await screen.findByText("Operação individual")).toBeTruthy();
  expect(window.location.pathname + window.location.search).toBe(url);
  expect(participacao).toHaveBeenCalledWith(expect.objectContaining({ id: "p", propriedadeId: 126, tipo: "SANITARIO" }));
});
