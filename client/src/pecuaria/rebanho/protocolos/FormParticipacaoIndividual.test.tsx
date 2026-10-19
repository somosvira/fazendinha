// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FormParticipacaoIndividual } from "./FormParticipacaoIndividual";
import { reqProtocolo } from "./api";
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqProtocolo: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("confere calendário individual e retry preserva chave sem criar programação artificial", async () => {
  let gravacoes = 0;
  vi.mocked(reqProtocolo).mockImplementation(async path => {
    if (path.startsWith("/versoes")) return { itens: [{ id: "p1", nome: "Protocolo", versao: 1 }], total: 1, pagina: 1, porPagina: 10 };
    if (path === "/participacoes/previa") return { itens: [{ id: "e1", nome: "Aplicação", previstaPara: "2026-10-19", precisaoTemporal: "DIA" }], total: 1, pagina: 1, porPagina: 10, avisos: ["A prévia não inscreve o animal."] };
    gravacoes++; if (gravacoes === 1) throw new Error("Resposta interrompida"); return { id: "individual1" };
  });
  const salvo = vi.fn(); render(<FormParticipacaoIndividual animalId="animal1" propriedadeId={7} onFechar={vi.fn()} onSalvo={salvo} />);
  await screen.findByRole("option", { name: "Protocolo · v1" });
  fireEvent.change(screen.getByLabelText("Protocolo publicado"), { target: { value: "p1" } });
  fireEvent.change(screen.getByLabelText("Início previsto"), { target: { value: "2026-10-19" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Conferi o contexto sanitário e reprodutivo deste animal." }));
  fireEvent.click(screen.getByRole("button", { name: "Conferir calendário" }));
  await screen.findByText("Calendário previsto");
  expect(vi.mocked(reqProtocolo).mock.calls.filter(([path]) => path === "/participacoes")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar participação" }));
  await screen.findAllByText("Resposta interrompida");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar participação" }));
  await waitFor(() => expect(salvo).toHaveBeenCalledWith("individual1"));
  const escritas = vi.mocked(reqProtocolo).mock.calls.filter(([path]) => path === "/participacoes");
  expect(escritas[0][2]).toEqual(escritas[1][2]);
  expect(escritas[0][2]).toMatchObject({ tipo: "REPRODUTIVO", animalId: "animal1", propriedadeId: 7, protocoloId: "p1", inicioReferencia: "2026-10-19" });
  expect(escritas[0][2]).not.toHaveProperty("programacaoId");
});
