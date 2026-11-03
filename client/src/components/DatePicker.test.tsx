// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState, type FormEvent } from "react";
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

  it("mantém a entrada incompleta e bloqueia o formulário até a correção", () => {
    render(<Controlado inicial="2025-05-01" onChange={vi.fn()} />);
    const campo = screen.getByLabelText("Nascimento") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "12/1" } });
    fireEvent.blur(campo);
    expect(campo.value).toBe("12/1");
    expect(campo.validity.customError).toBe(true);
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Informe uma data válida no formato dd/mm/aaaa.")).toBeTruthy();
    fireEvent.change(campo, { target: { value: "12/11/2025" } });
    expect(campo.validity.valid).toBe(true);
    expect(campo.getAttribute("aria-invalid")).not.toBe("true");
  });

  it("não troca data inexistente pela anterior ao sair do campo", () => {
    const onChange = vi.fn();
    render(<form><Controlado inicial="2026-10-26" onChange={onChange}/></form>);
    const campo = screen.getByLabelText("Nascimento") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "31/02/2026" } });
    fireEvent.blur(campo);
    expect(campo.value).toBe("31/02/2026");
    expect(campo.form?.checkValidity()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respeita os limites também na digitação e permite corrigir pelo calendário", async () => {
    const onChange = vi.fn();
    render(<DatePicker aria-label="Data limitada" value="2025-05-15" min="2025-05-10" max="2025-05-20" onChange={onChange}/>);
    const campo = screen.getByLabelText("Data limitada") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "09/05/2025" } });
    expect(campo.checkValidity()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "21/05/2025" } });
    expect(campo.checkValidity()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abrir calendário" }));
    fireEvent.click(await screen.findByRole("button", { name: "16 de maio de 2025" }));
    expect(campo.checkValidity()).toBe(true);
    expect(campo.value).toBe("16/05/2025");
    expect(onChange).toHaveBeenLastCalledWith("2025-05-16");
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

it("impede submit inválido mesmo quando o formulário usa validação própria", () => {
  const salvar = vi.fn((evento: FormEvent) => evento.preventDefault());
  render(<form noValidate onSubmit={salvar}><Controlado inicial="2026-10-26" onChange={vi.fn()}/><button type="submit">Salvar</button></form>);
  const campo = screen.getByLabelText("Nascimento") as HTMLInputElement;
  fireEvent.change(campo, { target: { value: "31/02/2026" } });
  fireEvent.submit(campo.form!);
  expect(salvar).not.toHaveBeenCalled();
  expect(campo.value).toBe("31/02/2026");
  expect(screen.getByText("Informe uma data válida no formato dd/mm/aaaa.")).toBeTruthy();
  fireEvent.change(campo, { target: { value: "25/10/2026" } });
  fireEvent.submit(campo.form!);
  expect(salvar).toHaveBeenCalledTimes(1);
});
