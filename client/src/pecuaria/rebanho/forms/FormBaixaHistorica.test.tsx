// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { alterarControle } from "../../../lib/controles.fixture";
import { FormBaixaHistorica } from "./FormBaixaHistorica";
import { regularizarBaixaHistorica, revisarClassificacaoBaixa, RebanhoApiError } from "../api";
import { consultarCarencia } from "../sanidade/api";

vi.mock("../api", async (original) => ({ ...await original<typeof import("../api")>(), regularizarBaixaHistorica: vi.fn(), revisarClassificacaoBaixa: vi.fn() }));
vi.mock("../sanidade/api", () => ({ consultarCarencia: vi.fn() }));
const animal = { id: "a1", brinco: "0412", nome: "Rosa" };
const origem = { bancoOrigem: "IDEAGRI", chaveOrigem: "412", evidencia: "Extrato conferido", motivo: "Saída comprovada", usuarioId: 1, registradaEm: "2026-10-29T12:00:00Z", revisao: null };
const baixa = { id: "b1", data: "2024-08-12", tipo: "NAO_DETERMINADO" as const, motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null, criadoPor: "Ana", regularizacaoHistorica: origem };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(consultarCarencia).mockResolvedValue({ leite: { estado: "NENHUMA" }, carne: { estado: "NENHUMA" } }); });
afterEach(cleanup);
async function preencher() {
  await alterarControle(screen.getByLabelText("Data comprovada da saída"), { target: { value: "2024-08-12" } });
  fireEvent.change(screen.getByLabelText("Fonte de origem"), { target: { value: "IDEAGRI" } });
  fireEvent.change(screen.getByLabelText("Identificador na origem"), { target: { value: "412" } });
  fireEvent.change(screen.getByLabelText("Evidência de origem"), { target: { value: "Extrato conferido" } });
  fireEvent.change(screen.getByLabelText("Justificativa da regularização"), { target: { value: "Saída comprovada" } });
}
it("valida campos e focaliza a primeira ausência antes de conferir", async () => {
  render(<FormBaixaHistorica animal={animal} motivos={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Conferir baixa" }));
  expect(await screen.findByText("Informe a data comprovada da saída.")).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Data comprovada da saída")));
  expect(regularizarBaixaHistorica).not.toHaveBeenCalled();
});
it("confere os efeitos antes de enviar uma única baixa com a identidade histórica", async () => {
  vi.mocked(regularizarBaixaHistorica).mockResolvedValue({ id: "b1" });
  const onSalvo = vi.fn();
  render(<FormBaixaHistorica animal={animal} motivos={[]} onSalvo={onSalvo} onFechar={vi.fn()} />);
  await preencher();
  fireEvent.click(screen.getByRole("button", { name: "Conferir baixa" }));
  const confirmar = await screen.findByRole("button", { name: "Confirmar regularização" });
  expect(regularizarBaixaHistorica).not.toHaveBeenCalled();
  fireEvent.click(confirmar); fireEvent.click(confirmar);
  await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
  expect(regularizarBaixaHistorica).toHaveBeenCalledTimes(1);
  expect(regularizarBaixaHistorica).toHaveBeenCalledWith("a1", { data: "2024-08-12", bancoOrigem: "IDEAGRI", chaveOrigem: "412", evidencia: "Extrato conferido", motivo: "Saída comprovada" });
  expect(revisarClassificacaoBaixa).not.toHaveBeenCalled();
});
it("preserva o rascunho e associa erro do servidor ao campo", async () => {
  vi.mocked(regularizarBaixaHistorica).mockRejectedValue(new RebanhoApiError("Origem já regularizada", 409, "CONFLITO", "chaveOrigem"));
  render(<FormBaixaHistorica animal={animal} motivos={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
  await preencher(); fireEvent.click(screen.getByRole("button", { name: "Conferir baixa" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar regularização" }));
  expect(await screen.findByText("Origem já regularizada")).toBeTruthy();
  expect(screen.getByLabelText("Identificador na origem")).toHaveProperty("value", "412");
  expect(screen.getByLabelText("Evidência de origem")).toHaveProperty("value", "Extrato conferido");
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Identificador na origem")));
});
it("revisa a mesma baixa e conserva a chave no reenvio após falha de rede", async () => {
  vi.mocked(revisarClassificacaoBaixa).mockRejectedValueOnce(new Error("Sem conexão")).mockResolvedValue({ id: "b1" });
  const onSalvo = vi.fn();
  render(<FormBaixaHistorica animal={animal} baixa={baixa} motivos={[]} onSalvo={onSalvo} onFechar={vi.fn()} />);
  expect(screen.queryByLabelText("Data comprovada da saída")).toBeNull();
  expect(screen.getByText("Extrato conferido")).toBeTruthy();
  await alterarControle(screen.getByLabelText("Nova classificação"), { target: { value: "MORTE" } });
  fireEvent.change(screen.getByLabelText("Evidência da classificação"), { target: { value: "Atestado conferido" } });
  fireEvent.change(screen.getByLabelText("Motivo da revisão"), { target: { value: "Documento esclarece a saída" } });
  fireEvent.click(screen.getByRole("button", { name: "Conferir classificação" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar classificação" }));
  expect(await screen.findByText("Sem conexão")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar classificação" }));
  await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
  const envios = vi.mocked(revisarClassificacaoBaixa).mock.calls;
  expect(envios).toHaveLength(2);
  expect(envios[0]).toEqual(envios[1]);
  expect(envios[0]).toEqual(["a1", "b1", expect.objectContaining({ chave: expect.any(String), tipo: "MORTE", motivoId: null, evidencia: "Atestado conferido", motivo: "Documento esclarece a saída" })]);
  expect(regularizarBaixaHistorica).not.toHaveBeenCalled();
});
it("exige ciência e justificativa da carência histórica antes da prévia", async () => {
  vi.mocked(consultarCarencia).mockResolvedValue({ leite: { estado: "NAO_INFORMADO" }, carne: { estado: "NENHUMA" } });
  render(<FormBaixaHistorica animal={animal} motivos={[]} onSalvo={vi.fn()} onFechar={vi.fn()} />);
  await preencher();
  await screen.findByRole("switch");
  fireEvent.click(screen.getByRole("button", { name: "Conferir baixa" }));
  expect(await screen.findByText("Confirme a ciência das restrições sanitárias.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Confirmar regularização" })).toBeNull();
});
