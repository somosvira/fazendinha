// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReconciliarOrigem } from "./ReconciliarOrigem";
import { reqSanidade, SanidadeApiError, type AplicacaoSanitaria } from "./api";
import { listarProdutos } from "../../../estoque/api";
import { listarPartidasNutricionais } from "../nutricao/api";
vi.mock("../../../financeiro/financeiro-ui", () => ({ Button: ({ secondary: _s, ...p }: Record<string, unknown>) => <button {...p} />, ErrorBox: ({ erro }: { erro: string | null }) => erro && <p>{erro}</p> }));
vi.mock("../../../financeiro/PainelCadastro", () => ({ classeInput: "", PainelCadastro: ({ children, rodape }: { children: React.ReactNode; rodape: React.ReactNode }) => <div>{children}{rodape}</div>, CampoFormulario: ({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: (p: object) => React.ReactNode }) => <label>{rotulo}{children({ id, "aria-label": rotulo })}{erro && <span>{erro}</span>}</label> }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([{ id: "p1", nome: "Nome cadastrado", unidade: "ML", usoSanitario: true }, { id: "p2", nome: "Não sanitário", unidade: "ML", usoSanitario: false }, { id: "p3", nome: "Outra unidade", unidade: "KG", usoSanitario: true }]) }));
vi.mock("../nutricao/api", () => ({ listarPartidasNutricionais: vi.fn().mockResolvedValue([]) }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), listarServicos: vi.fn().mockResolvedValue([{ id: "s1", numero: 1 }]), listarComprasDiretas: vi.fn().mockResolvedValue([]), reqSanidade: vi.fn().mockResolvedValue({}) }));
const aplicacao = { id: "a1", nomeProdutoAplicado: "Nome livre antigo", dose: "2", unidadeDose: "mL", propriedadeId: 1 } as AplicacaoSanitaria;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(reqSanidade).mockResolvedValue({}); });
afterEach(cleanup);
async function preencher() {
  await screen.findByRole("option", { name: "Nome cadastrado" });
  fireEvent.change(screen.getByLabelText("Origem localizada"), { target: { value: "BAIXA_ESTOQUE" } });
  fireEvent.change(screen.getByLabelText("Produto correspondente"), { target: { value: "p1" } });
  fireEvent.change(screen.getByLabelText("Motivo e evidência da reconciliação"), { target: { value: "Nota e bula conferidas" } });
}
it("oferece nomes distintos sanitários compatíveis e exige equivalência explícita", async () => {
  render(<ReconciliarOrigem aplicacao={aplicacao} propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await preencher();
  expect(screen.queryByRole("option", { name: "Não sanitário" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Outra unidade" })).toBeNull();
  fireEvent.submit(document.getElementById("reconciliar-origem")!);
  expect(reqSanidade).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch"));
  fireEvent.submit(document.getElementById("reconciliar-origem")!);
  await waitFor(() => expect(reqSanidade).toHaveBeenCalled());
  expect(JSON.parse(vi.mocked(reqSanidade).mock.calls[0][1]!.body as string)).toMatchObject({ propriedadeId: 1, produtoId: "p1", confirmarEquivalencia: true, motivo: "Nota e bula conferidas" });
});
it("localiza erro da API e conserva medicamento, ciência e motivo", async () => {
  vi.mocked(reqSanidade).mockRejectedValueOnce(new SanidadeApiError("Confira a evidência do medicamento.", "INVALID", "motivo"));
  render(<ReconciliarOrigem aplicacao={aplicacao} propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await preencher(); fireEvent.click(screen.getByRole("switch")); fireEvent.submit(document.getElementById("reconciliar-origem")!);
  await waitFor(() => expect(screen.getAllByText("Confira a evidência do medicamento.")).toHaveLength(1));
  expect(screen.getByLabelText("Produto correspondente")).toHaveProperty("value", "p1");
  expect(screen.getByRole("switch")).toHaveProperty("checked", true);
  expect(screen.getByLabelText("Motivo e evidência da reconciliação")).toHaveProperty("value", "Nota e bula conferidas");
});
it("mantém o Produto já vinculado bloqueado", async () => {
  render(<ReconciliarOrigem aplicacao={{ ...aplicacao, produtoId: "p1" }} propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByRole("option", { name: "Nome cadastrado" });
  expect(screen.getByLabelText("Produto correspondente")).toHaveProperty("disabled", true);
  expect(screen.queryByRole("switch")).toBeNull();
});
it("aceita volume compatível e exige ciência explícita da validade desconhecida", async () => {
  vi.mocked(listarProdutos).mockResolvedValueOnce([{ id: "p1", nome: "Nome cadastrado", unidade: "L", usoSanitario: true, rastrearPartidas: true }] as Awaited<ReturnType<typeof listarProdutos>>);
  vi.mocked(listarPartidasNutricionais).mockResolvedValueOnce([{ id: "l1", codigo: "Lote conhecido", saldo: "1", validade: null }] as Awaited<ReturnType<typeof listarPartidasNutricionais>>);
  render(<ReconciliarOrigem aplicacao={{ ...aplicacao, nomeProdutoAplicado: "Nome cadastrado" }} propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await preencher();
  await screen.findByRole("option", { name: /Lote conhecido/ });
  fireEvent.change(screen.getByLabelText("Lote do Produto"), { target: { value: "l1" } });
  fireEvent.submit(document.getElementById("reconciliar-origem")!);
  expect(reqSanidade).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("switch", { name: /validade deste lote/ }));
  fireEvent.submit(document.getElementById("reconciliar-origem")!);
  await waitFor(() => expect(reqSanidade).toHaveBeenCalled());
  expect(JSON.parse(vi.mocked(reqSanidade).mock.calls[0][1]!.body as string)).toMatchObject({ partidaId: "l1", cienciaValidadeDesconhecida: true });
});
it("mostra o nome do lote, saldo com unidade e validade no dia correto", async () => {
  vi.mocked(listarProdutos).mockResolvedValueOnce([{ id: "p1", nome: "Nome cadastrado", unidade: "ML", usoSanitario: true, rastrearPartidas: true }] as Awaited<ReturnType<typeof listarProdutos>>);
  vi.mocked(listarPartidasNutricionais).mockResolvedValueOnce([{ id: "l1", codigo: "LOTE-7e6c5415-c5cb-48f9-9250-c540db5a9c00", nome: "Lote setembro 2027", saldo: "188.500", validade: "2027-09-17T00:00:00.000Z" }] as Awaited<ReturnType<typeof listarPartidasNutricionais>>);
  render(<ReconciliarOrigem aplicacao={{ ...aplicacao, unidadeDose: "ML" }} propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await preencher();
  const lote = await screen.findByRole("option", { name: "Lote setembro 2027 · saldo 188,5 mL · validade 17/09/2027" });
  expect(lote.textContent).not.toContain("LOTE-");
  expect(screen.getByText(/Nome livre antigo · 2 mL/)).toBeTruthy();
});
it("não oferece recarga de opções por uma falha de validação local", async () => {
  render(<ReconciliarOrigem aplicacao={aplicacao} propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await preencher();
  fireEvent.submit(document.getElementById("reconciliar-origem")!);
  expect(reqSanidade).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Recarregar opções" })).toBeNull();
  expect(document.getElementById("recon-equivalencia-erro")).toBeTruthy();
});
