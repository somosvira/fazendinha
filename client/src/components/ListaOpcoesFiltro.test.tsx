// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ContextoFiltroColuna } from "./ContextoFiltroColuna";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { MultiSelect } from "./MultiSelect";
import { CampoFiltro } from "@/financeiro/PainelFiltros";

afterEach(cleanup);
it("abre a seleção simples diretamente na coluna, preservando opções bloqueadas", () => {
  const mudar = vi.fn();
  render(<ContextoFiltroColuna.Provider value><CampoFiltro rotulo="Instituição"><SelectCampo aria-label="Instituição" value="" onValueChange={mudar}><option value="">Todas</option><option value="banco">Banco</option><option value="bloqueada" disabled>Bloqueada</option></SelectCampo></CampoFiltro></ContextoFiltroColuna.Provider>);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect((screen.getByRole("radio", { name: "Todas" }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "Banco" }));
  expect(mudar).toHaveBeenCalledWith("banco");
  expect((screen.getByRole("radio", { name: "Bloqueada" }) as HTMLInputElement).disabled).toBe(true);
  expect(document.querySelector("label label")).toBeNull();
});
it("mostra opções múltiplas sem outro acionador e mantém as seleções anteriores", () => {
  const mudar = vi.fn();
  render(<ContextoFiltroColuna.Provider value><MultiSelect label="Categorias" options={[{value:1,label:"Nutrição"},{value:2,label:"Sanidade"}]} value={[1]} onValueChange={mudar} /></ContextoFiltroColuna.Provider>);
  expect(screen.queryByRole("button", {name:"Categorias"})).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name:"Sanidade" }));
  expect(mudar).toHaveBeenCalledWith([1,2]);
});
