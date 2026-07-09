// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

afterEach(cleanup);

describe("DropdownMenu", () => {
  it("mostra o item (portalizado) quando open", () => {
    render(
      h(
        DropdownMenu,
        { open: true },
        h(DropdownMenuTrigger, null, "Abrir"),
        h(DropdownMenuContent, null, h(DropdownMenuItem, null, "Item teste")),
      ),
    );
    expect(screen.getByText("Item teste")).toBeTruthy();
  });
});
