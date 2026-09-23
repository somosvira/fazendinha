import { describe, expect, it } from "vitest";
import {
  validarDataLocalizacao,
  validarDataPesagem,
  validarDataSaida,
  validarDatasAnimal,
  validarEdicaoAnimal,
} from "./datas.calc.js";

describe("validarDatasAnimal", () => {
  it("aceita comprado com entrada depois do nascimento", () => {
    expect(validarDatasAnimal({ dataNascimento: "2024-01-01", dataEntrada: "2025-01-01", origem: "COMPRADO" })).toEqual([]);
  });

  it("bloqueia entrada antes do nascimento", () => {
    const erros = validarDatasAnimal({ dataNascimento: "2025-01-01", dataEntrada: "2024-01-01", origem: "COMPRADO" });
    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("dataEntrada");
  });

  it("nascido deve ter entrada === nascimento", () => {
    const erros = validarDatasAnimal({ dataNascimento: "2025-01-01", dataEntrada: "2025-01-02", origem: "NASCIDO" });
    expect(erros).toHaveLength(1);
  });

  it("fêmea com partos antes da entrada: datas continuam validadas normalmente (partos não afeta datas)", () => {
    expect(validarDatasAnimal({ dataNascimento: "2020-01-01", dataEntrada: "2022-01-01", origem: "COMPRADO" })).toEqual([]);
  });
});

describe("validarDataSaida", () => {
  it("bloqueia saída antes da entrada", () => {
    expect(validarDataSaida({ dataEntrada: "2026-01-01", dataSaida: "2025-01-01" })).toHaveLength(1);
  });

  it("aceita saída no mesmo dia da entrada", () => {
    expect(validarDataSaida({ dataEntrada: "2026-01-01", dataSaida: "2026-01-01" })).toEqual([]);
  });
});

describe("validarDataPesagem", () => {
  it("bloqueia pesagem antes do nascimento", () => {
    expect(validarDataPesagem({ dataNascimento: "2026-01-01", dataPesagem: "2025-01-01" })).toHaveLength(1);
  });

  it("bloqueia pesagem depois da saída", () => {
    expect(validarDataPesagem({ dataNascimento: "2026-01-01", dataSaida: "2026-02-01", dataPesagem: "2026-03-01" })).toHaveLength(1);
  });

  it("aceita pesagem entre nascimento e saída", () => {
    expect(validarDataPesagem({ dataNascimento: "2026-01-01", dataSaida: "2026-02-01", dataPesagem: "2026-01-15" })).toEqual([]);
  });
});

describe("validarDataLocalizacao", () => {
  it("bloqueia início antes da entrada", () => {
    expect(validarDataLocalizacao({ dataEntrada: "2026-01-01", desde: "2025-01-01" })).toHaveLength(1);
  });

  it("bloqueia início depois da saída", () => {
    expect(validarDataLocalizacao({ dataEntrada: "2026-01-01", dataSaida: "2026-02-01", desde: "2026-03-01" })).toHaveLength(1);
  });
});

describe("validarDataDestino", () => {
  it("bloqueia mudança de destino antes da entrada", async () => {
    const { validarDataDestino } = await import("./datas.calc.js");
    expect(validarDataDestino({ dataEntrada: "2026-02-01", desde: "2026-01-31" })).toHaveLength(1);
    expect(validarDataDestino({ dataEntrada: "2026-02-01", desde: "2026-02-01" })).toEqual([]);
  });
});

describe("validarEdicaoAnimal", () => {
  const base = {
    sexo: "F" as const,
    dataNascimento: "2024-01-01",
    origem: "COMPRADO" as const,
    dataEntrada: "2024-02-01",
    partosAntesDaEntrada: 0,
    primeiraLocalizacaoDesde: null,
    primeiroDestinoDesde: null,
    primeiraPesagemData: null,
    primeiraSaidaData: null,
  };

  it("aceita quando não há histórico e datas são consistentes", () => {
    expect(validarEdicaoAnimal(base)).toEqual([]);
  });

  it("bloqueia entrada antes do nascimento", () => {
    const erros = validarEdicaoAnimal({ ...base, dataEntrada: "2023-01-01" });
    expect(erros[0].campo).toBe("dataEntrada");
  });

  it("nascido deve ter entrada === nascimento", () => {
    const erros = validarEdicaoAnimal({ ...base, origem: "NASCIDO", dataEntrada: "2024-02-01", dataNascimento: "2024-01-01" });
    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("dataEntrada");
  });

  it("bloqueia entrada depois do início da primeira localização", () => {
    const erros = validarEdicaoAnimal({ ...base, dataEntrada: "2024-03-01", primeiraLocalizacaoDesde: "2024-02-15" });
    expect(erros[0].campo).toBe("dataEntrada");
  });

  it("bloqueia entrada depois do início do primeiro destino", () => {
    const erros = validarEdicaoAnimal({ ...base, dataEntrada: "2024-03-01", primeiroDestinoDesde: "2024-02-15" });
    expect(erros[0].campo).toBe("dataEntrada");
  });

  it("bloqueia nascimento depois da primeira pesagem", () => {
    const erros = validarEdicaoAnimal({ ...base, dataNascimento: "2024-03-01", dataEntrada: "2024-03-01", primeiraPesagemData: "2024-02-15" });
    expect(erros[0].campo).toBe("dataNascimento");
  });

  it("bloqueia entrada depois da primeira saída", () => {
    const erros = validarEdicaoAnimal({ ...base, dataEntrada: "2024-03-01", primeiraSaidaData: "2024-02-15" });
    expect(erros[0].campo).toBe("dataEntrada");
  });

  it("aceita entrada exatamente no início da primeira localização/destino/saída", () => {
    expect(validarEdicaoAnimal({
      ...base,
      dataEntrada: "2024-02-01",
      primeiraLocalizacaoDesde: "2024-02-01",
      primeiroDestinoDesde: "2024-02-01",
      primeiraSaidaData: "2024-02-01",
    })).toEqual([]);
  });
});
