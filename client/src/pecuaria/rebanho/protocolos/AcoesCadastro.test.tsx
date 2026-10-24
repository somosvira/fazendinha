// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { EditorAcoesCadastro } from "./AcoesCadastro";

afterEach(cleanup);
function Editor() {
  const [itens, setItens] = useState(Array.from({ length: 12 }, (_, i) => ({ chaveEdicao: `acao-${i}`, nome: `Ação ${i + 1}` })));
  return <EditorAcoesCadastro origem={null} itens={itens} onChange={setItens} converter={e => e} onCompletoChange={() => {}} renderizar={(item, indice) => <fieldset><label>Nome {item.chaveEdicao}<input value={item.nome} onChange={e => setItens(itens.map((v, i) => i === indice ? { ...v, nome: e.target.value } : v))} /></label><button type="button" onClick={() => setItens(itens.filter((_, i) => i !== indice))}>Remover {item.chaveEdicao}</button></fieldset>} />;
}
it("mantém identidade, teclado e valores da ação vizinha ao remover e paginar", () => {
  render(<Editor />);
  const primeira = screen.getByLabelText("Nome acao-0");
  const vizinha = screen.getByLabelText("Nome acao-1");
  primeira.focus();
  fireEvent.change(primeira, { target: { value: "Editada antes de remover" } });
  expect(document.activeElement).toBe(primeira);
  fireEvent.click(screen.getByRole("button", { name: "Remover acao-0" }));
  expect(screen.getByLabelText("Nome acao-1")).toBe(vizinha);
  expect(document.activeElement).toBe(vizinha);
  expect(screen.getAllByRole("textbox")).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Nome acao-11"), { target: { value: "Última editada" } });
  fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
  expect(screen.getByLabelText("Nome acao-1")).toHaveProperty("value", "Ação 2");
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByLabelText("Nome acao-11")).toHaveProperty("value", "Última editada");
});
