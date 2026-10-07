// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DetalheSanitario } from "./DetalheSanitario";
vi.mock("../../../estoque/navegacao", () => ({ podeAcessarArea: () => true }));
afterEach(cleanup);
it("exibe nomes históricos no desvio e oculta IDs legados sem nome preservado", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  render(<DetalheSanitario tipo="exame" abrir={vi.fn()} valor={{ tarefaId: "t", desvioProtocoloSnapshot: { exibicao: { planejado: { tipoExameId: "Exame histórico" }, realizado: { tipoExameId: "Exame realizado" } }, diferencas: [{ campo: "tipoExameId", planejado: id, realizado: id }, { campo: "produtoId", planejado: id, realizado: id }], motivo: "Mudança autorizada" } }} />);
  expect(screen.getByText("Tipo de exame: Exame histórico → Exame realizado")).toBeTruthy();
  expect(screen.getByText("Produto: Identificação não disponível no registro original → Identificação não disponível no registro original")).toBeTruthy();
  expect(document.body.textContent).not.toContain(id);
});
it("distingue snapshot antigo não aferido de execução conforme o planejado", () => {
  const { rerender } = render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ tarefaId: "t", desvioProtocoloSnapshot: null }} />);
  expect(screen.getByText("Desvio não aferido no registro original.")).toBeTruthy();
  expect(screen.queryByText("Conforme o planejado.")).toBeNull();
  rerender(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ tarefaId: "t", desvioProtocoloSnapshot: { referencia: "SNAPSHOT_PLANEJADO", diferencas: [], motivo: null } }} />);
  expect(screen.getByText("Conforme o planejado.")).toBeTruthy();
  expect(screen.queryByText("Desvio não aferido no registro original.")).toBeNull();
});
it("mostra snapshots, horário, vínculos e compra sem expor referência técnica", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ animal: { id: "a1", brinco: "GV3-1", nome: null }, propriedadeId: 1, aplicadaEm: "2026-10-05T13:04:00Z", tipoAplicacaoNomeSnapshot: "Tratamento antigo", nomeProdutoAplicado: "Medicamento histórico", origemInsumo: "COMPRA_CONSUMO_DIRETO", status: "VALIDO", referenciaCarencia: "Não mostrar", compraDireta: { quantidadeDestinada: "2", unidade: "mL", operacao: { id: "op1", numero: 12 } }, estorno: { id: "m1" } }} />);
  expect(screen.getByText("05/10/2026 às 10:04")).toBeTruthy();
  expect(screen.getByText("Tratamento antigo")).toBeTruthy();
  expect(screen.getByRole("link", { name: "GV3-1" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Operação #12" }).getAttribute("href")).toBe("/financeiro/operacoes/op1");
  expect(screen.queryByText("Não mostrar")).toBeNull();
  expect(screen.queryByText("null")).toBeNull();
});
it("preserva o dia de validade e identifica o sítio histórico", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ propriedade: { id: 1, nome: "Sítio de origem" }, partidaValidadeSnapshot: "2027-09-17T00:00:00.000Z", data: "2026-10-05T00:00:00.000Z" }} />);
  expect(screen.getByText("17/09/2027")).toBeTruthy();
  expect(screen.getByText("05/10/2026")).toBeTruthy();
  expect(screen.getByText("Sítio de origem")).toBeTruthy();
});
it("torna a justificativa original consultável mesmo após reconciliar a origem", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ origemInsumo: "BAIXA_ESTOQUE", justificativaSemOrigem: "Aplicação de campo sem comprovante de origem" }} />);
  expect(screen.getByText("Justificativa original da origem:")).toBeTruthy();
  expect(screen.getByText("Aplicação de campo sem comprovante de origem")).toBeTruthy();
});
it("distingue o Produto vinculado do nome preservado da aplicação", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ produto: { id: "p1", nome: "Nome cadastrado" }, nomeProdutoAplicado: "Nome usado no campo" }} />);
  expect(screen.getByRole("link", { name: "Nome cadastrado" }).getAttribute("href")).toBe("/estoque/produtos/p1");
  expect(screen.getByText(/Nome histórico do medicamento/).parentElement?.textContent).toContain("Nome usado no campo");
});
