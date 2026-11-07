// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ParticipacaoProtocolo } from "./ParticipacaoProtocolo";
const mocks = vi.hoisted(() => ({ cabecalho: vi.fn() }));
vi.mock("./api", () => ({ obterCabecalhoProtocolo: mocks.cabecalho }));
vi.mock("./OperacaoProtocolo", () => ({ OperacaoProtocolo: ({ revisao }: { revisao: number }) => <span>Revisão {revisao}</span> }));
vi.mock("../reproducao/RevisaoBloqueioParticipacao", () => ({ RevisaoBloqueioParticipacao: ({ aoConfirmar }: { aoConfirmar: () => void }) => <button onClick={aoConfirmar}>Confirmar bloqueio</button> }));
afterEach(cleanup);
beforeEach(() => { mocks.cabecalho.mockReset(); mocks.cabecalho.mockResolvedValue({ id: "p", modo: "INDIVIDUAL", tipo: "REPRODUTIVO", status: "ABERTA", propriedadeId: 1, nome: "Lua", bloqueadaEm: "2026-11-07T10:00:00Z", motivoBloqueio: "Conferência pendente" }); });
it("revisa participação individual e atualiza cabeçalho e executor", async () => {
 render(<ParticipacaoProtocolo id="p" tipo="REPRODUTIVO" propriedadeId={1} podeLancar />);
 fireEvent.click(await screen.findByRole("button", { name: "Revisar bloqueio" }));
 fireEvent.click(screen.getByRole("button", { name: "Confirmar bloqueio" }));
 await screen.findByText("Revisão 1");
 await waitFor(() => expect(mocks.cabecalho).toHaveBeenCalledTimes(2));
 expect(mocks.cabecalho).toHaveBeenCalledWith({ participacaoId: "p" }, 1);
});
it.each([{ podeLancar: false, sitio: 1 }, { podeLancar: true, sitio: 2 }])("não oferece revisão sem escrita ou em outro sítio: %s", async ({ podeLancar, sitio }) => {
 render(<ParticipacaoProtocolo id="p" tipo="REPRODUTIVO" propriedadeId={sitio} podeLancar={podeLancar} />);
 await screen.findByText("Participação bloqueada");
 expect(screen.queryByRole("button", { name: "Revisar bloqueio" })).toBeNull();
});
