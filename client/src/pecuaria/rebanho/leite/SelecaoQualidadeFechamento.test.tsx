// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SelecaoQualidadeFechamento } from "./SelecaoQualidadeFechamento";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
vi.mock("./QualidadeLeite", () => ({ NovaAmostra: ({ onSalvo }: { onSalvo: (a: unknown) => void }) => <button onClick={() => onSalvo({ id: "nova", data: "2026-10-10", versao: 1 })}>Salvar amostra independente</button> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("seleciona identidade existente e cria apenas amostra independente uma vez", async () => {
  vi.mocked(consultarLeite).mockImplementation(async caminho => caminho.includes("formatos") ? [] : { itens: [{ id: "a", versao: 2, status: "VALIDO", data: "2026-10-10", sujeito: { tipo: "COLETIVO", origem: "Tanque" }, formatoSnapshot: { nome: "Laudo" }, resultados: [] }], total: 1, tamanho: 20 });
  const onChange = vi.fn();
  render(<SelecaoQualidadeFechamento sitio={2} inicio="2026-10-01" fim="2026-10-31" selecionadas={[]} onChange={onChange} ocupado={false} />);
  fireEvent.click(await screen.findByRole("checkbox"));
  expect(onChange).toHaveBeenCalledWith([{ amostraId: "a", versaoEsperada: 2 }]);
  fireEvent.click(screen.getByRole("button", { name: "Registrar nova amostra para selecionar" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar amostra independente" }));
  expect(onChange).toHaveBeenLastCalledWith([{ amostraId: "nova", versaoEsperada: 1 }]);
  expect(screen.queryByRole("button", { name: "Salvar amostra independente" })).toBeNull();
});
