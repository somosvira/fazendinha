// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

afterEach(cleanup);

describe("Dialog", () => {
  it("mostra o conteúdo (portalizado) quando open", () => {
    render(
      h(Dialog, { open: true }, h(DialogContent, null, h(DialogTitle, null, "Título teste"))),
    );
    expect(screen.getByText("Título teste")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("não mostra o conteúdo quando fechado", () => {
    render(
      h(Dialog, { open: false }, h(DialogContent, null, h(DialogTitle, null, "Oculto"))),
    );
    expect(screen.queryByText("Oculto")).toBeNull();
  });
});
