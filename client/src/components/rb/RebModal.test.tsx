// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { RebModal } from "./RebModal";

/* RebModal reproduz .rb-drawer-bg + .rb-drawer (rebanho.css) sem Radix.
 * jsdom porque tem backdrop/Esc/onClose interativos. */

afterEach(cleanup);

describe("RebModal", () => {
  it("renderiza título, corpo e ações", () => {
    render(h(RebModal, { title: "Novo animal", onClose: () => {}, actions: h("button", null, "Salvar"), children: h("div", null, "corpo") }));
    expect(screen.getByRole("heading", { name: "Novo animal" })).toBeDefined();
    expect(screen.getByText("corpo")).toBeDefined();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDefined();
  });

  it("fecha ao clicar no backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(h(RebModal, { title: "X", onClose, children: "y" }));
    // backdrop é o primeiro div (fixed inset-0)
    const backdrop = container.querySelector(".rb-fade-in");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
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
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omite o X quando showClose=false", () => {
    render(h(RebModal, { title: "X", onClose: () => {}, showClose: false, children: "y" }));
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
  });

  it("stacked sobe o z-index do card", () => {
    const { container } = render(h(RebModal, { title: "X", onClose: () => {}, stacked: true, children: "y" }));
    const card = container.querySelector('[role="dialog"]');
    expect(card?.className).toContain("z-[21]");
  });
});
