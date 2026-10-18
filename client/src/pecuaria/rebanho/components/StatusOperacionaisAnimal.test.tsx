// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StatusOperacionaisAnimal } from "./StatusOperacionaisAnimal";
import { reqSanidade } from "../sanidade/api";
import { reqV4 } from "../reproducao/api";
vi.mock("../sanidade/api", () => ({ reqSanidade: vi.fn() }));
vi.mock("../reproducao/api", () => ({ reqV4: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("distingue protocolo previsto de iniciado sem afirmar saúde por ausência", async () => {
  vi.mocked(reqSanidade).mockResolvedValue([]);
  vi.mocked(reqV4).mockResolvedValue([{ participantes: [{ animalId: "a", inicioEfetivo: null, encerradoEm: null }] }]);
  const tela = render(<StatusOperacionaisAnimal animalId="a" propriedadeId={7} revisao={0}/>);
  await screen.findByText("Protocolo reprodutivo programado");
  vi.mocked(reqV4).mockResolvedValue([{ participantes: [{ animalId: "a", inicioEfetivo: "2026-01-01", encerradoEm: null }] }]);
  tela.rerender(<StatusOperacionaisAnimal animalId="a" propriedadeId={7} revisao={1}/>);
  await screen.findByText("Em protocolo reprodutivo");
  expect(screen.queryByText(/Saudável/)).toBeNull();
});
it("ignora ocorrências e protocolos do contexto anterior e distingue erro de ausência", async () => {
  let resolver: (v: unknown) => void = () => {};
  vi.mocked(reqSanidade).mockReturnValueOnce(new Promise(resolve => { resolver = resolve; })).mockRejectedValueOnce(new Error("Indisponível"));
  vi.mocked(reqV4).mockResolvedValue([]);
  const tela = render(<StatusOperacionaisAnimal animalId="a" propriedadeId={7} revisao={0}/>);
  tela.rerender(<StatusOperacionaisAnimal animalId="b" propriedadeId={8} revisao={0}/>);
  await screen.findByText("Ocorrências não consultadas");
  await act(async () => resolver([{ id: "o", status: "VALIDO", inicio: "2020-01-01", fim: null, doenca: { nome: "Doença antiga" } }]));
  expect(screen.queryByText("Doença antiga")).toBeNull();
});
