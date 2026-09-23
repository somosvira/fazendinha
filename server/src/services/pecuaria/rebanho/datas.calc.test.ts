import { describe, expect, it } from "vitest";
import {
  validarDataLocalizacao,
  validarDataPesagem,
  validarDataSaida,
  validarDatasAnimal,
  validarEdicaoAnimal,
  planejarAjusteEntrada,
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

describe("campos dos erros de data seguem o payload", () => {
  it("saída, pesagem e localização devolvem campo data", () => {
    expect(validarDataSaida({ dataEntrada: "2025-01-10", dataSaida: "2025-01-01" })[0].campo).toBe("data");
    expect(validarDataPesagem({ dataNascimento: "2025-01-10", dataPesagem: "2025-01-01" })[0].campo).toBe("data");
    expect(validarDataLocalizacao({ dataEntrada: "2025-01-10", desde: "2025-01-01" })[0].campo).toBe("data");
  });
});

describe("planejarAjusteEntrada", () => {
  const base = {
    entradaAntiga: "2025-01-10",
    nascimentoAntigo: "2024-01-10",
    nascimentoNovo: "2024-01-10",
    localizacoes: [{ id: "l1", desde: "2025-01-10", ate: "2025-06-01" }, { id: "l2", desde: "2025-06-01", ate: null }],
    destinos: [{ id: "d1", desde: "2025-01-10", ate: null }],
    pesagens: [{ id: "p1", data: "2025-01-10", tipo: "ENTRADA" }, { id: "p2", data: "2025-03-01", tipo: "ROTINA" }],
    primeiraSaidaData: null,
  };

  it("antecipar a entrada leva junto 1ª localização, 1º destino e pesagem de entrada", () => {
    const plano = planejarAjusteEntrada({ ...base, entradaNova: "2024-12-01" });
    expect(plano).toEqual({ erros: [], moverLocalizacao: "l1", moverDestino: "d1", moverPesagensEntrada: ["p1"], moverPesagensNascimento: [] });
  });

  it("adiar a entrada é permitido até o fim da 1ª localização", () => {
    expect(planejarAjusteEntrada({ ...base, entradaNova: "2025-02-01" }).erros).toEqual([]);
    const passou = planejarAjusteEntrada({ ...base, entradaNova: "2025-07-01" });
    expect(passou.erros.map((e) => e.campo)).toContain("dataEntrada");
  });

  it("linha que não começava na entrada antiga não acompanha e bloqueia entrada posterior a ela", () => {
    const plano = planejarAjusteEntrada({ ...base, localizacoes: [{ id: "l1", desde: "2025-02-01", ate: null }], entradaNova: "2025-03-01" });
    expect(plano.moverLocalizacao).toBeNull();
    expect(plano.erros[0].mensagem).toMatch(/início da primeira localização/);
  });

  it("nascimento novo não pode passar de uma pesagem, mas a pesagem de nascimento acompanha", () => {
    const comNascimento = { ...base, pesagens: [...base.pesagens, { id: "p0", data: "2024-01-10", tipo: "NASCIMENTO" }] };
    const ok = planejarAjusteEntrada({ ...comNascimento, entradaNova: "2025-01-10", nascimentoNovo: "2024-02-01" });
    expect(ok.erros).toEqual([]);
    expect(ok.moverPesagensNascimento).toEqual(["p0"]);
    const ruim = planejarAjusteEntrada({ ...comNascimento, entradaNova: "2025-01-10", nascimentoNovo: "2025-04-01" });
    expect(ruim.erros.some((e) => e.campo === "dataNascimento")).toBe(true);
  });

  it("entrada não pode passar da saída", () => {
    const plano = planejarAjusteEntrada({ ...base, primeiraSaidaData: "2025-02-01", entradaNova: "2025-03-01", localizacoes: [], destinos: [] });
    expect(plano.erros[0].mensagem).toMatch(/saída/);
  });
});
