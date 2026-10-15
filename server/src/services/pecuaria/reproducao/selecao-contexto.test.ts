import { beforeEach, describe, expect, it, vi } from "vitest";
import { ampliarContextosSelecaoTx } from "./selecao-contexto.js";
import { avaliarSelecaoAnimal } from "./selecoes.calc.js";
import { criteriosSelecaoSchema } from "./selecoes.schemas.js";

const elegibilidades = vi.hoisted(() => new Map<string, unknown>());
vi.mock("./elegibilidade.js", () => ({
  obterElegibilidadesNaDataTx: vi.fn(async (_tx, ids: string[]) => new Map(ids.flatMap(id => elegibilidades.has(id) ? [[id, elegibilidades.get(id)]] : []))),
}));

function delegacao<T>(resultado: T) {
  return { findMany: vi.fn(async () => resultado) };
}

describe("contexto V2 das seleções", () => {
  beforeEach(() => elegibilidades.clear());

  it("enriquece atributos uma vez para o conjunto e conserva desconhecidos", async () => {
    const animais = delegacao([
      { id: "a", brinco: "042", nome: "Aurora", origem: "NASCIDO", sexo: "F", nascimentoEstimado: false, dataNascimento: new Date("2022-01-01T00:00:00Z"), partosAntesDaEntrada: 0 },
      { id: "b", brinco: "043", nome: null, origem: "COMPRADO", sexo: "F", nascimentoEstimado: true, dataNascimento: new Date("2021-01-01T00:00:00Z"), partosAntesDaEntrada: 0 },
    ]);
    const pesagens = delegacao([{ id: "p1", animalId: "a", pesoKg: "500.00", data: new Date("2026-10-01T00:00:00Z") }]);
    const composicoes = delegacao([{ animalId: "a", racaId: "gir", fracao64: 64, criadoEm: new Date("2020-01-01Z"), atualizadoEm: new Date("2020-01-01Z"), raca: { nome: "Gir" } }]);
    const participacoes = delegacao([{ animalId: "a", protocoloId: "proto", inicio: new Date("2026-09-01Z"), inicioEfetivo: new Date("2026-09-01Z"), canceladaEm: null, protocolo: { id: "proto", nome: "Protocolo", tipo: "REPRODUTIVO" }, tarefas: [] }]);
    const tx = { animal: animais, pesagem: pesagens, composicaoRacial: composicoes, participacaoProtocolo: participacoes } as never;
    elegibilidades.set("a", { estado: "ELEGIVEL", aptaDesde: "2026-09-01" });
    const contextos = new Map<string, Record<string, unknown>>([["a", { partos: 0 }], ["b", { partos: 0 }]]);

    await ampliarContextosSelecaoTx(tx, contextos as never, 7, new Date("2026-10-15T00:00:00Z"));

    expect(contextos.get("a")).toMatchObject({ pesoKg: 500, pesagemData: "2026-10-01", racas: ["gir"], protocolosAtivos: ["proto"], diasAptidao: 44, nascimentoEstimado: "NAO" });
    expect(contextos.get("b")).toMatchObject({ pesoKg: null, pesagemData: null, racas: null, protocolosAtivos: [], diasAptidao: null, nascimentoEstimado: "SIM" });
    for (const consulta of [animais.findMany, pesagens.findMany, composicoes.findMany, participacoes.findMany]) expect(consulta).toHaveBeenCalledTimes(1);
  });

  it("mantém o peso conhecido na data e torna composição posterior desconhecida", async () => {
    const animal = { id: "a", brinco: "042", nome: null, origem: "NASCIDO", sexo: "F", nascimentoEstimado: false, dataNascimento: new Date("2020-01-01Z"), partosAntesDaEntrada: 0 };
    const tx = {
      animal: delegacao([animal]),
      pesagem: delegacao([{ animalId: "a", pesoKg: "500", data: new Date("2026-10-01Z") }, { animalId: "a", pesoKg: "600", data: new Date("2026-10-20Z") }]),
      composicaoRacial: delegacao([{ animalId: "a", racaId: "gir", fracao64: 64, criadoEm: new Date("2020-01-01Z"), atualizadoEm: new Date("2026-10-20Z"), raca: { nome: "Gir" } }]),
      participacaoProtocolo: delegacao([]),
    } as never;
    const contextos = new Map([["a", {} as Record<string, unknown>]]);

    await ampliarContextosSelecaoTx(tx, contextos as never, 7, new Date("2026-10-15T00:00:00Z"));

    expect(contextos.get("a")).toMatchObject({ pesoKg: 500, pesagemData: "2026-10-01", racas: null, composicaoSelecao: null });
  });

  it("inclui APTA e VAZIA somente quando DIAS_APTIDAO supera o limite", () => {
    const criterios = criteriosSelecaoSchema.parse({ versao: 2, todas: [], qualquer: [{ id: "aptidao", todas: [
      { tipo: "VALORES", campo: "SITUACAO", valores: ["APTA", "VAZIA"] },
      { tipo: "FAIXA", campo: "DIAS_APTIDAO", min: 10, incluirMin: false, incluirMax: true },
    ] }], ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR" });
    const incluir = (situacao: string, diasAptidao: number | null) => avaliarSelecaoAnimal({ animalId: situacao, situacao, diasAptidao }, criterios).incluido;

    expect(incluir("APTA", 30)).toBe(true);
    expect(incluir("VAZIA", 11)).toBe(true);
    expect(incluir("APTA", 10)).toBe(false);
    expect(incluir("VAZIA", null)).toBe(false);
    expect(incluir("GESTANTE", 30)).toBe(false);
    expect(incluir("AGUARDANDO_DIAGNOSTICO", 30)).toBe(false);
    expect(incluir("DESCONHECIDA", 30)).toBe(false);
  });
});
