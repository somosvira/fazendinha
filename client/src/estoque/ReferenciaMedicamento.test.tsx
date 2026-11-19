// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ConteudoReferenciaMedicamento, type ReferenciaMedicamento } from "./ReferenciaMedicamento";

afterEach(cleanup);
const fonte = { url: "https://calbos.com.br/produto/pirosan/", secao: "Modo de usar", pagina: 1 };
const r: ReferenciaMedicamento = {
  fonte: fonte.url, titulo: "Ficha oficial", tipoFonte: "FICHA_OFICIAL", consultadaEm: "2026-11-17",
  especie: "Bovinos", concentracao: "Formulação conferida", dosagem: "Dose depende da condição", via: "Intramuscular",
  cuidados: "Conferir condição indicada na fonte", proporcoes: [{ quantidade: "2", quantidadeMaxima: "3", unidade: "ML", pesoKg: "45", condicao: "Somente para a condição descrita" }],
  carencias: {
    leite: { estado: "PROIBIDO", horas: null, condicao: "Fêmeas em lactação" },
    carne: { estado: "PRAZO", horas: 0, condicao: "Expressamente informado" },
  },
  camposFonte: Object.fromEntries(["dosagem", "proporcoes", "via", "concentracao", "cuidados", "carenciasLeite", "carenciasCarne"].map(c => [c, fonte])),
};

it("mostra faixa, condição, proibição e fonte de cada informação", () => {
  render(<ConteudoReferenciaMedicamento referencia={r} />);
  expect(screen.getByText(/2 a 3 mL para 45 kg/)).toBeTruthy();
  expect(screen.getByText("Uso proibido nas condições descritas")).toBeTruthy();
  expect(screen.getByText("Carência zero expressamente informada")).toBeTruthy();
  expect(screen.getAllByRole("link").filter(a => a.getAttribute("href") === fonte.url)).toHaveLength(8);
  expect(screen.getByText("Ficha do fabricante")).toBeTruthy();
});
it("mantém ausência de carência visível e não cria campos de dose automática", () => {
  render(<ConteudoReferenciaMedicamento referencia={{ ...r, carencias: { ...r.carencias!, leite: { estado: "NAO_INFORMADO", horas: null, condicao: "Ausente na fonte" } } }} />);
  expect(screen.getByText("Prazo não informado")).toBeTruthy();
  expect(screen.queryByRole("spinbutton")).toBeNull();
});

it("mostra dados confirmados sem esconder a pendência específica de composição", () => {
  render(<ConteudoReferenciaMedicamento referencia={{ ...r, versao: 3, concentracao: null, pendencias: [{ campo: "concentracao", motivo: "O resumo oficial não publica a fórmula quantitativa." }] }} />);
  expect(screen.getByText("Pendente de conferência")).toBeTruthy();
  expect(screen.getByText(/O resumo oficial não publica/)).toBeTruthy();
  expect(screen.getByText(/Dose depende da condição/)).toBeTruthy();
  expect(screen.queryByText("Formulação conferida")).toBeNull();
});
