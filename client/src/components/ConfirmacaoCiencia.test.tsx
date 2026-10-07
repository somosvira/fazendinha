// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { ConfirmacaoCiencia } from "./ConfirmacaoCiencia";

describe("ConfirmacaoCiencia", () => {
  afterEach(cleanup);
  it("exige escolha explícita e expõe rótulo e erro acessíveis", () => {
    const mudar = vi.fn();
    render(<ConfirmacaoCiencia id="ciencia" checked={false} onChange={mudar} erro="Confirme a ciência." obrigatorio>Estou ciente.</ConfirmacaoCiencia>);
    const controle = screen.getByRole("switch", { name: "Estou ciente." });
    expect((controle as HTMLInputElement).checked).toBe(false);
    expect(controle.getAttribute("aria-invalid")).toBe("true");
    expect(controle.getAttribute("aria-describedby")).toBe("ciencia-erro");
    fireEvent.click(controle);
    expect(mudar).toHaveBeenCalledWith(true);
  });
  it("não permite confirmar durante envio", () => {
    render(<ConfirmacaoCiencia id="ciencia" checked={false} onChange={vi.fn()} disabled>Estou ciente.</ConfirmacaoCiencia>);
    expect((screen.getByRole("switch") as HTMLInputElement).disabled).toBe(true);
  });
});
