// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Iatf } from "./Iatf";
import { reqV4 } from "./api";
vi.mock("./api", () => ({ reqV4: vi.fn() }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([]) }));
vi.mock("../api", () => ({ listarMaterialGenetico: vi.fn().mockResolvedValue([]) }));
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), obterCabecalhoProtocolo: vi.fn().mockResolvedValue({ id: "g", nome: "Turma", status: "ABERTA", tipo: "REPRODUTIVO", protocolo: { id: "p", nome: "Protocolo", versao: 1 }, inicioReferencia: "2026-10-19", precisaoTemporal: "DIA" }), reqProtocolo: vi.fn().mockResolvedValue({ exigeCiencia: false, modoLegado: false, itens: [], total: 0, pagina: 1, porPagina: 10 }) }));
vi.mock("../protocolos/OperacaoProtocolo", () => ({ OperacaoProtocolo: ({ aoExecutar }: { aoExecutar: (t: unknown[]) => void }) => <button onClick={() => aoExecutar([1, 2].map(n => ({ id: `t${n}`, animal: { id: `a${n}` }, tarefaOrigem: { id: `t${n}`, nome: `Manejo ${n}`, tipo: "MANEJO", previstaEm: "2026-10-19", precisaoTemporal: "DIA", status: "PENDENTE" } })))}>Atender duas selecionadas</button> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("fila remonta executor por tarefa; retry conserva chave e próximo animal recebe outra", async () => {
  let tentativa = 0;
  vi.mocked(reqV4).mockImplementation(async (path, body) => {
    if (path.endsWith("/execucao")) { tentativa++; if (tentativa === 1) throw new Error("Resposta interrompida"); return {}; }
    if (path.startsWith("/reproducao/programacoes/g")) return { id: "g", nome: "Turma", protocoloId: "p", status: "ABERTA", participantes: [] };
    return [];
  });
  render(<Iatf programacaoId="g" propriedadeId={1} animais={[]} painel={{ animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] }} podeLancar />);
  fireEvent.click(await screen.findByRole("button", { name: "Atender duas selecionadas" }));
  fireEvent.change(screen.getByLabelText("Data realizada"), { target: { value: "2026-10-19" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByText("Resposta interrompida");
  await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByRole("heading", { name: "Executar Manejo 2" });
  expect((screen.getByLabelText("Data realizada") as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Data realizada"), { target: { value: "2026-10-19" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await waitFor(() => expect(vi.mocked(reqV4).mock.calls.filter(([path]) => path.endsWith("/execucao"))).toHaveLength(3));
  const escritas = vi.mocked(reqV4).mock.calls.filter(([path]) => path.endsWith("/execucao"));
  expect(escritas.map(([path]) => path)).toEqual(["/reproducao/tarefas-iatf/t1/execucao", "/reproducao/tarefas-iatf/t1/execucao", "/reproducao/tarefas-iatf/t2/execucao"]);
  expect(escritas[0][1]).toMatchObject({ chave: (escritas[1][1] as { chave: string }).chave });
  expect((escritas[2][1] as { chave: string }).chave).not.toBe((escritas[0][1] as { chave: string }).chave);
});
