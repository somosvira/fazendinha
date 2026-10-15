// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { brl, emDias, hoje, mesAtual, Modal } from "./financeiro-ui";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("datas locais financeiras", () => {
  it("não apresenta valor oculto como zero", () => {
    expect(brl(null)).toBe("—");
    expect(brl(undefined)).toBe("—");
    expect(brl("0")).toContain("0,00");
  });
  it("usa calendário local, inclusive após meia-noite UTC e na virada do mês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 23, 30));
    expect(hoje()).toBe("2026-10-31");
    expect(mesAtual()).toBe("2026-10");
    expect(emDias(1)).toBe("2026-11-01");
    expect(emDias(-31)).toBe("2026-09-30");
  });
});

describe("Modal compartilhado", () => {
  it("foca o conteúdo, fecha com Escape e restaura o acionador", async () => {
    function Exemplo() {
      const [aberto, setAberto] = useState(false);
      return <><button onClick={() => setAberto(true)}>Abrir exemplo</button>{aberto && <Modal titulo="Exemplo" eyebrow="Teste" onClose={() => setAberto(false)}><label>Motivo<input /></label></Modal>}</>;
    }
    render(<Exemplo />);
    const abrir = screen.getByRole("button", { name: "Abrir exemplo" });
    abrir.focus(); fireEvent.click(abrir);
    const dialogo = screen.getByRole("dialog", { name: "Exemplo" });
    await waitFor(() => expect(dialogo.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });
});
