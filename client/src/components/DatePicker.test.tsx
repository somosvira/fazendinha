// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DatePicker, formatarDataDigitada, interpretarDataDigitada } from "./DatePicker";

afterEach(cleanup);

describe("interpretarDataDigitada", () => {
  it("aceita dd/mm/aaaa e aaaa-mm-dd", () => {
    expect(interpretarDataDigitada("01/05/2025")).toBe("2025-05-01");
    expect(interpretarDataDigitada("2025-05-01")).toBe("2025-05-01");
  });
  it("recusa incompleta ou inexistente", () => {
    expect(interpretarDataDigitada("01/05/20")).toBeNull();
    expect(interpretarDataDigitada("31/02/2025")).toBeNull();
    expect(interpretarDataDigitada("")).toBeNull();
  });
  it("formata ISO para exibição", () => {
    expect(formatarDataDigitada("2025-05-01")).toBe("01/05/2025");
    expect(formatarDataDigitada("")).toBe("");
  });
});

function Controlado({ inicial = "", onChange }: { inicial?: string; onChange: (v: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return <DatePicker aria-label="Nascimento" value={valor} onChange={(v) => { setValor(v); onChange(v); }} />;
}

describe("DatePicker", () => {
  it("insere as barras ao digitar e só emite quando a data está completa", () => {
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} />);
    const campo = screen.getByLabelText("Nascimento") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "0105" } });
    expect(campo.value).toBe("01/05");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "01052025" } });
    expect(campo.value).toBe("01/05/2025");
    expect(onChange).toHaveBeenLastCalledWith("2025-05-01");
  });

  it("ao sair do campo com data incompleta, volta ao último valor válido", () => {
    render(<Controlado inicial="2025-05-01" onChange={vi.fn()} />);
    const campo = screen.getByLabelText("Nascimento") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "12/1" } });
    fireEvent.blur(campo);
    expect(campo.value).toBe("01/05/2025");
  });

  it("escolher um dia no calendário preenche o campo", async () => {
    const onChange = vi.fn();
    render(<Controlado inicial="2025-05-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir calendário" }));
    fireEvent.click(await screen.findByRole("button", { name: "15 de maio de 2025" }));
    expect(onChange).toHaveBeenLastCalledWith("2025-05-15");
    expect((screen.getByLabelText("Nascimento") as HTMLInputElement).value).toBe("15/05/2025");
  });
});
