// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ControlesHistoricosLeite } from "./ControlesHistoricosLeite";
import type { ControleHistoricoLeite } from "./historico-types";
afterEach(cleanup);
const documento: ControleHistoricoLeite = {
  id: "doc", tipo: "CONTROLE_PERIODICO", inicio: "2024-10-20", fim: "2024-10-20", total: "22.4", unidade: "L",
  referenciaUnidade: "Litros adotados por declaração do usuário; sem conversão numérica", parcelas: [
    { rotulo: "Manhã", hora: null, quantidade: 12.1 }, { rotulo: "Tarde", hora: null, quantidade: 10.3 },
  ], lactacaoId: null, origemColetiva: null, versao: 1, contexto: "INTERNO", semEfeitoEstoqueFinanceiro: true,
  origem: { banco: "IDEAGRI", chave: "CONTROLE:0001", evidencia: "Documento conferido pela fazenda" },
};
it("mostra documentos com parcelas, horas desconhecidas, fonte e declaração exata", () => {
  const { container } = render(<ControlesHistoricosLeite itens={[documento]} />);
  expect(screen.getByRole("heading", { name: "Controles históricos do animal" })).toBeTruthy();
  expect(screen.getByText("22,4 L")).toBeTruthy();
  expect(screen.getByText("Manhã: 12,1 L")).toBeTruthy();
  expect(screen.getAllByText("Horário não informado")).toHaveLength(2);
  expect(screen.getByText(documento.referenciaUnidade)).toBeTruthy();
  expect(screen.queryByText(/Unidade comprovada/i)).toBeNull();
  const detalhes = container.querySelector("details")!;
  expect(detalhes.open).toBe(false);
  expect(within(detalhes).getByText("IDEAGRI")).toBeTruthy();
  expect(within(detalhes).getByText("CONTROLE:0001")).toBeTruthy();
  expect(within(detalhes).getByText("Sem lactação comprovada")).toBeTruthy();
  expect(screen.queryByText("06:00")).toBeNull();
});
it("distingue total ausente, zero e parcelas divergentes sem completar o documento", () => {
  render(<ControlesHistoricosLeite itens={[
    { ...documento, total: null },
    { ...documento, id: "zero", inicio: "2024-10-21", fim: "2024-10-21", total: "0", parcelas: [{ rotulo: null, hora: "17:30", quantidade: null }] },
  ]} />);
  expect(screen.getByText("Não informado")).toBeTruthy();
  expect(screen.getByText("0 L")).toBeTruthy();
  expect(screen.getByText("Manhã: 12,1 L")).toBeTruthy();
  expect(screen.getByText("Parcela sem rótulo: Não informado")).toBeTruthy();
  expect(screen.getByText("17:30")).toBeTruthy();
  expect(screen.queryByText("22,4 L")).toBeNull();
});
it("coletivo conserva mês completo, origem e kg sem distribuição diária ou animal", () => {
  render(<ControlesHistoricosLeite coletivo itens={[{ ...documento, tipo: "AGREGADO_MENSAL", inicio: "2024-09-01", fim: "2024-09-30", unidade: "KG", total: "12340", parcelas: [], origemColetiva: "Tanque da sede", referenciaUnidade: "Documento original em quilogramas" }]} />);
  expect(screen.getByText("01/09/2024 a 30/09/2024")).toBeTruthy();
  expect(screen.getByText("Tanque da sede")).toBeTruthy();
  expect(screen.getByText("12.340 kg")).toBeTruthy();
  expect(screen.getByText("Parcelas não informadas")).toBeTruthy();
  expect(screen.queryByText("Lactação")).toBeNull();
  expect(screen.getByText(/não é distribuído pelos dias ou animais/)).toBeTruthy();
});
it("período vazio permanece ausência sem tabela ou total presumido", () => {
  render(<ControlesHistoricosLeite itens={[]} />);
  expect(screen.getByText("Nenhum controle histórico no período.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByText("0 L")).toBeNull();
});
