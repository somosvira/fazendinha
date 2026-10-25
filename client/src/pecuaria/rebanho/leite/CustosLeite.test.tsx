// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CustosLeite } from "./CustosLeite";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 2 }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("natureza segue para o servidor e mantém custo sem vínculo a apurar", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ consolidado: { situacao: "NAO_APURADO", motivos: ["NATUREZA_SEM_VINCULO"], custoPorLitro: null, custos: { totalConhecido: null } }, porClassificacao: [] });
  render(<CustosLeite periodo={{ inicio: "2026-10-01", fim: "2026-10-31", natureza: "COLOSTRO" }} />);
  await screen.findByText(/Custos sem vínculo comprovado/);
  expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("natureza=COLOSTRO"), 2);
  expect(screen.queryByText("R$ 0,00")).toBeNull();
});
it("não exibe classificações, motivos ou valores monetários sem permissão", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ consolidado: { situacao: "OCULTO", motivos: ["SEGREDO"], custoPorLitro: "75", custos: { totalConhecido: "100" } }, porClassificacao: [{ finalidade: "SEGREDO", custos: { totalConhecido: "100" } }] });
  render(<CustosLeite />); await screen.findByText("Sem acesso a valores.");
  expect(screen.queryByText("SEGREDO")).toBeNull(); expect(screen.queryByRole("table")).toBeNull();
});
it("ignora resposta antiga quando o período muda", async () => {
  let resolver!: (r: unknown) => void;
  vi.mocked(consultarLeite).mockImplementationOnce(() => new Promise(r => { resolver = r; })).mockResolvedValue({ consolidado: { situacao: "OCULTO", motivos: [] } });
  const r = render(<CustosLeite periodo={{ inicio: "2026-10-01", fim: "2026-10-02" }} />);
  r.rerender(<CustosLeite periodo={{ inicio: "2026-10-03", fim: "2026-10-04" }} />);
  await screen.findByText("Sem acesso a valores."); resolver({ consolidado: { situacao: "NAO_APURADO", motivos: [], custos: { totalConhecido: "999" }, custoPorLitro: null }, porClassificacao: [] });
  await waitFor(() => expect(screen.queryByText(/999/)).toBeNull());
});
