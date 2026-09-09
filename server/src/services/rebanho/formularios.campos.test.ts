import { describe, expect, it } from "vitest";
import {
  camposParaTemplate,
  mapearRespostasParaEvento,
  mapearRespostasOperacionais,
  obterCampoFormulario,
} from "./formularios.campos.js";

describe("catálogo de campos dos formulários de campo", () => {
  it("sugere um toque estruturado para serviços reprodutivos", () => {
    const campos = camposParaTemplate("ia-periodo");

    expect(campos.map((campo) => campo.chave)).toEqual([
      "resultado_dg",
      "data_evento",
      "metodo_dg",
      "dt_parto_prevista",
      "observacao",
    ]);
    expect(obterCampoFormulario("resultado_dg")).toMatchObject({
      tipoUi: "opcoes",
      eventoAlvo: "DIAGNOSTICO",
      obrigatorio: true,
      opcoes: [
        { valor: "positivo", rotulo: "Prenhe" },
        { valor: "negativo", rotulo: "Vazia" },
      ],
    });
  });

  it("transforma respostas de toque no payload real de diagnóstico", () => {
    expect(mapearRespostasParaEvento("ia-periodo", {
      resultado_dg: "positivo",
      data_evento: "2026-08-03",
      metodo_dg: "Ultrassom",
      dt_parto_prevista: "2027-05-13",
      observacao: "Confirmada pelo veterinário",
    })).toEqual({
      tipo: "DIAGNOSTICO",
      resultado: "positivo",
      data: "2026-08-03",
      dtPartoPrevista: "2027-05-13",
      metodo: "Ultrassom",
      observacao: "Confirmada pelo veterinário",
    });
  });

  it("oferece campos de parto e monta um evento compatível", () => {
    expect(camposParaTemplate("partos-previstos").map((campo) => campo.chave)).toEqual([
      "data_evento",
      "tipo_parto",
      "auxilio_parto",
      "num_crias",
      "crias_vivas",
      "crias_natimortas",
      "sexo_cria",
      "observacao",
    ]);

    expect(mapearRespostasParaEvento("partos-previstos", {
      data_evento: "2026-09-01",
      tipo_parto: "1",
      num_crias: 1,
      crias_vivas: 1,
      crias_natimortas: 0,
      sexo_cria: "F",
    })).toEqual({
      tipo: "PARTO",
      data: "2026-09-01",
      tipoParto: "1",
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
    });
  });

  it("recusa campo ou resposta sem significado no domínio", () => {
    expect(() => obterCampoFormulario("campo-livre")).toThrow("campo de formulário não encontrado");
    expect(() => mapearRespostasParaEvento("ia-periodo", {
      resultado_dg: "talvez",
      data_evento: "2026-08-03",
    })).toThrow("respostas inválidas");
  });

  it("mapeia controle leiteiro, pesagem e vacinação para lançamentos reais", () => {
    expect(mapearRespostasOperacionais("controle-leiteiro-lote", { data_evento: "2026-08-13", peso_1: "12.5", peso_2: 10 })).toEqual({ tipo: "CONTROLE_LEITEIRO", data: "2026-08-13", peso1: 12.5, peso2: 10 });
    expect(mapearRespostasOperacionais("pesagem-corporal-lote", { data_evento: "2026-08-13", peso_corporal: "431.2" })).toEqual({ tipo: "PESAGEM_CORPORAL", data: "2026-08-13", peso: 431.2 });
    expect(mapearRespostasOperacionais("vacinacao-lote", { data_evento: "2026-08-13", vacina: "Brucelose" })).toEqual({ tipo: "VACINA", data: "2026-08-13", produto: "Brucelose" });
    expect(() => mapearRespostasOperacionais("controle-leiteiro-lote", { data_evento: "2026-08-13" })).toThrow("respostas inválidas");
  });

  it("exige os campos que formam um evento válido e rejeita campos de outro fluxo", async () => {
    const { validarCamposDoTemplate } = await import("./formularios.campos.js");

    expect(() => validarCamposDoTemplate("ia-periodo", ["resultado_dg", "data_evento", "metodo_dg"])).not.toThrow();
    expect(() => validarCamposDoTemplate("ia-periodo", ["resultado_dg"])).toThrow("campos obrigatórios");
    expect(() => validarCamposDoTemplate("ia-periodo", ["resultado_dg", "data_evento", "tipo_parto"])).toThrow("não pertence");
  });
});
