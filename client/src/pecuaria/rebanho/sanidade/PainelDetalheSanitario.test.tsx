// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PainelDetalheSanitario } from "./PainelDetalheSanitario";
import { ResultadoExame } from "./ResultadoExame";
afterEach(cleanup);
it.each([["ocorrencia", "Ocorrência sanitária"], ["exame", "Exame do animal"], ["aplicacao", "Aplicação sanitária"]])("nomeia o detalhe %s pela tarefa", (tipo, titulo) => {
  render(<PainelDetalheSanitario tipo={tipo} onFechar={vi.fn()}>Conteúdo preservado</PainelDetalheSanitario>);
  expect(screen.getByRole("dialog", { name: titulo })).toBeTruthy();
});
it("resultado mantém exame e animal visíveis no diálogo breve", () => {
  render(<ResultadoExame propriedadeId={1} onSalvo={vi.fn()} exame={{ id: "e", formatoSnapshot: { tipoResultado: "TEXTO" }, resultadoTexto: null, resultadoNumero: null, resultadoOpcao: null, animal: { brinco: "RN01", nome: "Estrela" }, tipoExame: { nome: "Brucelose" } }} />);
  fireEvent.click(screen.getByRole("button", { name: "Informar resultado" }));
  expect(screen.getByText("Brucelose · Animal RN01 · Estrela")).toBeTruthy();
});
