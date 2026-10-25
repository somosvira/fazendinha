import { describe, expect, it } from "vitest";
import { contextoAnimalLeite, type AnimalContextoLeite } from "./populacao.calc.js";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const animal: AnimalContextoLeite = { id: "vaca", sexo: "F", brinco: "42", nome: null,
  destinos: [{ id: "leite", aptidao: "LEITE", desde: dia("2025-01-01"), ate: null }],
  dataNascimento: dia("2020-01-01"), dataEntrada: dia("2025-01-01"), baixas: [],
  localizacoes: [{ id: "origem", propriedadeId: 1, desde: dia("2025-01-01"), ate: dia("2026-10-15") },
    { id: "destino", propriedadeId: 2, desde: dia("2026-10-15"), ate: null }] };
const lactacao = { id: "lactacao", animalId: animal.id, inicio: dia("2026-01-01"), encerradaEm: dia("2026-10-16") };
describe("população da ordenha na data operacional", () => {
  it("consulta o sítio de origem e a lactação antes de transferência/secagem", () => {
    expect(contextoAnimalLeite(animal, [lactacao], 1, dia("2026-10-01"))).toMatchObject({ localizacaoId: "origem", lactacaoId: lactacao.id, pendencias: [] });
    expect(() => contextoAnimalLeite(animal, [lactacao], 1, dia("2026-10-15"))).toThrow(/localização histórica/);
    expect(contextoAnimalLeite(animal, [lactacao], 2, dia("2026-10-15"))).toMatchObject({ localizacaoId: "destino" });
    expect(() => contextoAnimalLeite(animal, [lactacao], 2, dia("2026-10-16"))).toThrow(/explicitamente encerrada/);
  });
  it("permite fêmea explicitamente incluída sem inventar lactação", () => {
    expect(contextoAnimalLeite(animal, [], 1, dia("2026-10-01"))).toMatchObject({ lactacaoId: null, pendencias: ["LACTACAO_NAO_INFORMADA"] });
    expect(() => contextoAnimalLeite({ ...animal, sexo: "M" }, [], 1, dia("2026-10-01"))).toThrow(/fêmea/);
  });
  it("recusa sobreposição de localização/lactação, datas e baixa anteriores", () => {
    expect(() => contextoAnimalLeite({ ...animal, localizacoes: [...animal.localizacoes, animal.localizacoes[0]] }, [lactacao], 1, dia("2026-10-01"))).toThrow(/localização/);
    expect(() => contextoAnimalLeite(animal, [lactacao, { ...lactacao, id: "outra" }], 1, dia("2026-10-01"))).toThrow(/sobrepostas/);
    expect(() => contextoAnimalLeite(animal, [], 1, dia("2024-10-01"))).toThrow(/anteceder/);
    expect(() => contextoAnimalLeite({ ...animal, baixas: [{ data: dia("2026-09-30"), localizacaoFechadaId: "origem" }] }, [], 1, dia("2026-10-01"))).toThrow(/após a baixa/);
  });
});
