// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Iatf } from "./Iatf";
import { reqV4 } from "./api";
vi.mock("./api", () => ({ reqV4: vi.fn() }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([]) }));
vi.mock("../api", () => ({ listarMaterialGenetico: vi.fn().mockResolvedValue([]) }));
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), obterCabecalhoProtocolo: vi.fn().mockResolvedValue({ id: "g", nome: "Turma", status: "ABERTA", tipo: "REPRODUTIVO", protocolo: { id: "p", nome: "Protocolo", versao: 1 }, inicioReferencia: "2026-10-19", precisaoTemporal: "DIA" }), reqProtocolo: vi.fn().mockResolvedValue({ exigeCiencia: false, modoLegado: false, itens: [], total: 0, pagina: 1, porPagina: 10 }) }));
vi.mock("../protocolos/OperacaoProtocolo", () => ({ OperacaoProtocolo: ({ aoSalvar }: { aoSalvar: () => void }) => <button onClick={aoSalvar}>Concluir atendimento conjunto</button> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("conclusão comum atualiza programação uma vez sem abrir a fila legada", async () => {
  const onMudou = vi.fn();
  vi.mocked(reqV4).mockImplementation(async path => path.startsWith("/reproducao/programacoes/g") ? { id: "g", nome: "Turma", protocoloId: "p", status: "ABERTA", participantes: [] } : []);
  render(<Iatf programacaoId="g" propriedadeId={1} animais={[]} painel={{ animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] }} podeLancar onMudou={onMudou} />);
  fireEvent.click(await screen.findByRole("button", { name: "Concluir atendimento conjunto" }));
  await waitFor(() => expect(onMudou).toHaveBeenCalledTimes(1));
  expect(vi.mocked(reqV4).mock.calls.some(([path]) => path.includes("/tarefas-iatf/"))).toBe(false);
});
