import { describe, expect, it } from "vitest";
import { extrairCelulas, listarTemplatesRelatorio, obterTemplateRelatorio } from "./relatorios.catalogo.js";

const evento = {
  id: 41,
  data: new Date("2026-06-15T00:00:00Z"),
  reprodutor: "Lance 884",
  protocolo: "IATF 11d",
  resultado: null,
  dtPartoPrevista: null,
  tipoParto: null,
  auxilioParto: null,
  numCrias: null,
  criasVivas: null,
  criasNatimortas: null,
  sexoCria: null,
  motivoSecagem: null,
  observacao: null,
  doadoraNumero: null,
  doadoraNome: null,
};

describe("catálogo de relatórios configuráveis", () => {
  it("oferece os templates reprodutivos em ordem editorial", () => {
    expect(listarTemplatesRelatorio().map((t) => t.id)).toEqual([
      "novilhas-aptas",
      "ia-periodo",
      "cobertura-periodo",
      "te-periodo",
      "dg-periodo",
      "gestantes-atual",
      "partos-previstos",
      "partos-periodo",
      "secagens-periodo",
      "controle-leiteiro-lote",
      "pesagem-corporal-lote",
      "vacinacao-lote",
    ]);
  });

  it("oferece folhas operacionais para os três lançamentos em lote", () => {
    for (const id of ["controle-leiteiro-lote", "pesagem-corporal-lote", "vacinacao-lote"] as const) {
      expect(obterTemplateRelatorio(id)).toMatchObject({ fase: "Manejo em lote", granularidade: "animal" });
    }
  });

  it("preserva uma linha por evento e sugere DG após inseminação", () => {
    const template = obterTemplateRelatorio("ia-periodo");
    expect(template.granularidade).toBe("evento");
    expect(template.acao).toEqual({ tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" });
    expect(extrairCelulas(template, evento)).toEqual(["Lance 884", "IATF 11d"]);
  });

  it("formata o resultado e a previsão do diagnóstico", () => {
    const template = obterTemplateRelatorio("dg-periodo");
    expect(extrairCelulas(template, {
      ...evento,
      resultado: "positivo",
      dtPartoPrevista: new Date("2027-03-25T00:00:00Z"),
    })).toEqual(["Positivo", "2027-03-25"]);
  });

  it("usa os dicionários oficiais no relatório de parto", () => {
    const template = obterTemplateRelatorio("partos-periodo");
    expect(extrairCelulas(template, {
      ...evento,
      tipoParto: "2",
      auxilioParto: "2",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
    })).toEqual(["Auxiliado", "4-Cesariana", 1, 1, 0, "F"]);
  });

  it("distingue templates de estado atual dos históricos", () => {
    expect(obterTemplateRelatorio("novilhas-aptas")).toMatchObject({
      granularidade: "animal",
      titulo: "Novilhas aptas à reprodução",
    });
    expect(obterTemplateRelatorio("gestantes-atual").granularidade).toBe("animal");
    expect(obterTemplateRelatorio("partos-previstos").granularidade).toBe("animal");
  });

  it("recusa template desconhecido", () => {
    expect(() => obterTemplateRelatorio("inventado")).toThrow("template de relatório não encontrado");
  });
});
