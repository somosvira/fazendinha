// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CamposMomentoAcao } from "./CamposMomentoAcao";
afterEach(cleanup);
it("seleciona explicitamente um momento existente sem derivar pelo dia", () => {
  const onChange = vi.fn();
  render(<CamposMomentoAcao momentos={[{ nome: "D0", ordem: 1 }, { nome: "D0 separado", ordem: 2 }]} aplicacao={false} onChange={onChange} onRenomear={vi.fn()} onSubtipoChange={vi.fn()} />);
  expect(screen.getByText("Etapa legada sem momento")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Momento da ação"), { target: { value: "2" } });
  expect(onChange).toHaveBeenCalledWith({ nome: "D0 separado", ordem: 2 });
  expect(screen.queryByLabelText("Procedimento de aplicação")).toBeNull();
});
it("cria outro momento e oferece inserção apenas como aplicação", () => {
  const onChange = vi.fn(), onSubtipoChange = vi.fn();
  render(<CamposMomentoAcao momento={{ nome: "D0", ordem: 1 }} momentos={[{ nome: "D0", ordem: 1 }, { nome: "D0", ordem: 1 }]} aplicacao subtipo="APLICACAO" onChange={onChange} onRenomear={vi.fn()} onSubtipoChange={onSubtipoChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Criar outro momento" }));
  expect(onChange).toHaveBeenCalledWith({ nome: "Momento 2", ordem: 2 });
  fireEvent.change(screen.getByLabelText("Procedimento de aplicação"), { target: { value: "INSERCAO_DISPOSITIVO" } });
  expect(onSubtipoChange).toHaveBeenCalledWith("INSERCAO_DISPOSITIVO");
});
