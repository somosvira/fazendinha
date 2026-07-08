// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("mostra título/mensagem e dispara onConfirm/onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      h(ConfirmDialog, {
        open: true,
        title: "Excluir?",
        message: "Ação irreversível.",
        onConfirm,
        onCancel,
      }),
    );
    expect(screen.getByText("Excluir?")).toBeTruthy();
    expect(screen.getByText("Ação irreversível.")).toBeTruthy();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeTruthy();
    fireEvent.click(screen.getByText("Confirmar"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("não renderiza quando open=false", () => {
    render(
      h(ConfirmDialog, {
        open: false,
        title: "Oi",
        message: "x",
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(screen.queryByText("Oi")).toBeNull();
  });
});
