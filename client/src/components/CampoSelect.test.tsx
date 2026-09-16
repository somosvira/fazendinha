// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CampoSelect } from "./CampoSelect";

const opcoes = [
  { value: "", label: "Não classificada" },
  { value: "CUSTEIO", label: "Custeio", descricao: "Gasto do dia a dia da fazenda." },
  { value: "INVESTIMENTO", label: "Investimento", descricao: "Bem durável, como máquinas." },
];

function Exemplo({ inicial, onValueChange }: { inicial: string; onValueChange?: (valor: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return <CampoSelect aria-label="Classificação" options={opcoes} value={valor} onValueChange={(novo) => { setValor(novo); onValueChange?.(novo); }} />;
}

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);

describe("CampoSelect", () => {
  it("mostra só o rótulo da opção atual no campo fechado", () => {
    render(<Exemplo inicial="CUSTEIO" />);
    expect(screen.getByRole("combobox", { name: "Classificação" }).textContent).toBe("Custeio");
  });

  it("explica as opções na lista e devolve o valor escolhido", async () => {
    const onValueChange = vi.fn();
    render(<Exemplo inicial="" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Classificação" }));
    const opcao = await screen.findByRole("option", { name: /Investimento/ });
    expect(opcao.textContent).toContain("Bem durável, como máquinas.");
    fireEvent.click(opcao);
    expect(onValueChange).toHaveBeenCalledWith("INVESTIMENTO");
    expect(screen.getByRole("combobox", { name: "Classificação" }).textContent).toBe("Investimento");
  });

  it("mostra a prévia da opção destacada ao lado da lista", async () => {
    render(<CampoSelect aria-label="Classificação" options={opcoes} value="CUSTEIO" onValueChange={() => {}} previa={(valor) => <p>Prévia de {valor || "vazio"}</p>} />);
    expect(screen.queryByText("Prévia de CUSTEIO")).toBeNull();
    fireEvent.click(screen.getByRole("combobox", { name: "Classificação" }));
    expect(await screen.findByText("Prévia de CUSTEIO")).toBeTruthy();
    fireEvent.focus(screen.getByRole("option", { name: /Investimento/ }));
    expect(screen.getByText("Prévia de INVESTIMENTO")).toBeTruthy();
    fireEvent.focus(screen.getByRole("option", { name: "Não classificada" }));
    expect(screen.getByText("Prévia de vazio")).toBeTruthy();
  });

  it("mostra o placeholder quando não há valor nem opção vazia", () => {
    render(<CampoSelect aria-label="Conta" placeholder="Selecione a conta" options={[{ value: "1", label: "Banco" }]} value="" onValueChange={() => {}} />);
    expect(screen.getByRole("combobox", { name: "Conta" }).textContent).toBe("Selecione a conta");
  });

  it("devolve texto vazio ao escolher a opção sem valor", async () => {
    const onValueChange = vi.fn();
    render(<Exemplo inicial="CUSTEIO" onValueChange={onValueChange} />);
    expect(screen.getByRole("combobox", { name: "Classificação" }).textContent).toBe("Custeio");
    fireEvent.click(screen.getByRole("combobox", { name: "Classificação" }));
    fireEvent.click(await screen.findByRole("option", { name: "Não classificada" }));
    expect(onValueChange).toHaveBeenCalledWith("");
    expect(screen.getByRole("combobox", { name: "Classificação" }).textContent).toBe("Não classificada");
  });
});

it("liga o texto de ajuda e o estado de erro ao campo", () => {
  render(<CampoSelect aria-label="Classificação" aria-describedby="ajuda" aria-invalid options={opcoes} value="" onValueChange={() => {}} />);
  const campo = screen.getByRole("combobox", { name: "Classificação" });
  expect(campo.getAttribute("aria-describedby")).toBe("ajuda");
  expect(campo.getAttribute("aria-invalid")).toBe("true");
});
