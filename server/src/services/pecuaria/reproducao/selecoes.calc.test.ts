import { describe, expect, it } from "vitest";
import { avaliarSelecaoAnimal, ordenarAnimaisSelecao } from "./selecoes.calc.js";
import { criteriosSelecaoSchema } from "./selecoes.schemas.js";

const criterios = (extra: object = {}) => criteriosSelecaoSchema.parse({ versao: 1,
  todas: [], qualquer: [], ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR", ...extra });
describe("seleções dinâmicas por critérios", () => {
  it("aplica E geral e OU entre faixas, mantendo todos os motivos sem repetir o animal", () => {
    const c = criterios({ todas: [{ tipo: "VALORES", campo: "LOTE", valores: ["lote-a"] }], qualquer: [
      { id: "pos-parto", todas: [{ tipo: "FAIXA", campo: "DEL", min: 40, max: 70 }] },
      { id: "tentativa", todas: [{ tipo: "FAIXA", campo: "DIAS_TENTATIVA", min: 20, max: 35 }] },
    ] });
    expect(avaliarSelecaoAnimal({ animalId: "a", lote: { id: "lote-a" }, del: 50, diasTentativa: 25 }, c))
      .toMatchObject({ incluido: true, motivos: expect.arrayContaining([expect.stringContaining("DEL"), expect.stringContaining("tentativa")]) });
    expect(avaliarSelecaoAnimal({ animalId: "b", lote: { id: "outro" }, del: 50 }, c).incluido).toBe(false);
    expect(avaliarSelecaoAnimal({ animalId: "c", lote: { id: "lote-a" }, del: 10, diasTentativa: 50 }, c).incluido).toBe(false);
  });
  it("respeita os limites inclusivos e exclusivos e não converte desconhecido em zero", () => {
    const c = criterios({ todas: [{ tipo: "FAIXA", campo: "DEL", min: 0, max: 20, incluirMax: false }] });
    expect(avaliarSelecaoAnimal({ animalId: "a", del: 0 }, c).incluido).toBe(true);
    expect(avaliarSelecaoAnimal({ animalId: "a", del: 20 }, c).incluido).toBe(false);
    expect(avaliarSelecaoAnimal({ animalId: "a", del: null }, c).incluido).toBe(false);
    const incl = avaliarSelecaoAnimal({ animalId: "a", del: null }, { ...c, politicaDesconhecidos: "INCLUIR" });
    expect(incl.incluido).toBe(true);
    expect(incl.motivos[0]).toContain("política de desconhecidos");
  });
  it("permite selecionar RP desconhecida sem tratar Não como desconhecido", () => {
    const c = criterios({ todas: [{ tipo: "DESCONHECIDO", campo: "RP" }] });
    expect(avaliarSelecaoAnimal({ animalId: "a", retencaoPlacenta: null }, c).incluido).toBe(true);
    expect(avaliarSelecaoAnimal({ animalId: "a", retencaoPlacenta: false }, c).incluido).toBe(false);
  });
  it("reavalia o mesmo animal em cada data e ordena valores desconhecidos por último", () => {
    const c = criterios({ todas: [{ tipo: "FAIXA", campo: "DEL", min: 40, max: 60 }] });
    expect(avaliarSelecaoAnimal({ animalId: "a", del: 39 }, c).incluido).toBe(false);
    expect(avaliarSelecaoAnimal({ animalId: "a", del: 40 }, c).incluido).toBe(true);
    expect(ordenarAnimaisSelecao([{ animalId: "a", brinco: "10" }, { animalId: "b", brinco: "2" }], c).map(a => a.animalId)).toEqual(["b", "a"]);
    const desc = criterios({ ordenacao: [{ campo: "DEL", direcao: "DESC" }] });
    expect(ordenarAnimaisSelecao([{ animalId: "a", del: null }, { animalId: "b", del: 0 }, { animalId: "c", del: 90 }], desc).map(a => a.animalId)).toEqual(["c", "b", "a"]);
  });
  it("recusa faixa vazia e IDs de blocos repetidos", () => {
    expect(() => criterios({ todas: [{ tipo: "FAIXA", campo: "DEL" }] })).toThrow();
    expect(() => criterios({ todas: [{ tipo: "FAIXA", campo: "DEL", min: 5, max: 5, incluirMin: false }] })).toThrow();
    const bloco = { id: "mesmo", todas: [{ tipo: "DESCONHECIDO", campo: "DEL" }] };
    expect(() => criterios({ qualquer: [bloco, bloco] })).toThrow();
  });
});

describe("estados desconhecidos de papel", () => {
  it("permite selecionar conflito explicitamente sem tratar NENHUM conhecido como desconhecido", () => {
    const conflito = criterios({ todas: [{ tipo: "VALORES", campo: "PAPEL_REPRODUTIVO", valores: ["CONFLITO"] }] });
    expect(avaliarSelecaoAnimal({ animalId: "a", papelReprodutivo: null, papelReprodutivoEstado: "CONFLITO" }, conflito).incluido).toBe(true);
    expect(avaliarSelecaoAnimal({ animalId: "a", papelReprodutivo: null, papelReprodutivoEstado: "DESCONHECIDO" }, conflito).incluido).toBe(false);
    const desconhecido = criterios({ todas: [{ tipo: "DESCONHECIDO", campo: "PAPEL_REPRODUTIVO" }] });
    expect(avaliarSelecaoAnimal({ animalId: "a", papelReprodutivo: "NENHUM", papelReprodutivoEstado: "CONHECIDO" }, desconhecido).incluido).toBe(false);
    expect(avaliarSelecaoAnimal({ animalId: "a", papelReprodutivo: null, papelReprodutivoEstado: "CONFLITO" }, desconhecido).incluido).toBe(false);
  });
});

describe("seleções por retorno agendado", () => {
  it("separa retorno informado da necessidade clínica e admite dias negativos somente neste eixo", () => {
    const c = criterios({ todas: [{ tipo: "VALORES", campo: "RETORNO_INFORMADO", valores: ["SIM"] }, { tipo: "FAIXA", campo: "DIAS_ATE_RETORNO", min: -5, max: 0 }] });
    expect(avaliarSelecaoAnimal({ animalId: "a", retornoInformado: true, diasAteRetorno: -3 }, c).incluido).toBe(true);
    expect(avaliarSelecaoAnimal({ animalId: "b", retornoInformado: false, diasAteRetorno: null }, c).incluido).toBe(false);
    expect(() => criterios({ todas: [{ tipo: "FAIXA", campo: "DEL", min: -1 }] })).toThrow();
  });
});
