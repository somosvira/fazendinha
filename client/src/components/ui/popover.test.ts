// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";

afterEach(cleanup);

describe("Popover", () => {
  it("mostra o conteúdo (portalizado) quando open", () => {
    render(
      h(
        Popover,
        { open: true },
        h(PopoverTrigger, null, "Abrir"),
        h(PopoverContent, null, "Conteúdo do popover"),
      ),
    );
    expect(screen.getByText("Conteúdo do popover")).toBeTruthy();
    expect(screen.getByText("Conteúdo do popover").closest("[data-slot='popover-content']")?.className).toContain("z-[1200]");
  });

  it("não mostra o conteúdo quando fechado", () => {
    render(
      h(
        Popover,
        { open: false },
        h(PopoverTrigger, null, "Abrir"),
        h(PopoverContent, null, "Oculto"),
      ),
    );
    expect(screen.queryByText("Oculto")).toBeNull();
  });
});
