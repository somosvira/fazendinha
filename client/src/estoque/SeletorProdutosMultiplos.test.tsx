// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SeletorProdutosMultiplos } from "./SeletorProdutosMultiplos";
afterEach(cleanup);
it("conserva IDs de referência e rascunho entre abas; cancelar não aplica", async () => {
  const aplicar = vi.fn();
  function Exemplo() { const [ids, setIds] = useState(["local"]); return <SeletorProdutosMultiplos opcoes={[{ id: "local", nome: "Local", produtoEstoqueId: "local" }, { id: "referencia", nome: "Catálogo", produtoEstoqueId: "adotado" }]} valor={ids} onChange={v => { setIds(v); aplicar(v); }} />; }
  render(<Exemplo />); fireEvent.click(screen.getByRole("button", { name: "Selecionar medicamentos" }));
  fireEvent.click(screen.getByRole("tab", { name: "Catálogo" })); fireEvent.click(screen.getByRole("checkbox", { name: "Catálogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" })); expect(aplicar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar medicamentos" })); fireEvent.click(screen.getByRole("tab", { name: "Catálogo" })); fireEvent.click(screen.getByRole("checkbox", { name: "Catálogo" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar seleção (2)" })); expect(aplicar).toHaveBeenCalledWith(["local", "referencia"]);
});
it("mostra quantidade do template e retorna ao controle visível", async () => {
  function Exemplo() {
    const [visivel, setVisivel] = useState(false);
    const gatilho = useState(() => ({ current: null as HTMLButtonElement | null }))[0];
    return <><button ref={gatilho} onClick={() => setVisivel(true)}>Selecionar doença</button>{visivel && <SeletorProdutosMultiplos abertoInicial retornoFoco={gatilho} detalheOpcao={() => "2 mL"} opcoes={[{ id: "p", nome: "Medicamento", produtoEstoqueId: "p" }]} valor={["p"]} onChange={() => {}} onFechar={() => setVisivel(false)} />}</>;
  }
  render(<Exemplo />); const origem = screen.getByRole("button", { name: "Selecionar doença" }); fireEvent.click(origem);
  expect(screen.getByText(/2 mL/)).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await vi.waitFor(() => expect(document.activeElement).toBe(origem));
});
