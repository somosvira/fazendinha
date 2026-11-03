// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FormEncerrarLactacao } from "./FormEncerrarLactacao";
import { RebanhoApiError } from "../api";
import { reqV4 } from "./api";
import { lactacaoSecagem, vinculoSecagem } from "./PesoSecagem.fixture";
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), reqV4: vi.fn() }));
afterEach(cleanup); beforeEach(() => { vi.mocked(reqV4).mockReset(); });
function montar() { const salvo = vi.fn(); render(<FormEncerrarLactacao lactacao={{ ...lactacaoSecagem, encerradaEm: null, vinculosPesagemSecagem: [] }} animalRotulo="0412 — Rosa" propriedadeId={7} onSalvo={salvo} onFechar={vi.fn()} />); return salvo; }
async function preencher() { await alterarControle(screen.getByLabelText("Data de encerramento"), { target: { value: "2026-10-29" } }); fireEvent.change(screen.getByLabelText("Motivo do encerramento"), { target: { value: "Secagem programada" } }); }
it("encerramento manual aceita ausência de peso, usa sítio explícito e bloqueia envio concorrente", async () => {
  vi.mocked(reqV4).mockResolvedValue({}); const salvo = montar(); await preencher();
  expect(screen.getByLabelText("Como deseja informar o peso?")).toHaveProperty("value", "NAO_INFORMAR");
  const botao = screen.getByRole("button", { name: "Encerrar lactação" }); fireEvent.click(botao); fireEvent.click(botao);
  await waitFor(() => expect(salvo).toHaveBeenCalledTimes(1));
  expect(reqV4).toHaveBeenCalledTimes(1);
  expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes/l1/encerramento", expect.objectContaining({ propriedadeId: 7, data: "2026-10-29", motivo: "Secagem programada", chave: expect.any(String), pesoSecagem: { acao: "NAO_INFORMAR" } }), "POST", 7);
});
it("cria peso na mesma confirmação, sem presumir medição e exigindo igualdade de data", async () => {
  vi.mocked(reqV4).mockResolvedValue({}); montar(); await preencher();
  await alterarControle(screen.getByLabelText("Como deseja informar o peso?"), { target: { value: "REGISTRAR" } });
  expect(screen.getByLabelText("Precisão")).toHaveProperty("value", "NAO_INFORMADO");
  fireEvent.change(screen.getByLabelText("Peso da matriz (kg)"), { target: { value: "512" } });
  await alterarControle(screen.getByLabelText("Data real da pesagem"), { target: { value: "2026-10-28" } });
  fireEvent.click(screen.getByRole("button", { name: "Encerrar lactação" }));
  expect(await screen.findByText("A data da pesagem deve ser igual à data do encerramento.")).toBeTruthy(); expect(reqV4).not.toHaveBeenCalled();
  await alterarControle(screen.getByLabelText("Data real da pesagem"), { target: { value: "2026-10-29" } });
  await alterarControle(screen.getByLabelText("Precisão"), { target: { value: "ESTIMADO" } });
  fireEvent.click(screen.getByRole("button", { name: "Encerrar lactação" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes/l1/encerramento", expect.objectContaining({ pesoSecagem: { acao: "REGISTRAR", data: "2026-10-29", pesoKg: 512, origem: "MANUAL", precisao: "ESTIMADO", observacao: null } }), "POST", 7));
});
it("reutiliza identidade existente, conserva precisão desconhecida e desabilita candidato divergente", async () => {
  vi.mocked(reqV4).mockImplementation(async (_path, body) => body ? {} : { historicoPesagens: [{ ...vinculoSecagem.pesagem, precisao: "NAO_INFORMADO", propriedadeId: null, contextoHistorico: "NAO_INFORMADO" }, { ...vinculoSecagem.pesagem, id: "p0", data: "2026-10-28" }] });
  montar(); await preencher(); await alterarControle(screen.getByLabelText("Como deseja informar o peso?"), { target: { value: "VINCULAR" } });
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/animais/a1", undefined, "GET", 7));
  fireEvent.click(screen.getByLabelText("Pesagem existente"));
  expect(await screen.findByRole("option", { name: /Data diferente do encerramento/ })).toHaveProperty("ariaDisabled", "true");
  fireEvent.click(screen.getByRole("option", { name: /Precisão não informada/ }));
  expect(screen.getAllByText(/Precisão não informada/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Encerrar lactação" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes/l1/encerramento", expect.objectContaining({ pesoSecagem: { acao: "VINCULAR", pesagemId: "p1" } }), "POST", 7));
  expect(vi.mocked(reqV4).mock.calls.filter(c => c[1])).toHaveLength(1);
});
it("conserva campos e chave de reenvio após falha do servidor", async () => {
  vi.mocked(reqV4).mockRejectedValueOnce(new Error("Conflito de localização")).mockResolvedValue({}); montar(); await preencher();
  fireEvent.click(screen.getByRole("button", { name: "Encerrar lactação" })); await screen.findByText("Conflito de localização");
  expect(screen.getByLabelText("Motivo do encerramento")).toHaveProperty("value", "Secagem programada");
  fireEvent.click(screen.getByRole("button", { name: "Encerrar lactação" })); await waitFor(() => expect(reqV4).toHaveBeenCalledTimes(2));
  expect(vi.mocked(reqV4).mock.calls[1]).toEqual(vi.mocked(reqV4).mock.calls[0]);
});

it.each(["pesoSecagem", "pesoSecagem.data"])("erro de %s permanece visível mesmo com campo de peso oculto", async campo => {
  vi.mocked(reqV4).mockRejectedValue(new RebanhoApiError("Vínculo já alterado por outro usuário", 409, "CONFLITO", campo));
  montar(); await preencher(); fireEvent.click(screen.getByRole("button", { name: "Encerrar lactação" }));
  expect(await screen.findByText("Vínculo já alterado por outro usuário")).toBeTruthy();
  expect(screen.getByLabelText("Motivo do encerramento")).toHaveProperty("value", "Secagem programada");
});
