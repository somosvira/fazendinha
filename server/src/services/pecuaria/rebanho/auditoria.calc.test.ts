import { describe, expect, it } from "vitest";
import { diferencas } from "./auditoria.calc.js";

describe("diferencas", () => {
  it("cadastro (antes nulo): só os campos preenchidos aparecem, com antes = null", () => {
    const alteracoes = diferencas("Lote", null, { id: "l1", nome: "Bezerreiro", ativo: true, observacao: null, criadoEm: new Date(), criadoPorId: 1 });
    expect(alteracoes).toEqual(expect.arrayContaining([
      { campo: "nome", rotulo: "Nome", antes: null, depois: "Bezerreiro" },
      { campo: "ativo", rotulo: "Ativo", antes: null, depois: "sim" },
    ]));
    // observacao é null em `depois`: não aparece na lista (nada preenchido)
    expect(alteracoes.find((a) => a.campo === "observacao")).toBeUndefined();
  });

  it("exclusão (depois nulo): só os campos que tinham valor aparecem, com depois = null", () => {
    const alteracoes = diferencas("Pesagem", { id: "p1", data: "2026-01-01", pesoKg: "200.00", tipo: "ROTINA", origem: "MANUAL", observacao: null }, null);
    expect(alteracoes).toEqual(expect.arrayContaining([
      { campo: "data", rotulo: "Data", antes: "01/01/2026", depois: null },
      { campo: "pesoKg", rotulo: "Peso (kg)", antes: "200", depois: null },
      { campo: "tipo", rotulo: "Tipo", antes: "Rotina", depois: null },
      { campo: "origem", rotulo: "Origem", antes: "Manual", depois: null },
    ]));
    expect(alteracoes.find((a) => a.campo === "observacao")).toBeUndefined();
  });

  it("edição de Raca: nome mudou, sigla e ativo continuam iguais", () => {
    const antes = { id: "r1", nome: "Holandês", sigla: "HO", base: true, ativo: true };
    const depois = { id: "r1", nome: "Holandesa", sigla: "HO", base: true, ativo: true };
    expect(diferencas("Raca", antes, depois)).toEqual([{ campo: "nome", rotulo: "Nome", antes: "Holandês", depois: "Holandesa" }]);
  });

  it("datas formatadas dd/mm/aaaa", () => {
    const antes = { id: "a1", dataNascimento: "2024-01-15T00:00:00.000Z" };
    const depois = { id: "a1", dataNascimento: "2024-03-20T00:00:00.000Z" };
    expect(diferencas("Animal", antes, depois)).toEqual([{ campo: "dataNascimento", rotulo: "Nascimento", antes: "15/01/2024", depois: "20/03/2024" }]);
  });

  it("booleano formatado sim/não", () => {
    const antes = { id: "c1", ativo: true };
    const depois = { id: "c1", ativo: false };
    expect(diferencas("CategoriaAnimal", antes, depois)).toEqual([{ campo: "ativo", rotulo: "Ativa", antes: "sim", depois: "não" }]);
  });

  it("enum com rótulo em PT-BR (tipo de baixa)", () => {
    const antes = { id: "b1", tipo: "VENDA" };
    const depois = { id: "b1", tipo: "ABATE" };
    expect(diferencas("BaixaAnimal", antes, depois)).toEqual([{ campo: "tipo", rotulo: "Tipo", antes: "Venda", depois: "Abate" }]);
  });

  it("motivoId mudou: aparece como 'Motivo', sem resolver o nome (cálculo puro, sem banco)", () => {
    const antes = { id: "b1", motivoId: "m1" };
    const depois = { id: "b1", motivoId: "m2" };
    expect(diferencas("BaixaAnimal", antes, depois)).toEqual([{ campo: "motivoId", rotulo: "Motivo", antes: "m1", depois: "m2" }]);
  });

  it("campos técnicos (id, criadoEm, atualizadoEm, criadoPorId, animalId) nunca aparecem", () => {
    const antes = { id: "a1", animalId: "x", criadoEm: "2026-01-01", atualizadoEm: "2026-01-01", criadoPorId: 1, nome: "Igual" };
    const depois = { id: "a1", animalId: "x", criadoEm: "2026-01-02", atualizadoEm: "2026-01-02", criadoPorId: 2, nome: "Igual" };
    expect(diferencas("Animal", antes, depois)).toEqual([]);
  });

  it("genitor externo: mostra apenas os campos realmente alterados, com rótulos legíveis", () => {
    const antes = { id: "g1", nome: "Zeus", sexo: "M", codigo: "Z1", fornecedor: "Central A", fornecedorId: "p1", ativo: true, observacao: null };
    const depois = { ...antes, fornecedor: "Central B", fornecedorId: "p2", ativo: false, atualizadoEm: "2026-09-29" };
    expect(diferencas("GenitorExterno", antes, depois)).toEqual([
      { campo: "fornecedor", rotulo: "Fornecedor", antes: "Central A", depois: "Central B" },
      { campo: "ativo", rotulo: "Ativo", antes: "sim", depois: "não" },
    ]);
  });

  it("genitor externo: composição mostra raças e frações, sem confundir troca de IDs internos com alteração", () => {
    const nomes = { r1: "Holandesa", r2: "Gir" };
    const antes = [{ id: "linha-antiga", racaId: "r1", fracao64: 64 }];
    const mesma = [{ id: "linha-nova", racaId: "r1", fracao64: 64 }];
    const depois = [{ id: "linha-nova-2", racaId: "r1", fracao64: 32 }, { racaId: "r2", fracao64: 32 }];
    expect(diferencas("GenitorExterno", antes, mesma, nomes)).toEqual([]);
    expect(diferencas("GenitorExterno", antes, depois, nomes)).toEqual([
      { campo: "composicao", rotulo: "Composição racial", antes: "Holandesa 64/64", depois: "Holandesa 32/64 · Gir 32/64" },
    ]);
    expect(diferencas("GenitorExterno", null, { nome: "Zeus", composicao: antes }, nomes)).toContainEqual(
      { campo: "composicao", rotulo: "Composição racial", antes: null, depois: "Holandesa 64/64" },
    );
  });

  it("objetos aninhados fora do mapa (ex.: histórico de ajuste da entrada) ficam de fora", () => {
    const antes = { id: "a1", nome: "Mimosa" };
    const depois = { id: "a1", nome: "Mimosa", historicoAjustado: { localizacao: "x", pesagens: ["p1"] } };
    expect(diferencas("Animal", antes, depois)).toEqual([]);
  });

  it("entidade sem mapa configurado devolve lista vazia", () => {
    expect(diferencas("Movimentacao", { id: "m1", motivo: "x" }, { id: "m1", motivo: "y" })).toEqual([]);
  });

  it("antes e depois nulos: lista vazia", () => {
    expect(diferencas("Lote", null, null)).toEqual([]);
  });
});
