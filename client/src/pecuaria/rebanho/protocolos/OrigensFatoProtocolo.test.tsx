// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrigensFatoProtocolo } from "./OrigensFatoProtocolo";
const req = vi.hoisted(() => vi.fn());
vi.mock("./api", async importOriginal => ({ ...await importOriginal<object>(), reqProtocolo: req }));
afterEach(() => { cleanup(); req.mockReset(); });
it("consulta origem persistida só ao expandir, com sítio e exame, preservando link e falha explícita", async () => {
  req.mockRejectedValueOnce(new Error("Origem indisponível")).mockResolvedValue({ itens: [{ participacaoId: "p", protocolo: { id: "v", nome: "Protocolo real", versao: 2 }, programacao: { id: "g", nome: "Turma" } }], total: 1, pagina: 1, porPagina: 10 });
  render(<OrigensFatoProtocolo animalId="a" fatoId="f" exameId="e" propriedadeId={7}/>);
  expect(req).not.toHaveBeenCalled();
  const details = screen.getByText("Consultar origem no protocolo").closest("details")!;
  details.open = true; fireEvent(details, new Event("toggle"));
  expect(await screen.findByText("Origem indisponível")).toBeTruthy();
  expect(screen.queryByText("Sem vínculo registrado.")).toBeNull();
  fireEvent.click(screen.getByText("Tentar consultar origem novamente"));
  const link = await screen.findByRole("link", { name: "Protocolo real · v2 · Turma" });
  expect(link.getAttribute("href")).toContain("/programacoes/g?retorno=");
  expect(link.getAttribute("href")).toContain("&sitio=7");
  await waitFor(() => expect(req.mock.calls[0]).toEqual(["/origens-fato?animalId=a&fatoId=f&exameId=e&pagina=1&porPagina=10", 7]));
});
it("pagina vínculos de origem em dez registros mantendo o fato e o sítio", async () => {
  req.mockImplementation(async (c: string) => { const pagina = Number(new URL(c, "http://localhost").searchParams.get("pagina")); return { itens: Array.from({ length: pagina === 1 ? 10 : 1 }, (_, i) => ({ participacaoId: `p${(pagina - 1) * 10 + i}`, protocolo: { id: "v", nome: `Origem ${(pagina - 1) * 10 + i}`, versao: 1 }, programacao: null })), total: 11, pagina, porPagina: 10 }; });
  render(<OrigensFatoProtocolo animalId="a" fatoId="f" propriedadeId={7}/>);
  const details = screen.getByText("Consultar origem no protocolo").closest("details")!; details.open = true; fireEvent(details, new Event("toggle"));
  await screen.findByText("1–10 de 11 vínculos de origem");
  expect(screen.getAllByRole("link")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(await screen.findByText("11–11 de 11 vínculos de origem")).toBeTruthy();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(req.mock.calls.at(-1)).toEqual(["/origens-fato?animalId=a&fatoId=f&pagina=2&porPagina=10", 7]);
});
