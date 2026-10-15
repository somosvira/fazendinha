/* @vitest-environment jsdom */
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

afterEach(cleanup);
describe.each([false, true])("retorno de foco sem Trigger Radix (painel=%s)", painel => {
  function Exemplo({ destinoProprio = false, removerOrigem = false }) {
    const [aberto, setAberto] = useState(false);
    const Raiz = painel ? Sheet : Dialog;
    const Conteudo = painel ? SheetContent : DialogContent;
    const Titulo = painel ? SheetTitle : DialogTitle;
    return <>
      {(!removerOrigem || !aberto) && <button onClick={() => setAberto(true)}>Abrir cadastro</button>}
      <button id="destino-proprio">Outro destino</button>
      {aberto && <Raiz open onOpenChange={setAberto}><Conteudo aria-describedby={undefined} onCloseAutoFocus={destinoProprio ? e => { e.preventDefault(); document.getElementById("destino-proprio")?.focus(); } : undefined}>
        <Titulo>Cadastro</Titulo><label>Nome<input /></label>
      </Conteudo></Raiz>}
    </>;
  }
  it("devolve o foco ao acionador ao fechar com Escape", async () => {
    render(<Exemplo />);
    const abrir = screen.getByRole("button", { name: "Abrir cadastro" });
    abrir.focus(); fireEvent.click(abrir);
    await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });
  it("respeita um destino de foco definido pelo consumidor", async () => {
    render(<Exemplo destinoProprio />);
    screen.getByRole("button", { name: "Abrir cadastro" }).focus();
    fireEvent.click(document.activeElement!);
    await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Outro destino" })));
  });
});
