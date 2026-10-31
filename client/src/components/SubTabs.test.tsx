// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SubTabs } from "./SubTabs";
afterEach(cleanup);

it("navega por setas e extremos com foco, seleção e relações aos painéis", () => {
  function Exemplo() {
    const [active, onSelect] = useState("geral");
    return <SubTabs tabs={[{ id: "geral", label: "Geral" }, { id: "sanidade", label: "Sanidade" }, { id: "nutricao", label: "Nutrição" }]} active={active} onSelect={onSelect} ariaLabel="Seções" idDaAba={id => `aba-${id}`} idDoPainel={id => `painel-${id}`}/>;
  }
  render(<Exemplo/>);
  const geral = screen.getByRole("tab", { name: "Geral" });
  const sanidade = screen.getByRole("tab", { name: "Sanidade" });
  const nutricao = screen.getByRole("tab", { name: "Nutrição" });
  expect(geral.id).toBe("aba-geral");
  expect(geral.getAttribute("aria-controls")).toBe("painel-geral");
  fireEvent.keyDown(geral, { key: "ArrowRight" });
  expect(document.activeElement).toBe(sanidade);
  expect(sanidade.getAttribute("aria-selected")).toBe("true");
  expect(geral.tabIndex).toBe(-1);
  fireEvent.keyDown(sanidade, { key: "End" });
  expect(document.activeElement).toBe(nutricao);
  fireEvent.keyDown(nutricao, { key: "ArrowRight" });
  expect(document.activeElement).toBe(geral);
  fireEvent.keyDown(geral, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(nutricao);
  fireEvent.keyDown(nutricao, { key: "Home" });
  expect(document.activeElement).toBe(geral);
});
