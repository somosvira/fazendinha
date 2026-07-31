// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { montarRelatorioParaPdf, relatorioParaCsv } from "./relatorioExport";
import type { ResultadoRelatorioRebanhoDTO } from "../api";

const data: ResultadoRelatorioRebanhoDTO = {
  templateId: "ia-periodo",
  titulo: "Inseminações no período",
  descricao: "Uma linha por tentativa.",
  granularidade: "evento",
  colunas: [
    { chave: "reprodutor", rotulo: "Touro / sêmen", tipo: "texto" },
    { chave: "tentativas", rotulo: "Tentativas", tipo: "numero" },
  ],
  acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" },
  linhas: [{
    animalId: 5, numero: "150", nome: "Lua, \"FIV\"", categoria: "VACA", grupo: "Alta", setor: null,
    eventoId: 11, data: "2026-06-20", celulas: ["Lance", 0],
  }],
  total: 1,
  truncado: false,
  meta: { geradoEm: "2026-07-31T10:00:00Z", periodo: { inicio: "2026-06-01", fim: "2026-06-30" }, propriedadeId: 7 },
};

describe("exportação dos relatórios configuráveis", () => {
  it("gera CSV compatível com Excel, acentos e valores zero, sem ações", () => {
    const csv = relatorioParaCsv(data);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Animal";"Nome";"Categoria";"Grupo";"Setor";"Data";"Touro / sêmen";"Tentativas"');
    expect(csv).toContain('"150";"Lua, ""FIV""";"VACA";"Alta";;"2026-06-20";"Lance";"0"');
    expect(csv).not.toContain("Ações");
    expect(csv).not.toContain("Registrar DG");
    expect(csv).toContain("\r\n");
  });

  it("monta PDF estático sem a marcação interativa e acessível duplicada do animal", () => {
    const documento = montarRelatorioParaPdf(data);

    expect(documento.classList.contains("relatorio-export-pdf")).toBe(true);
    expect(documento.querySelector("button")).toBeNull();
    expect(documento.querySelector(".sr-only")).toBeNull();
    expect(documento.querySelector("[data-export-ignore]")).toBeNull();
    expect(documento.textContent).not.toContain("Animal número");
    expect(documento.textContent).not.toContain("Ações");
    expect(documento.textContent).not.toContain("Registrar DG");

    const animal = documento.querySelector("tbody .relatorio-pdf-animal");
    expect(animal?.textContent).toBe('#150 · Lua, "FIV"');
    expect(animal?.children).toHaveLength(0);
  });

  it("define uma geometria fixa e preserva metadados e valores zero", () => {
    const documento = montarRelatorioParaPdf(data);
    const tabela = documento.querySelector("table");
    const colunas = Array.from(documento.querySelectorAll<HTMLTableColElement>("colgroup col"));

    expect(tabela?.classList.contains("relatorio-export-table")).toBe(true);
    expect(colunas).toHaveLength(3 + data.colunas.length);
    expect(colunas.map((coluna) => coluna.style.width)).toEqual(["24%", "18%", "12%", "23%", "23%"]);
    expect(documento.textContent).toContain("Inseminações no período");
    expect(documento.textContent).toContain("Uma linha por tentativa. · 1 linha · 2026-06-01 a 2026-06-30");
    expect(documento.querySelectorAll("tbody td")[4]?.textContent).toBe("0");
  });

  it("usa travessão para ausências sem inventar nome ou grupo", () => {
    const documento = montarRelatorioParaPdf({
      ...data,
      linhas: [{ ...data.linhas[0], nome: null, grupo: null, setor: null, data: null, celulas: [null, 0] }],
    });
    const celulas = Array.from(documento.querySelectorAll("tbody td"), (celula) => celula.textContent);

    expect(celulas).toEqual(["#150", "—", "—", "—", "0"]);
  });
});
