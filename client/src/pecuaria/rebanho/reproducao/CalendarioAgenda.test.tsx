// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CalendarioAgenda } from "./CalendarioAgenda";
vi.mock("../../../lib/hoje", async original => ({ ...await original<typeof import("../../../lib/hoje")>(), getHojeISO: () => "2026-10-26" }));
afterEach(cleanup);
it("seleciona datas do recorte, navega meses e não cria atividade para data desconhecida", () => {
  const itens = [{ id: "a", data: "2026-10-27", titulo: "Diagnóstico previsto" }, { id: "b", data: null, titulo: "Previsão pendente" }, { id: "c", data: "2026-11-02", titulo: "Retorno previsto" }];
  render(<CalendarioAgenda itens={itens} dataDe={i => i.data} chaveDe={i => i.id} render={i => <a href={`#${i.id}`}>{i.titulo}</a>}/>);
  expect(screen.getByText("Nenhuma atividade prevista neste dia com os critérios atuais.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "27 de outubro de 2026" }));
  expect(within(screen.getByRole("region", { name: "Atividades do dia selecionado" })).getByRole("link", { name: "Diagnóstico previsto" }).getAttribute("href")).toBe("#a");
  expect(screen.queryByText("Previsão pendente")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
  fireEvent.click(screen.getByRole("button", { name: "Consultar atividades de 02/11/2026" }));
  expect(screen.getByRole("link", { name: "Retorno previsto" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
  expect(screen.getByRole("heading", { name: "26/10/2026" })).toBeTruthy();
});
