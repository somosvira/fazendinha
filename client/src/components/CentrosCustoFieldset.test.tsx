// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CentrosCustoFieldset } from "./CentrosCustoFieldset";

afterEach(cleanup);

const centros = [
  { id: 1, nome: "Leite", ativo: true },
  { id: 2, nome: "Café", ativo: true },
];

describe("CentrosCustoFieldset", () => {
  it("chama onToggle com o id do centro clicado", () => {
    const onToggle = vi.fn();
    render(<CentrosCustoFieldset centros={centros} selecionados={new Set()} onToggle={onToggle} />);
    fireEvent.click(screen.getByLabelText("Leite"));
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("marca como selecionado quando o id está no set", () => {
    render(<CentrosCustoFieldset centros={centros} selecionados={new Set([2])} onToggle={() => {}} />);
    expect((screen.getByLabelText("Café") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Leite") as HTMLInputElement).checked).toBe(false);
  });

  it("mostra erro com role=alert associado via aria-describedby", () => {
    render(
      <CentrosCustoFieldset
        centros={centros}
        selecionados={new Set()}
        onToggle={() => {}}
        erro="Selecione ao menos um centro"
        idBase="produto-centros"
      />,
    );
    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toContain("Selecione ao menos um centro");
    expect(alerta.id).toBe("produto-centros-erro");
    const fieldset = alerta.closest("fieldset") as HTMLFieldSetElement;
    expect(fieldset.getAttribute("aria-describedby")).toBe("produto-centros-erro");
  });

  it("sem centros cadastrados mostra mensagem vazia", () => {
    render(<CentrosCustoFieldset centros={[]} selecionados={new Set()} onToggle={() => {}} />);
    expect(screen.getByText("Nenhum centro de custo cadastrado.")).toBeTruthy();
  });
});
