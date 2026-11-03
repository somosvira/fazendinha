// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DatePicker } from "@/components/DatePicker";
import { PainelFiltros } from "./PainelFiltros";
afterEach(cleanup);
it("não aplica a data anterior quando o rascunho contém uma entrada inválida", () => {
  const aplicar = vi.fn();
  function Painel() {
    const [data, setData] = useState("2026-10-26");
    return <PainelFiltros aberto onAbertoChange={vi.fn()} onLimpar={vi.fn()} temFiltros onAplicar={() => aplicar(data)}><DatePicker aria-label="Início" value={data} onChange={setData}/></PainelFiltros>;
  }
  render(<Painel/>);
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "31/02/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(aplicar).not.toHaveBeenCalled();
  expect(screen.getByText("Informe uma data válida no formato dd/mm/aaaa.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "25/10/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  expect(aplicar).toHaveBeenCalledWith("2026-10-25");
});
