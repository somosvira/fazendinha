// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import * as React from "react";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RebModal } from "./RebModal";

/* RebModal preserva o visual do drawer sobre o Dialog Radix.
 * jsdom porque tem backdrop/Esc/foco/onClose interativos. */

afterEach(cleanup);

describe("RebModal", () => {
  it("renderiza título, corpo e ações", () => {
    render(h(RebModal, { title: "Novo animal", onClose: () => {}, actions: h("button", null, "Salvar"), children: h("div", null, "corpo") }));
    expect(screen.getByRole("heading", { name: "Novo animal" })).toBeDefined();
    expect(screen.getByText("corpo")).toBeDefined();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDefined();
  });

  it("fecha ao clicar no backdrop", async () => {
    const onClose = vi.fn();
    render(h(RebModal, { title: "X", onClose, children: "y" }));
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).toBeTruthy();
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    fireEvent.pointerDown(backdrop!, { button: 0, ctrlKey: false });
    fireEvent.click(backdrop!);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("fecha no botão X", () => {
    const onClose = vi.fn();
    render(h(RebModal, { title: "X", onClose, children: "y" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fecha ao apertar Esc", () => {
    const onClose = vi.fn();
    render(h(RebModal, { title: "X", onClose, children: "y" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omite o X quando showClose=false", () => {
    render(h(RebModal, { title: "X", onClose: () => {}, showClose: false, children: "y" }));
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it("associa o título ao nome acessível do diálogo", () => {
    render(h(RebModal, { title: "Novo animal", onClose: () => {}, children: "y" }));
    expect(screen.getByRole("dialog", { name: "Novo animal" })).toBeDefined();
  });

  it("move o foco para o diálogo e o devolve ao gatilho ao fechar", async () => {
    const Trigger = () => {
      const [open, setOpen] = React.useState(false);
      return h(React.Fragment, null,
        h("button", { onClick: () => setOpen(true) }, "Abrir"),
        open ? h(RebModal, { title: "X", onClose: () => setOpen(false), children: h("button", null, "Ação") }) : null,
      );
    };
    render(h(Trigger));
    const abrir = screen.getByRole("button", { name: "Abrir" });
    abrir.focus();
    fireEvent.click(abrir);
    await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.activeElement).toBe(abrir));
  });

  it("Escape fecha somente o modal empilhado", async () => {
    const base = vi.fn();
    const topo = vi.fn();
    render(h(React.Fragment, null,
      h(RebModal, { title: "Base", onClose: base, children: "base" }),
      h(RebModal, { title: "Topo", onClose: topo, stacked: true, children: "topo" }),
    ));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(topo).toHaveBeenCalledTimes(1));
    expect(base).not.toHaveBeenCalled();
  });

});
