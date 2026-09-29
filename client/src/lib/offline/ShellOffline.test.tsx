// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ShellOffline } from "./ShellOffline";
import { onlineManager } from "./resume";

let fila: unknown[] = [];
const ouvintes = new Set<() => void>();

vi.mock("./fila", () => ({
  inscrever: (cb: () => void) => {
    ouvintes.add(cb);
    return () => ouvintes.delete(cb);
  },
  obterFila: () => fila,
  filaTravada: () => false,
  obterProgresso: () => null,
}));

afterEach(() => {
  cleanup();
  fila = [];
  onlineManager.setOnline(true);
});

describe("ShellOffline — faixa offline", () => {
  it("não aparece online", () => {
    onlineManager.setOnline(true);
    render(<ShellOffline />);
    expect(screen.queryByText(/Sem conexão/)).toBeNull();
  });

  it("aparece offline, mesmo com itens na fila, e some ao reconectar", () => {
    onlineManager.setOnline(false);
    fila = [{}, {}];
    render(<ShellOffline />);
    expect(screen.getByRole("status").textContent).toBe("Sem conexão — dados podem estar desatualizados");

    act(() => onlineManager.setOnline(true));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
