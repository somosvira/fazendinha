// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DashboardListaModal } from "./DashboardListaModal";
import { obterExtratoGeral, type MovimentoGeral } from "./novo-api";
vi.mock("./novo-api", () => ({ obterExtratoGeral: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const movimento = (seq: number, data: string, tipo = "RECEBIMENTO"): MovimentoGeral => ({ id: `m${seq}`, seq, contaId: "c1", conta: { id: "c1", nome: "Banco", instituicao: null }, direcao: tipo === "REVERSAO" ? "SAIDA" : "ENTRADA", valor: "10", transacao: { id: `t${seq}`, seq, tipo, status: "CONFIRMADA", data, descricao: `Movimento ${seq}`, formaPagamento: null, parceiro: null, operacao: null, reversaoDe: tipo === "REVERSAO" ? { tipo: "RECEBIMENTO" } : null } });
it("carrega recentes no período, exclui transferências e preserva estornos", async () => {
  let resolver!: (dados: MovimentoGeral[]) => void;
  vi.mocked(obterExtratoGeral).mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  render(<DashboardListaModal tipo="recebimentos" inicio="2026-10-01" fim="2026-10-31" pendentes={[]} onClose={vi.fn()} />);
  expect(screen.getByRole("status", { name: "Carregando recebimentos" })).toBeTruthy();
  resolver([movimento(1, "2026-09-30"), movimento(2, "2026-10-01"), movimento(3, "2026-10-02", "TRANSFERENCIA"), movimento(4, "2026-10-03", "REVERSAO")]);
  await screen.findByText("Movimento 4");
  expect(screen.queryByText("Movimento 1")).toBeNull();
  expect(screen.queryByText("Movimento 3")).toBeNull();
  expect(screen.getAllByRole("listitem").map(item => item.textContent)).toEqual([expect.stringContaining("Movimento 4"), expect.stringContaining("Movimento 2")]);
});
it("permite tentar novamente depois de falhar", async () => {
  vi.mocked(obterExtratoGeral).mockRejectedValueOnce(new Error("Falha de rede")).mockResolvedValueOnce([]);
  render(<DashboardListaModal tipo="pagamentos" inicio="2026-10-01" fim="2026-10-31" pendentes={[]} onClose={vi.fn()} />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhum item no período selecionado.");
  await waitFor(() => expect(obterExtratoGeral).toHaveBeenCalledTimes(2));
});
it("pagina os movimentos sem ocultar os demais", async () => {
  vi.mocked(obterExtratoGeral).mockResolvedValue(Array.from({ length: 16 }, (_, indice) => movimento(indice, "2026-10-01")));
  render(<DashboardListaModal tipo="recebimentos" inicio="2026-10-01" fim="2026-10-31" pendentes={[]} onClose={vi.fn()} />);
  await screen.findByText("Movimento 15");
  expect(screen.getAllByRole("listitem")).toHaveLength(15);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Movimento 0")).toBeTruthy();
});
it("separa a pagar de a receber e permite abrir o compromisso sem buscar extrato", async () => {
  const pagar = { id: "p1", seq: 1, tipo: "PAGAR" as const, status: "PENDENTE", saldoPendente: "80", valorOriginal: "80", valorLiquidado: "0", dataVencimento: "2026-10-05", numeroParcela: 1, totalParcelas: 1, vencido: true, parceiro: null, operacao: { id: "o1", numero: 1, descricao: "Veterinário", tipo: "SERVICO" } };
  const receber = { ...pagar, id: "p2", tipo: "RECEBER" as const, operacao: { ...pagar.operacao, descricao: "Venda de leite" } };
  render(<DashboardListaModal tipo="pagar" inicio="2026-10-01" fim="2026-10-31" pendentes={[pagar, receber]} onClose={vi.fn()} />);
  expect(screen.queryByText("Venda de leite")).toBeNull();
  expect(obterExtratoGeral).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Veterinário/ }));
  expect(screen.getByRole("dialog", { name: "Detalhes do compromisso" })).toBeTruthy();
});
