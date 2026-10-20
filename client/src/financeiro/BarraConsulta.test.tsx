// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { BarraConsulta } from "./BarraConsulta";
import { useRascunhoConsulta } from "./useRascunhoConsulta";

afterEach(cleanup);
function Consulta() {
  const [aplicado, setAplicado] = useState({ centro: "Inicial" });
  const edicao = useRascunhoConsulta(aplicado, { centro: "" }, setAplicado);
  return <><output aria-label="Consulta aplicada">{aplicado.centro}</output><BarraConsulta edicaoFiltros={edicao} adicionais={<label>Centro<input value={edicao.rascunho.centro} onChange={e => edicao.editar("centro", e.target.value)} /></label>} /></>;
}
describe("consulta com filtros em modal", () => {
  it("abre com foco no título, fecha com Escape e devolve o foco ao acionador", async () => {
    render(<Consulta />);
    const botao = screen.getByRole("button", { name: "Filtros" });
    botao.focus(); fireEvent.click(botao);
    const titulo = screen.getByRole("heading", { name: "Filtros" });
    await waitFor(() => expect(document.activeElement).toBe(titulo));
    fireEvent.keyDown(titulo, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(botao));
  });

  it("aplica em conjunto, descarta cancelamento e só limpa após confirmar", () => {
    render(<Consulta />);
    const abrir = () => fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    abrir();
    fireEvent.change(screen.getByLabelText("Centro"), { target: { value: "Outro" } });
    expect(screen.getByLabelText("Consulta aplicada").textContent).toBe("Inicial");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    abrir();
    expect((screen.getByLabelText("Centro") as HTMLInputElement).value).toBe("Inicial");
    fireEvent.change(screen.getByLabelText("Centro"), { target: { value: "Outro" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getByLabelText("Consulta aplicada").textContent).toBe("Outro");
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect((screen.getByLabelText("Centro") as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Consulta aplicada").textContent).toBe("Outro");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getByLabelText("Consulta aplicada").textContent).toBe("");
  });
});
