import { describe, expect, it } from "vitest";
import { camposExameGinecologico, camposInseminacao, camposParto, camposTransferenciaEmbriao } from "./EventoForm.payload";

describe("camposTransferenciaEmbriao", () => {
  it("envia embriaoColetaId e omite doadora/touro quando um embrião é escolhido", () => {
    expect(camposTransferenciaEmbriao({ embriaoColetaId: "70", doadoraId: "44", semenTE: "Touro X", protocolo: "P36" }))
      .toEqual({ protocolo: "P36", embriaoColetaId: 70 });
  });
  it("cai no fluxo manual (doadora/touro) quando não há embrião", () => {
    expect(camposTransferenciaEmbriao({ embriaoColetaId: "", doadoraId: "44", semenTE: " Touro X ", protocolo: "P36" }))
      .toEqual({ protocolo: "P36", doadoraId: 44, reprodutor: "Touro X" });
  });
  it("omite doadora e touro vazios no fluxo manual", () => {
    expect(camposTransferenciaEmbriao({ embriaoColetaId: "", doadoraId: "", semenTE: "  ", protocolo: undefined }))
      .toEqual({ protocolo: undefined });
  });
});

describe("camposInseminacao", () => {
  it("envia raça/grau de sangue e protocolo", () => {
    expect(camposInseminacao({
      reprodutor: "Holandês 8/8",
      protocolo: "IATF 11 dias",
    })).toEqual({
      reprodutor: "Holandês 8/8",
      protocolo: "IATF 11 dias",
    });
  });

  it("mantém o reprodutor quando o protocolo está vazio", () => {
    expect(camposInseminacao({
      reprodutor: "Gir 3/4 + Holandês 1/4",
      protocolo: undefined,
    })).toEqual({
      reprodutor: "Gir 3/4 + Holandês 1/4",
      protocolo: undefined,
    });
  });
});

describe("camposParto", () => {
  it("monta cadastro de cria viva com número e sexo", () => {
    expect(camposParto({
      tipoParto: "1",
      auxilioParto: "1",
      numCrias: "1",
      criasVivas: "1",
      criasNatimortas: "0",
      sexoCria: "F",
      criaAcao: "criar",
      criaNumero: "B-101",
      criaId: "",
    })).toEqual({
      tipoParto: "1",
      auxilioParto: undefined,
      numCrias: 1,
      criasVivas: 1,
      criasNatimortas: 0,
      sexoCria: "F",
      criarCria: true,
      criaNumero: "B-101",
    });
  });

  it("monta vínculo existente sem sinalizar criação", () => {
    expect(camposParto({
      tipoParto: "1",
      auxilioParto: "1",
      numCrias: "1",
      criasVivas: "1",
      criasNatimortas: "0",
      sexoCria: "M",
      criaAcao: "vincular",
      criaNumero: "",
      criaId: "77",
    })).toMatchObject({ criarCria: undefined, criaId: 77, sexoCria: "M" });
  });

  it("preserva um sexo por cria quando há três nascimentos vivos", () => {
    expect(camposParto({
      tipoParto: "1",
      auxilioParto: "1",
      numCrias: "3",
      criasVivas: "3",
      criasNatimortas: "0",
      sexoCria: "FMF",
      criaAcao: "criar",
      criaNumero: "T-10",
      criaId: "",
    })).toMatchObject({ numCrias: 3, criasVivas: 3, sexoCria: "FMF" });
  });

  it("aborto zera contagens e não envia cadastro nem vínculo", () => {
    expect(camposParto({
      tipoParto: "3",
      auxilioParto: "",
      numCrias: "1",
      criasVivas: "1",
      criasNatimortas: "0",
      sexoCria: "F",
      criaAcao: "criar",
      criaNumero: "B-101",
      criaId: "",
    })).toMatchObject({ numCrias: 0, criasVivas: 0, criasNatimortas: 0 });
    expect(camposParto({
      tipoParto: "3", auxilioParto: "", numCrias: "1", criasVivas: "1",
      criasNatimortas: "0", sexoCria: "F", criaAcao: "criar", criaNumero: "B-101", criaId: "",
    })).not.toHaveProperty("criarCria");
  });
});

describe("camposExameGinecologico", () => {
  it("envia achado condensado, método e resultado oficial", () => {
    expect(camposExameGinecologico({
      achado: "CORPO_LUTEO",
      metodoExame: "Ultrassom",
      resultadoGinecologicoId: "12",
    })).toEqual({
      resultado: "CORPO_LUTEO",
      metodo: "Ultrassom",
      resultadoGinecologicoId: 12,
    });
  });
});
