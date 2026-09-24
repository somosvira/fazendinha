import { describe, expect, it } from "vitest";
import {
  validarDataPesagem,
  validarDataBaixa,
  validarDatasAnimal,
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

describe("validarDataBaixa", () => {
  it("bloqueia baixa antes da entrada", () => {
    expect(validarDataBaixa({ dataEntrada: "2026-01-01", dataBaixa: "2025-01-01" })).toHaveLength(1);
  });

  it("aceita baixa no mesmo dia da entrada", () => {
    expect(validarDataBaixa({ dataEntrada: "2026-01-01", dataBaixa: "2026-01-01" })).toEqual([]);
  });

  it("R2: bloqueia baixa anterior à última pesagem, com a data no formato dd/mm/aaaa", () => {
    const erros = validarDataBaixa({ dataEntrada: "2026-01-01", dataBaixa: "2026-03-01", ultimaPesagemData: "2026-03-15" });
    expect(erros).toHaveLength(1);
    expect(erros[0].campo).toBe("data");
    expect(erros[0].mensagem).toBe("A baixa não pode ser anterior à última pesagem (15/03/2026)");
  });

  it("R2: aceita baixa no mesmo dia ou depois da última pesagem", () => {
    expect(validarDataBaixa({ dataEntrada: "2026-01-01", dataBaixa: "2026-03-15", ultimaPesagemData: "2026-03-15" })).toEqual([]);
    expect(validarDataBaixa({ dataEntrada: "2026-01-01", dataBaixa: "2026-03-16", ultimaPesagemData: "2026-03-15" })).toEqual([]);
  });

  it("R2: sem pesagem registrada, não valida contra ela", () => {
    expect(validarDataBaixa({ dataEntrada: "2026-01-01", dataBaixa: "2026-01-02", ultimaPesagemData: null })).toEqual([]);
  });

  it("R2: acumula os dois erros quando a baixa é anterior à entrada e à pesagem", () => {
    const erros = validarDataBaixa({ dataEntrada: "2026-03-01", dataBaixa: "2026-01-01", ultimaPesagemData: "2026-02-01" });
    expect(erros).toHaveLength(2);
  });
});

describe("validarDataPesagem", () => {
  it("bloqueia pesagem antes do nascimento", () => {
    expect(validarDataPesagem({ dataNascimento: "2026-01-01", dataPesagem: "2025-01-01" })).toHaveLength(1);
  });

  it("bloqueia pesagem depois da baixa", () => {
    expect(validarDataPesagem({ dataNascimento: "2026-01-01", dataBaixa: "2026-02-01", dataPesagem: "2026-03-01" })).toHaveLength(1);
  });

  it("aceita pesagem entre nascimento e baixa", () => {
    expect(validarDataPesagem({ dataNascimento: "2026-01-01", dataBaixa: "2026-02-01", dataPesagem: "2026-01-15" })).toEqual([]);
  });
});

describe("validarDataDestino", () => {
  it("bloqueia mudança de destino antes da entrada", async () => {
    const { validarDataDestino } = await import("./datas.calc.js");
    expect(validarDataDestino({ dataEntrada: "2026-02-01", desde: "2026-01-31" })).toHaveLength(1);
    expect(validarDataDestino({ dataEntrada: "2026-02-01", desde: "2026-02-01" })).toEqual([]);
  });
});

describe("campos dos erros de data seguem o payload", () => {
  it("baixa e pesagem devolvem campo data", () => {
    expect(validarDataBaixa({ dataEntrada: "2025-01-10", dataBaixa: "2025-01-01" })[0].campo).toBe("data");
    expect(validarDataPesagem({ dataNascimento: "2025-01-10", dataPesagem: "2025-01-01" })[0].campo).toBe("data");
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
    primeiraBaixaData: null,
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

  it("entrada não pode passar da baixa", () => {
    const plano = planejarAjusteEntrada({ ...base, primeiraBaixaData: "2025-02-01", entradaNova: "2025-03-01", localizacoes: [], destinos: [] });
    expect(plano.erros[0].mensagem).toMatch(/baixa/);
  });

  it("R4: entrada não pode passar de uma categoria manual já registrada", () => {
    const plano = planejarAjusteEntrada({
      ...base, primeiraCategoriaManualDesde: "2025-02-01", entradaNova: "2025-03-01", localizacoes: [], destinos: [],
    });
    expect(plano.erros[0].mensagem).toMatch(/categoria manual/);
    expect(plano.erros[0].campo).toBe("dataEntrada");
  });

  it("R4: aceita entrada exatamente na data da categoria manual (ou antes)", () => {
    expect(planejarAjusteEntrada({
      ...base, primeiraCategoriaManualDesde: "2025-01-10", entradaNova: "2025-01-10", localizacoes: [], destinos: [],
    }).erros).toEqual([]);
    expect(planejarAjusteEntrada({
      ...base, primeiraCategoriaManualDesde: "2025-02-01", entradaNova: "2024-12-01", localizacoes: [], destinos: [],
    }).erros).toEqual([]);
  });
});
