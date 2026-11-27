/** @vitest-environment jsdom */
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TabelaParticipantesProgramacao } from "./ConferenciaProgramacao";

it("mantém marcações ao trocar de página e alterna apenas a página visível", () => {
  const animais = Array.from({ length: 11 }, (_, i) => ({ id: String(i), brinco: `B${i}`, nome: null }));
  function Tabela() {
    const [marcados, setMarcados] = useState<string[]>([]);
    return <><p data-testid="marcados">{marcados.join(",")}</p><TabelaParticipantesProgramacao animais={animais} marcados={marcados} onMarcar={setMarcados}/></>;
  }
  render(<Tabela/>);
  fireEvent.click(screen.getByRole("checkbox", { name: "Marcar B0" }));
  fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Marcar página" }));
  expect(screen.getByTestId("marcados").textContent).toBe("0,10");
  fireEvent.click(screen.getByRole("checkbox", { name: "Marcar página" }));
  expect(screen.getByTestId("marcados").textContent).toBe("0");
});
