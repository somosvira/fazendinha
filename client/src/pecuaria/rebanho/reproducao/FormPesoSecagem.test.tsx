// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FormPesoSecagem } from "./FormPesoSecagem";
import { PesoSecagemLactacao } from "./PesoSecagemLactacao";
import { lactacaoSecagem, vinculoSecagem } from "./PesoSecagem.fixture";
import { RebanhoApiError } from "../api";
import { reqV4 } from "./api";
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqV4: vi.fn() }));
afterEach(cleanup); beforeEach(() => { vi.mocked(reqV4).mockReset().mockResolvedValue({}); });
it.each(["DESVINCULAR", "CORRIGIR"] as const)("%s conserva pesagem e exige motivo com versão do vínculo", async acao => {
  render(<FormPesoSecagem lactacao={lactacaoSecagem} propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("O que deseja alterar?"), { target: { value: acao } });
  expect(screen.getByLabelText("Motivo da alteração")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "Conferência do manejo de secagem" } });
  if (acao === "CORRIGIR") { expect(screen.getByLabelText("Precisão")).toHaveProperty("value", "ESTIMADO"); fireEvent.change(screen.getByLabelText("Peso da matriz (kg)"), { target: { value: "515" } }); }
  fireEvent.click(screen.getByRole("button", { name: acao === "DESVINCULAR" ? "Desvincular peso" : "Salvar alteração" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes/l1/peso-secagem", expect.objectContaining({ propriedadeId: 7, versaoEsperada: 3, motivo: "Conferência do manejo de secagem", pesoSecagem: expect.objectContaining({ acao, vinculoId: "v1", motivo: "Conferência do manejo de secagem" }) }), "POST", 7));
});
it("adiciona peso sem exigir substituição quando a lactação está sem vínculo", async () => {
  render(<FormPesoSecagem lactacao={{ ...lactacaoSecagem, vinculosPesagemSecagem: [] }} propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  expect(screen.queryByLabelText("O que deseja alterar?")).toBeNull();
  expect(screen.getByRole("button", { name: "Adicionar peso" })).toBeTruthy();
  await alterarControle(screen.getByLabelText("Como deseja informar o peso?"), { target: { value: "REGISTRAR" } });
  fireEvent.change(screen.getByLabelText("Peso da matriz (kg)"), { target: { value: "510" } });
  await alterarControle(screen.getByLabelText("Data real da pesagem"), { target: { value: "2026-10-29" } });
  fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "Pesagem localizada após encerramento" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar peso" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes/l1/peso-secagem", expect.objectContaining({ pesoSecagem: expect.objectContaining({ acao: "REGISTRAR", precisao: "NAO_INFORMADO" }) }), "POST", 7));
});
it("histórico mostra vínculo revogado e mesma identidade do peso sem ações para consulta", () => {
  render(<PesoSecagemLactacao lactacao={{ ...lactacaoSecagem, vinculosPesagemSecagem: [vinculoSecagem, { ...vinculoSecagem, id: "v0", revogadoEm: "2026-10-29T10:00:00Z", revogadoPorId: 2, motivoRevogacao: "Substituído após conferência" }] }} podeLancar={false} onGerenciar={vi.fn()} />);
  expect(screen.getByText("512 kg")).toBeTruthy(); expect(screen.getAllByText(/Estimado/).length).toBeGreaterThan(0);
  expect(screen.getByText("Substituído após conferência")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull(); expect(screen.getAllByText(/p1/).length).toBeGreaterThan(0);
});

it("substituição reusa identidade existente e conserva chave e motivo no reenvio", async () => {
  vi.mocked(reqV4).mockImplementation(async (_path, body) => { if (!body) return { historicoPesagens: [{ ...vinculoSecagem.pesagem, id: "p2", pesoKg: 515 }] }; throw new RebanhoApiError("Revise o vínculo", 409, "CONFLITO", "pesoSecagem"); });
  render(<FormPesoSecagem lactacao={lactacaoSecagem} propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await alterarControle(screen.getByLabelText("O que deseja alterar?"), { target: { value: "SUBSTITUIR" } });
  await alterarControle(screen.getByLabelText("Como deseja informar o peso?"), { target: { value: "VINCULAR" } });
  await alterarControle(screen.getByLabelText("Pesagem existente"), { target: { value: "p2" } });
  fireEvent.change(screen.getByLabelText("Motivo da alteração"), { target: { value: "Pesagem original localizada" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" })); await screen.findByText("Revise o vínculo");
  fireEvent.click(screen.getByRole("button", { name: "Salvar alteração" }));
  await waitFor(() => expect(vi.mocked(reqV4).mock.calls.filter(c => c[1])).toHaveLength(2));
  const envios = vi.mocked(reqV4).mock.calls.filter(c => c[1]); expect(envios[1]).toEqual(envios[0]);
  expect(envios[0][1]).toMatchObject({ pesoSecagem: { acao: "SUBSTITUIR", vinculoId: "v1", motivo: "Pesagem original localizada", pesagem: { acao: "VINCULAR", pesagemId: "p2" } } });
});
it("vínculo revogado conserva 450 kg do snapshot quando a mesma pesagem atual passa a 460 kg", () => {
  const atual = { ...vinculoSecagem.pesagem, pesoKg: 460, data: "2026-10-29", precisao: "MEDIDO" as const };
  render(<PesoSecagemLactacao lactacao={{ ...lactacaoSecagem, vinculosPesagemSecagem: [
    { ...vinculoSecagem, pesagem: atual },
    { ...vinculoSecagem, id: "v-anterior", pesagem: atual, revogadoEm: "2026-10-29T10:00:00Z", motivoRevogacao: "Correção auditada", evidenciaSnapshot: { versao: 1, pesagem: { id: "p1", animalId: "a1", data: "2026-10-28", pesoKg: "450", precisao: "ESTIMADO" } } },
  ] }} podeLancar={false} onGerenciar={vi.fn()} />);
  const antiga = screen.getByRole("row", { name: /450 kg/ });
  expect(antiga.textContent).toContain("28/10/2026"); expect(antiga.textContent).toContain("Estimado"); expect(antiga.textContent).toContain("Revogado");
  expect(antiga.textContent).not.toContain("460 kg");
  expect(screen.getByRole("row", { name: /460 kg/ }).textContent).toContain("Ativo");
});
it.each([null, {}, { pesagem: { id: "p1", data: "sem data", pesoKg: "450" } }])("snapshot inválido exibe fallback explicitamente atual sem inventar histórico", evidenciaSnapshot => {
  render(<PesoSecagemLactacao lactacao={{ ...lactacaoSecagem, vinculosPesagemSecagem: [{ ...vinculoSecagem, revogadoEm: "2026-10-29T10:00:00Z", evidenciaSnapshot }] }} podeLancar={false} onGerenciar={vi.fn()} />);
  expect(screen.getByText("Valor atual; snapshot indisponível")).toBeTruthy();
  expect(screen.getByRole("row", { name: /512 kg/ }).textContent).toContain("Revogado");
});
