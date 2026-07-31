// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { prepararRelatorioParaPdf, relatorioParaCsv } from "./relatorioExport";
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

  it("prepara uma cópia monocromática para PDF sem ações nem nomes truncados", () => {
    const origem = document.createElement("div");
    origem.innerHTML = `
      <table>
        <thead><tr><th>Animal</th><th data-export-ignore>Ações</th></tr></thead>
        <tbody><tr><td class="relatorio-animal"><span><strong>#1001</strong><span>·</span><span class="truncate">CAROLINA</span></span></td><td data-export-ignore>Registrar DG</td></tr></tbody>
      </table>`;

    const copia = prepararRelatorioParaPdf(origem);

    expect(copia.textContent).toContain("CAROLINA");
    expect(copia.textContent).not.toContain("Ações");
    expect(copia.textContent).not.toContain("Registrar DG");
    expect(copia.querySelector("[data-export-ignore]")).toBeNull();
    expect(copia.classList.contains("relatorio-export-pdf")).toBe(true);
    const nome = copia.querySelector(".truncate") as HTMLElement;
    expect(nome.style.whiteSpace).toBe("normal");
    expect(nome.style.overflow).toBe("visible");
    expect(nome.style.textOverflow).toBe("clip");
  });
});
