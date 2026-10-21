import { describe, expect, it, vi } from "vitest";
vi.mock("../../../db.js", () => ({ prisma: {} }));
import { cadastrarAnimalSchema, listarFiltrosSchema, mudarDestinoSchema } from "./schemas.js";
import { planejarDestino, planejarDesfazer } from "./movimentacao.calc.js";
import { whereSituacao } from "./animais.js";
import { diferencas } from "./auditoria.calc.js";
import { partoAmpliadoSchema } from "../reproducao/partos.schemas.js";
import { avaliarSelecaoAnimal } from "../reproducao/selecoes.calc.js";
import { criteriosSelecaoSchema } from "../reproducao/selecoes.schemas.js";

const id = "12345678-1234-4123-8123-123456789012";
describe("finalidade Reprodução", () => {
  it.each(["F", "M"] as const)("aceita cadastro de sexo %s sem inferir papel reprodutivo", sexo => {
    const animal = cadastrarAnimalSchema.parse({ brinco: "R1", sexo, origem: "COMPRADO", dataNascimento: "2024-01-01", dataEntrada: "2026-01-01", propriedadeId: 1, aptidao: "REPRODUCAO" });
    expect(animal.aptidao).toBe("REPRODUCAO");
    expect(animal.papelReprodutivo).toBeUndefined();
  });

  it.each(["NENHUM", "RECEPTORA", "DOADORA", null] as const)("mantém o papel %s ao planejar mudança de finalidade", papelReprodutivo => {
    const entrada = mudarDestinoSchema.parse({ aptidao: "REPRODUCAO", data: "2026-02-01" });
    expect(entrada.papelReprodutivo).toBeUndefined();
    const atual = { aptidao: "LEITE" as const, papelReprodutivo, desde: "2026-01-01" };
    const plano = planejarDestino({ atual, novo: { aptidao: entrada.aptidao, papelReprodutivo }, data: entrada.data });
    expect(plano).toEqual({ tipo: "MOVER", fechar: { ate: "2026-02-01" }, abrir: { aptidao: "REPRODUCAO", papelReprodutivo, desde: "2026-02-01" } });
    expect(atual).toEqual({ aptidao: "LEITE", papelReprodutivo, desde: "2026-01-01" });
    const historico = [{ id: "antes", ...atual, ate: "2026-02-01" }, { id: "nova", aptidao: entrada.aptidao, desde: entrada.data, ate: null }];
    expect(planejarDesfazer(historico)).toEqual({ remover: { id: "nova" }, reabrir: { id: "antes" } });
  });

  it("aceita finalidade explícita para cria sem iniciar lactação", () => {
    const parto = partoAmpliadoSchema.parse({ chave: id, animalId: id, propriedadeId: 1, data: "2026-01-01", tipo: "NORMAL", crias: [{ viva: true, sexo: "F", aptidao: "REPRODUCAO" }] });
    expect(parto.crias[0].aptidao).toBe("REPRODUCAO");
    expect(parto.iniciarLactacao).toBe(false);
  });

  it("mantém filtros escalares, múltiplos e destino histórico da baixa", () => {
    const unico = listarFiltrosSchema.parse({ aptidao: "REPRODUCAO" });
    expect(whereSituacao({ situacao: "ATIVO", aptidao: unico.aptidao })).toMatchObject({ destinos: { some: { ate: null, aptidao: "REPRODUCAO" } } });
    const varios = listarFiltrosSchema.parse({ aptidoes: ["LEITE", "REPRODUCAO"] });
    expect(whereSituacao({ situacao: "BAIXADO", aptidoes: varios.aptidoes })).toMatchObject({ baixas: { some: { estornadaEm: null, destinoFechado: { aptidao: { in: ["LEITE", "REPRODUCAO"] } } } } });
  });

  it("seleciona finalidade e papel como condições independentes", () => {
    const criterios = criteriosSelecaoSchema.parse({ versao: 2, todas: [{ tipo: "VALORES", campo: "APTIDAO", valores: ["REPRODUCAO"] }, { tipo: "VALORES", campo: "PAPEL_REPRODUTIVO", valores: ["RECEPTORA"] }], qualquer: [], ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR" });
    expect(avaliarSelecaoAnimal({ animalId: id, aptidao: "REPRODUCAO", papelReprodutivo: "RECEPTORA" }, criterios)).toMatchObject({ incluido: true, motivos: expect.arrayContaining(["Finalidade: Reprodução"]) });
    expect(avaliarSelecaoAnimal({ animalId: id, aptidao: "LEITE", papelReprodutivo: "RECEPTORA" }, criterios).incluido).toBe(false);
    expect(avaliarSelecaoAnimal({ animalId: id, aptidao: "REPRODUCAO", papelReprodutivo: null }, criterios).incluido).toBe(false);
  });

  it.each(["DestinoAnimal", "FinalidadeAnimal"])("apresenta auditoria %s com o nome público Finalidade", entidade => {
    expect(diferencas(entidade, { aptidao: "LEITE" }, { aptidao: "REPRODUCAO" })).toEqual([{ campo: "aptidao", rotulo: "Finalidade", antes: "Leite", depois: "Reprodução" }]);
  });
});
