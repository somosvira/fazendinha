// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LinkAcesso } from "./Acessos";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("LinkAcesso", () => {
  it("só informa sucesso depois de o clipboard confirmar", async () => {
    let concluir!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { concluir = resolve; }));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<LinkAcesso link="https://exemplo.test/convite" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
    concluir();
    await screen.findByRole("button", { name: "Copiado" });
    expect(writeText).toHaveBeenCalledWith("https://exemplo.test/convite");
  });
  it("orienta cópia manual em caso de falha sem falso sucesso", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Negado")) } });
    render(<LinkAcesso link="https://exemplo.test/convite" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("copie manualmente"));
    expect(screen.queryByRole("button", { name: "Copiado" })).toBeNull();
  });
});
