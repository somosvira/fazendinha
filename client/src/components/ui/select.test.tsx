// @vitest-environment jsdom
import "../../lib/controles.fixture";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { SelectCampo } from "../../financeiro/SelectCampo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

afterEach(cleanup);
function Campo() {
  const [valor, setValor] = useState("cria");
  return <SelectCampo aria-label="Lote de teste" value={valor} onValueChange={setValor}>
    <option value="">Todos os lotes</option>
    <option value="cria">Cria</option>
    <option value="matrizes">Matrizes</option>
    <option value="nutricao">Nutrição</option>
    <option value="inativo" disabled>Inativo</option>
  </SelectCampo>;
}
describe("Select compartilhado com busca", () => {
  it("filtra sem acentos e não altera a seleção enquanto digita", async () => {
    render(<Campo />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lote de teste" }));
    fireEvent.change(await screen.findByRole("searchbox", { name: "Buscar opções" }), { target: { value: "nutricao" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Nutrição" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Lote de teste", hidden: true }).textContent).toContain("Cria");
    fireEvent.click(screen.getByRole("option", { name: "Nutrição" }));
    expect(screen.getByRole("combobox", { name: "Lote de teste" }).textContent).toContain("Nutrição");
    fireEvent.click(screen.getByRole("combobox", { name: "Lote de teste" }));
    expect((await screen.findByRole("searchbox", { name: "Buscar opções" }) as HTMLInputElement).value).toBe("");
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });
  it("mostra vazio sem trocar o valor escolhido", async () => {
    render(<Campo />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lote de teste" }));
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "inexistente" } });
    expect(screen.getByRole("status").textContent).toBe("Nenhuma opção encontrada.");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Lote de teste", hidden: true }).textContent).toContain("Cria");
  });
  it("seta para baixo leva da busca para a opção visível", async () => {
    render(<Campo />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lote de teste" }));
    const busca = await screen.findByRole("searchbox");
    fireEvent.change(busca, { target: { value: "matr" } });
    fireEvent.keyDown(busca, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Matrizes" }));
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
  });
  it("preserva o rótulo automático e a opção nativa ao filtrar outro item", async () => {
    const { container } = render(<form><Select value="cria" name="lote"><SelectTrigger aria-label="Lote direto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cria">Cria</SelectItem><SelectItem value="matrizes">Matrizes</SelectItem></SelectContent></Select></form>);
    fireEvent.click(screen.getByRole("combobox", { name: "Lote direto" }));
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "matr" } });
    expect(screen.getByRole("combobox", { name: "Lote direto", hidden: true }).textContent).toContain("Cria");
    expect(container.querySelector("select")?.value).toBe("cria");
    expect(new FormData(container.querySelector("form")!).get("lote")).toBe("cria");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
  it("mantém grupos e opções sem value explícito, sem habilitar grupo desativado", async () => {
    render(<SelectCampo value="" aria-label="Catálogo"><option value="">Selecione</option><optgroup label="Ativos"><option>Nutrição</option></optgroup><optgroup label="Inativos" disabled><option value="inativo">Antigo</option></optgroup></SelectCampo>);
    fireEvent.click(screen.getByRole("combobox", { name: "Catálogo" }));
    expect((await screen.findByRole("option", { name: "Nutrição" })).getAttribute("data-value")).toBe("Nutrição");
    expect(screen.getByRole("option", { name: "Antigo" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nutricao" } });
    expect(screen.getByRole("group", { name: "Ativos" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Inativos" })).toBeNull();
  });
  it("valor vazio continua inválido em um campo obrigatório", () => {
    const { container } = render(<form><SelectCampo name="produto" required value="" aria-label="Produto"><option value="">Selecione</option><option value="p">Produto</option></SelectCampo></form>);
    const nativo = container.querySelector("select")!;
    expect(nativo.value).toBe("");
    expect(nativo.validity.valueMissing).toBe(true);
    expect(new FormData(container.querySelector("form")!).get("produto")).toBe("");
  });
  it("Escape fecha a busca e devolve o foco ao gatilho", async () => {
    render(<Campo />);
    const gatilho = screen.getByRole("combobox", { name: "Lote de teste" });
    fireEvent.click(gatilho);
    const busca = await screen.findByRole("searchbox");
    fireEvent.change(busca, { target: { value: "matr" } });
    fireEvent.keyDown(busca, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("searchbox")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(gatilho));
  });
  it("permite chegar à busca por Tab ou começar digitando nas opções", async () => {
    render(<Campo />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lote de teste" }));
    const opcao = await screen.findByRole("option", { name: "Cria" });
    await waitFor(() => expect(document.activeElement).toBe(opcao));
    fireEvent.keyDown(opcao, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowDown" });
    const primeira = screen.getByRole("option", { name: "Todos os lotes" });
    fireEvent.keyDown(primeira, { key: "m" });
    expect(screen.getByRole("searchbox")).toHaveProperty("value", "m");
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });
});
