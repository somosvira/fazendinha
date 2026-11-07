// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DatasDiagnosticoIndividual } from "./DatasDiagnosticoIndividual";
afterEach(cleanup);
it("datas são explícitas por animal e conservadas ao trocar páginas", () => {
  const animais = Array.from({ length: 11 }, (_, i) => ({
    id: `a${i + 1}`,
    brinco: `Animal ${i + 1}`,
  }));
  function Formulario() {
    const [valores, setValores] = useState<Record<string, string>>({});
    return (
      <DatasDiagnosticoIndividual
        animais={animais}
        valores={valores}
        onChange={(id, data) => setValores((v) => ({ ...v, [id]: data }))}
      />
    );
  }
  render(<Formulario />);
  const primeira = screen.getByLabelText("Data individual para DG · Animal 1");
  expect(primeira).toHaveProperty("value", "");
  fireEvent.change(primeira, { target: { value: "2026-11-25" } });
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(
    screen.getByLabelText("Data individual para DG · Animal 11"),
  ).toHaveProperty("value", "");
  fireEvent.change(
    screen.getByLabelText("Data individual para DG · Animal 11"),
    { target: { value: "2026-11-27" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
  expect(
    screen.getByLabelText("Data individual para DG · Animal 1"),
  ).toHaveProperty("value", "25/11/2026");
  expect(
    screen.getByLabelText("Data individual para DG · Animal 2"),
  ).toHaveProperty("value", "");
});
