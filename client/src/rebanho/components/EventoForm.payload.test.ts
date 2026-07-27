import { describe, expect, it } from "vitest";
import { camposExameGinecologico, camposInseminacao, camposParto } from "./EventoForm.payload";

describe("camposInseminacao", () => {
  it("inclui o lote selecionado como número", () => {
    expect(camposInseminacao({
      reprodutor: "Holandês 8/8",
      protocolo: "IATF 11 dias",
      estoqueSemenId: "42",
    })).toEqual({
      reprodutor: "Holandês 8/8",
      protocolo: "IATF 11 dias",
      estoqueSemenId: 42,
    });
  });

  it("omite o lote vazio e mantém reprodutor e protocolo", () => {
    expect(camposInseminacao({
      reprodutor: "Gir 3/4 + Holandês 1/4",
      protocolo: undefined,
      estoqueSemenId: "",
    })).toEqual({
      reprodutor: "Gir 3/4 + Holandês 1/4",
      protocolo: undefined,
    });
  });

  it("ignora lote não inteiro positivo em vez de mandar payload inválido", () => {
    for (const invalido of ["abc", "1.5", "-2", "0"]) {
      expect(camposInseminacao({
        reprodutor: "Holandês 8/8",
        protocolo: "Ovsynch",
        estoqueSemenId: invalido,
      })).toEqual({ reprodutor: "Holandês 8/8", protocolo: "Ovsynch" });
    }
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
