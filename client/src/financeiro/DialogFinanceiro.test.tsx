// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFinanceiro } from "./DialogFinanceiro";

afterEach(cleanup);

function Fluxo() {
  const [etapa, setEtapa] = useState(0);
  return <><Button onClick={() => setEtapa(1)}>Abrir compromisso</Button>{etapa > 0 && <DialogFinanceiro key={etapa} titulo={etapa === 1 ? "Detalhe" : "Pagamento"} eyebrow="Teste" onClose={() => setEtapa(0)}><Button onClick={() => setEtapa(2)}>Liquidar</Button></DialogFinanceiro>}</>;
}

it("restaura o acionador ao fechar por Escape", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  try {
    render(<Fluxo />);
    const acionador = screen.getByRole("button", { name: "Abrir compromisso" });
    acionador.focus(); fireEvent.click(acionador);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(acionador));
  } finally { vi.unstubAllGlobals(); }
});

it("conserva o foco no próximo diálogo ao iniciar liquidação", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  try {
    render(<Fluxo />);
    screen.getByRole("button", { name: "Abrir compromisso" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Abrir compromisso" }));
    const liquidar = within(screen.getByRole("dialog", { name: "Detalhe" })).getByRole("button", { name: "Liquidar" });
    liquidar.focus(); fireEvent.click(liquidar);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Pagamento" }).contains(document.activeElement)).toBe(true));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Pagamento" })).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abrir compromisso" })));
  } finally { vi.unstubAllGlobals(); }
});
