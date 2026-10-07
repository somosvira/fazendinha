// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ConferenciaExecucao, type PreviaExecucao } from "./PreviaExecucao";
afterEach(cleanup);
const id = "11111111-1111-4111-8111-111111111111";
function previa(): PreviaExecucao {
  return { fingerprint: "f", temDesvios: true, itens: [{ tarefaId: "t", animalId: id, tipo: "APLICACAO", referencia: "SNAPSHOT_PLANEJADO", planejado: {}, realizado: {}, exibicao: { planejado: { produtoId: "Produto planejado" }, realizado: { produtoId: "Produto aplicado" } }, diferencas: [{ campo: "produtoId", planejado: id, realizado: id }, { campo: "unidadeDose", planejado: "ML", realizado: "G" }, { campo: "data", planejado: "2026-10-01", realizado: "2026-10-05" }], motivo: "Mudança justificada", motivoObrigatorio: true, carencia: { estadoLeite: "INFORMADO", leiteHoras: 0, estadoCarne: "NAO_APLICAVEL", carneHoras: null } }], consumos: [{ produtoId: id, produtoNome: "Produto aplicado", partidaId: id, partidaNome: "Lote setembro", partidaValidade: "2027-09-17", itemCompraDiretaId: null, unidade: "ML", quantidade: "2" }] };
}
it("usa nomes preservados, datas e unidades amigáveis sem afirmar consumo confirmado", () => {
  render(<ConferenciaExecucao previa={previa()} animais={[{ id, brinco: "GV3-1" }]} />);
  expect(screen.getByText("Produto: Produto planejado → Produto aplicado")).toBeTruthy();
  expect(screen.getByText("Unidade: mL → g")).toBeTruthy();
  expect(screen.getByText("Data: 01/10/2026 → 05/10/2026")).toBeTruthy();
  expect(screen.getByText("Carência revisada: leite 0 h · carne Não se aplica — confirmado")).toBeTruthy();
  expect(screen.getByText(/2 mL · Produto aplicado · lote Lote setembro · validade 17\/09\/2027/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Consumo total · Previsto para confirmação" })).toBeTruthy();
  expect(screen.queryByText(/Consumo total confirmado/)).toBeNull();
  expect(document.body.textContent).not.toContain(id);
});
it("não expõe identificações técnicas de registros antigos nem inventa nomes ausentes", () => {
  const valor = previa();
  valor.itens[0].exibicao = { planejado: { produtoId: null }, realizado: { produtoId: null } };
  valor.consumos[0].produtoNome = null;
  valor.consumos[0].partidaNome = null;
  valor.itens[0].carencia = { estadoLeite: "NAO_INFORMADO", leiteHoras: null, estadoCarne: "NAO_INFORMADO", carneHoras: null };
  render(<ConferenciaExecucao previa={valor} animais={[]} />);
  expect(screen.getByText("Animal não identificado")).toBeTruthy();
  expect(screen.getByText("Carência revisada: leite Não informado · carne Não informado")).toBeTruthy();
  expect(document.body.textContent).toContain("Identificação não disponível no registro original");
  expect(document.body.textContent).not.toContain(id);
  expect(document.body.textContent).not.toContain("Produto aplicado");
});
