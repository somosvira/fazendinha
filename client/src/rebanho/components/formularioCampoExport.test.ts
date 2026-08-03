// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { CampoFormularioCampoDTO, FolhaCampoDTO } from "../api";
import { montarFormularioCampoParaPdf, montarPreviaFormularioCampo } from "./formularioCampoExport";

const campos: CampoFormularioCampoDTO[] = [
  { chave: "resultado_dg", rotulo: "Resultado do toque", tipoUi: "opcoes", obrigatorio: true, eventoAlvo: "DIAGNOSTICO", opcoes: [{ valor: "positivo", rotulo: "Prenhe" }, { valor: "negativo", rotulo: "Vazia" }] },
  { chave: "data_evento", rotulo: "Data do exame", tipoUi: "data", obrigatorio: true, eventoAlvo: "DIAGNOSTICO" },
  { chave: "observacao", rotulo: "Observação", tipoUi: "texto", obrigatorio: false, eventoAlvo: "DIAGNOSTICO" },
];
const folha: FolhaCampoDTO = {
  id: 20, nome: "Toque julho", templateId: "ia-periodo", status: "EM_CAMPO", filtros: {},
  config: { colunasSistema: ["animal", "data", "reprodutor"], camposPapel: ["resultado_dg", "data_evento", "observacao"] },
  modeloId: null, totalLinhas: 1, linhasProntas: 0, propriedadeId: 7, geradoEm: "2026-08-03T10:00:00Z", concluidoEm: null,
  linhas: [{ id: 1, ordem: 0, animalId: 5, eventoOrigemId: 11, status: "PENDENTE", respostas: null, motivoNaoRealizado: null, eventoGeradoId: null,
    snapshot: { numero: "150", nome: "Lua", categoria: "VACA", grupo: "Alta", setor: "Compost", data: "2026-07-20", valores: { reprodutor: "Lance" } } }],
};

describe("impressão de formulário de campo", () => {
  it("renderiza opções, data e linha de texto em branco", () => {
    const documento = montarFormularioCampoParaPdf(folha, campos);

    expect(documento.textContent).toContain("Toque julho");
    expect(documento.textContent).toContain("#150 · Lua");
    expect(documento.textContent).toContain("☐ Prenhe");
    expect(documento.textContent).toContain("☐ Vazia");
    expect(documento.textContent).toContain("____/____/______");
    expect(documento.querySelector(".formulario-campo-linha")).toBeTruthy();
    expect(documento.querySelector("button")).toBeNull();
  });

  it("a prévia usa diretamente as linhas do relatório antes de salvar", () => {
    const documento = montarPreviaFormularioCampo({
      nome: "Prévia de toque",
      config: folha.config,
      relatorio: {
        templateId: "ia-periodo", titulo: "Inseminações", descricao: "", granularidade: "evento",
        colunas: [{ chave: "reprodutor", rotulo: "Touro / sêmen", tipo: "texto" }], acao: null,
        linhas: [{ animalId: 5, numero: "150", nome: "Lua", categoria: "VACA", grupo: "Alta", setor: "Compost", eventoId: 11, data: "2026-07-20", celulas: ["Lance"] }],
        total: 1, truncado: false, meta: { geradoEm: "", periodo: { inicio: "2026-07-01", fim: "2026-07-31" }, propriedadeId: 7 },
      },
      campos,
    });

    expect(documento.textContent).toContain("Prévia de toque");
    expect(documento.textContent).toContain("Lance");
    expect(documento.textContent).toContain("☐ Prenhe");
  });
});
