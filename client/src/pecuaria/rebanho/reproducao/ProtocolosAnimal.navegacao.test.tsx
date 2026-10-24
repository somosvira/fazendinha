// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProtocolosAnimal, type VinculoColetivoAnimal } from "./ProtocolosAnimal";
const req = vi.hoisted(() => vi.fn());
vi.mock("../protocolos/api", async importOriginal => ({ ...await importOriginal<object>(), reqProtocolo: req }));
afterEach(() => { cleanup(); req.mockReset(); window.history.replaceState(null, "", "/"); });
const vinculo = (i: number): VinculoColetivoAnimal => ({ id: `p${i}`, animalId: "animal", protocolo: { id: `v${i}`, nome: `Protocolo ${i}`, versao: 1 }, programacao: { id: `g${i}`, nome: `Grupo ${i}` }, inicioReferencia: "2026-10-19", inicioEfetivo: null, encerradoEm: null, motivoEncerramento: null });
it("consulta dez resumos e destaca contexto selecionado fora da página sem carregar tarefas", async () => {
  window.history.replaceState(null, "", "/pecuaria/rebanho/animais/animal?participacaoId=p21&programacaoId=g21&sitio=7&retorno=%2Fpecuaria%2Freproducao%2Fprogramacoes%2Fg21#reproducao");
  req.mockImplementation(async (c: string) => { const q = new URL(c, "http://localhost").searchParams; return { itens: q.has("participacaoId") ? [vinculo(21)] : Array.from({ length: 10 }, (_, i) => vinculo(i + 1 + (Number(q.get("pagina")) - 1) * 10)), total: q.has("participacaoId") ? 1 : 21, pagina: Number(q.get("pagina")), porPagina: 10 }; });
  render(<ProtocolosAnimal animalId="animal" propriedadeId={7} />);
  expect((await screen.findByLabelText("Participação selecionada")).textContent).toContain("Protocolo 21");
  expect(screen.getByText("1–10 de 21 participações coletivas")).toBeTruthy();
  expect(req.mock.calls.every(([c, sitio]) => c.includes("/vinculos-coletivos?") && c.includes("porPagina=10") && sitio === 7)).toBe(true);
  const links = screen.getAllByRole("link", { name: "Ver programação" });
  expect(links[0].getAttribute("href")).toContain("/programacoes/g21?retorno=");
  expect(links[0].getAttribute("href")).toContain("&sitio=7");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Busca" } });
  await waitFor(() => expect(req.mock.calls.some(([c]) => c.includes("busca=Busca") && c.includes("pagina=1"))).toBe(true));
});
