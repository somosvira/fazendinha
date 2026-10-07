// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SanidadeAnimal } from "./SanidadeAnimal";
import { reqSanidade, type AplicacaoSanitaria } from "./api";
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), consultarCarencia: vi.fn().mockResolvedValue({ leite: { estado: "NENHUMA" }, carne: { estado: "NENHUMA" } }), listarAplicacoes: vi.fn().mockResolvedValue([]), reqSanidade: vi.fn().mockResolvedValue({ nomeProdutoAplicado: "Medicamento", aplicadaEm: "2026-10-05T13:04:00Z", tipoAplicacaoNomeSnapshot: "Tipo preservado" }) }));
vi.mock("./HistoricoSanitario", () => ({ HistoricoSanitario: () => null }));
vi.mock("./FormAplicacaoServico", () => ({ FormAplicacaoServico: () => null }));
vi.mock("./ReconciliarOrigem", () => ({ ReconciliarOrigem: () => null }));
const aplicacao = { id: "a1", animalId: "animal1", animal: { id: "animal1", brinco: "GV3-1", nome: null }, propriedadeId: 1, data: "2026-10-05", aplicadaEm: "2026-10-05T13:04:00Z", tipoAplicacaoNomeSnapshot: "Tipo preservado", nomeProdutoAplicado: "Medicamento", dose: "2", unidadeDose: "mL", status: "VALIDO", origemInsumo: "SEM_ORIGEM_JUSTIFICADA", estadoCarenciaLeite: "INFORMADO", estadoCarenciaCarne: "INFORMADO", carenciaLeiteHoras: 0, carenciaCarneHoras: 48 } as AplicacaoSanitaria;
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
it("mostra tabela geral com colunas completas mesmo com filtro individual", async () => {
  render(<SanidadeAnimal geral animalId="animal1" propriedadeId={2} podeLancar recarregarToken={0} lista={[aplicacao]} />);
  await screen.findByRole("table");
  for (const nome of ["Animal", "Data e hora", "Tipo", "Produto vinculado / nome histórico", "Quantidade", "Origem", "Situação", "Ações"]) expect(screen.getByRole("columnheader", { name: nome })).toBeTruthy();
  expect(screen.getAllByText("05/10/2026 às 10:04").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: /Reconciliar origem de/ }).length).toBeGreaterThan(0);
  expect(screen.queryByText(/null/)).toBeNull();
});
it("anula pelo sítio histórico da aplicação e mantém leitura sem ações", async () => {
  const abrirDetalhe = vi.fn();
  const { rerender } = render(<SanidadeAnimal geral animalId="" propriedadeId={null} podeLancar recarregarToken={0} lista={[aplicacao]} abrirDetalhe={abrirDetalhe} />);
  await screen.findByRole("table");
  fireEvent.click(screen.getAllByRole("button", { name: /Anular aplicação de/ })[0]);
  expect(abrirDetalhe).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Motivo da correção / anulação"), { target: { value: "Lançamento incorreto" } });
  fireEvent.submit(document.getElementById("correcao-sanitaria")!);
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/aplicacoes/a1/anulacao", expect.objectContaining({ body: JSON.stringify({ propriedadeId: 1, motivo: "Lançamento incorreto" }) })));
  rerender(<SanidadeAnimal geral animalId="" propriedadeId={null} podeLancar={false} recarregarToken={0} lista={[aplicacao]} />);
  expect(screen.queryByRole("button", { name: /Anular aplicação de/ })).toBeNull();
});
it("abre detalhe compartilhado na ficha e fecha por Escape restaurando foco", async () => {
  render(<SanidadeAnimal animalId="animal1" propriedadeId={2} podeLancar={false} recarregarToken={0} lista={[aplicacao]} />);
  const botao = (await screen.findAllByRole("button", { name: /Ver detalhes de/ }))[0];
  botao.focus(); fireEvent.click(botao);
  await screen.findByRole("dialog");
  await waitFor(() => expect(screen.getByRole("dialog").textContent).toContain("05/10/2026 às 10:04"));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(botao));
});
